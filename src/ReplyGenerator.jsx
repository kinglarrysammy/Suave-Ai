import { useState } from 'react'
import { supabase } from './supabaseClient'
import { consumeUsage } from './usageLimiter'
import { stripThinking } from './aiUtils'

const TONES = [
  { key: 'flirty', emoji: '😏', label: 'Flirty' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'confident', emoji: '🔥', label: 'Confident' },
  { key: 'casual', emoji: '💬', label: 'Casual' },
]

const spiceDescriptor = (level) => {
  if (level <= 20) return 'very mild, sweet, and wholesome — nothing forward at all'
  if (level <= 40) return 'warm and lightly playful, still pretty safe'
  if (level <= 60) return 'flirty and teasing, clearly interested'
  if (level <= 80) return 'bold and spicy, confident and a little provocative'
  return 'very spicy and daring, bold and cheeky — but always tasteful, never explicit or crude'
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ReplyGenerator({ session }) {
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [tone, setTone] = useState('flirty')
  const [spice, setSpice] = useState(50)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [savedIndices, setSavedIndices] = useState([])
  const [copiedIndices, setCopiedIndices] = useState([])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    setReplies([])
    setSavedIndices([])
    setCopiedIndices([])
    setError('')
  }

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
    })

  const callGemini = async (messages, maxTokens = 700) => {
    const attemptCall = async () => {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages,
          max_tokens: maxTokens,
        }),
      })
      return response
    }

    let response = await attemptCall()

    if (response.status === 429) {
      setLoadingStep('Briefly rate limited, retrying...')
      await sleep(5000)
      response = await attemptCall()
    }

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`API error (${response.status}): ${errBody.slice(0, 200)}`)
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || ''
    return stripThinking(raw)
  }

  const getTranscript = async (base64Image, attempt) => {
    const strictness = attempt === 1
      ? ''
      : ' If the screenshot contains forwarded content, status updates, or embedded images, focus only on the actual typed chat messages (text bubbles), and ignore forwarded media previews or status content when identifying LEFT/RIGHT messages.'

    const transcriptRaw = await callGemini([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Transcribe this chat screenshot. This could be from any messaging app (WhatsApp, iMessage, Instagram DM, Messenger, Telegram, Snapchat, Tinder, SMS, or any other). List every real chat message bubble you can see, in top-to-bottom order.
For each one, output a line in this exact format:
LEFT: <message text>
or
RIGHT: <message text>

Determine LEFT vs RIGHT purely by which side of the screen the bubble is positioned on — ignore bubble color, since different apps use different color schemes.${strictness} Do not add commentary, do not summarize. Just the labeled list.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      },
    ], 800)

    const lines = transcriptRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('LEFT:') || l.startsWith('RIGHT:'))

    const lastLeftLine = [...lines].reverse().find((l) => l.startsWith('LEFT:'))
    const herLastMessage = lastLeftLine ? lastLeftLine.replace('LEFT:', '').trim() : null

    return { lines, herLastMessage }
  }

  const generateReplies = async () => {
    if (!image) return

    const usage = await consumeUsage(session)
    if (!usage.allowed) {
      setError(usage.message)
      return
    }

    setLoading(true)
    setError('')
    setReplies([])
    setCopiedIndices([])

    try {
      const base64Image = await toBase64(image)

      setLoadingStep('Reading the conversation...')
      let { lines, herLastMessage } = await getTranscript(base64Image, 1)

      if (!herLastMessage) {
        setLoadingStep('Having another look...')
        const retry = await getTranscript(base64Image, 2)
        lines = retry.lines
        herLastMessage = retry.herLastMessage
      }

      if (!herLastMessage) {
        throw new Error('Could not read this conversation clearly. Works best with a normal back-and-forth chat screenshot — try cropping out forwarded status updates or media previews.')
      }

      setLoadingStep('Writing replies...')
      const replyRaw = await callGemini([
        {
          role: 'user',
          content: `Here is a chat transcript for context:
${lines.join('\n')}

The other person's most recent message is: "${herLastMessage}"

Write 3 different reply options, in a ${tone} tone, that directly and naturally respond to that message, fitting the flow of the conversation.

Intensity level for these replies: ${spiceDescriptor(spice)}.

Return ONLY a JSON array of exactly 3 strings. No markdown, no explanation, just the array.`,
        },
      ], 500)

      const clean = replyRaw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setReplies(parsed)
    } catch (err) {
      setError(err.message || 'Failed to generate replies. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const saveReply = async (index, content) => {
    if (!session) return
    const { error } = await supabase.from('saved_items').insert({
      user_id: session.user.id,
      type: 'Reply Generator',
      content,
    })
    if (!error) setSavedIndices((prev) => [...prev, index])
  }

  const copyReply = async (index, content) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndices((prev) => [...prev, index])
      setTimeout(() => {
        setCopiedIndices((prev) => prev.filter((i) => i !== index))
      }, 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const spiceLabel = spice <= 20 ? 'Mild' : spice <= 40 ? 'Warm' : spice <= 60 ? 'Flirty' : spice <= 80 ? 'Bold' : 'Spicy 🌶️'

  return (
    <div>
      <div className="brand">Reply Generator</div>
      <div className="subtext">Upload a chat screenshot from any app, pick a vibe, get replies.</div>

      <div className="section-label">1. Upload screenshot</div>
      <div className="upload-zone">
        {imagePreview ? (
          <img src={imagePreview} alt="preview" className="preview-img" />
        ) : (
          <>
            <div className="upload-icon">⬆️</div>
            <div className="upload-title">Click to upload or drag and drop</div>
            <div className="upload-hint">Works best with a normal back-and-forth chat — not status updates or forwards</div>
          </>
        )}
        <label className="upload-label">
          {imagePreview ? 'Change image' : 'Upload your image'}
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </label>
      </div>

      <div className="section-label">2. Choose the vibe</div>
      <div className="tone-grid">
        {TONES.map((t) => (
          <div
            key={t.key}
            className={`tone-card ${tone === t.key ? 'selected' : ''}`}
            onClick={() => setTone(t.key)}
          >
            <span className="tone-emoji">{t.emoji}</span>
            {t.label}
          </div>
        ))}
      </div>

      <div className="section-label">3. Adjust the spice level — {spiceLabel}</div>
      <input
        type="range"
        min="0"
        max="100"
        value={spice}
        onChange={(e) => setSpice(Number(e.target.value))}
        className="spice-slider"
      />
      <div className="spice-labels">
        <span>Sweet</span>
        <span>Spicy 🌶️</span>
      </div>

      <button
        className="btn-gradient"
        onClick={generateReplies}
        disabled={!image || loading}
      >
        {loading ? loadingStep || 'Generating...' : '✨ Generate Replies ✨'}
      </button>

      {error && <p className="error-text">{error}</p>}

      {replies.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {replies.map((reply, i) => (
            <div key={i} className="reply-card">
              {reply}
              <div className="reply-card-actions">
                <button
                  className={`copy-btn ${copiedIndices.includes(i) ? 'copied' : ''}`}
                  onClick={() => copyReply(i, reply)}
                >
                  {copiedIndices.includes(i) ? '✓ Copied' : '📋 Copy'}
                </button>
                <button
                  className={`save-btn ${savedIndices.includes(i) ? 'saved' : ''}`}
                  onClick={() => saveReply(i, reply)}
                  disabled={savedIndices.includes(i)}
                >
                  {savedIndices.includes(i) ? '✓ Saved' : '💾 Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
        }
