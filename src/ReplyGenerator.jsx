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

  const callGeminiOnce = async (messages, maxTokens) => {
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
      setLoadingStep('Reading and writing replies...')
      const base64Image = await toBase64(image)

      const prompt = `This is a chat screenshot (WhatsApp, iMessage, Instagram DM, or similar). Look at the conversation and find the most recent message from the OTHER person (not the app user's own messages — their own messages are on the RIGHT/green/blue side, the other person's are on the LEFT side).

Write 3 different reply options the app user could send back to that person's most recent message, in a ${tone} tone, fitting the flow of the conversation.

Intensity level for these replies: ${spiceDescriptor(spice)}. Keep it tasteful and appropriate — playful and confident, never explicit or crude.

Return ONLY a JSON array of exactly 3 strings, nothing else. No markdown, no explanation, no preamble — just the array, like ["reply one", "reply two", "reply three"]`

      let response = await callGeminiOnce([
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ], 600)

      if (response.status === 429) {
        setLoadingStep('Rate limited, retrying...')
        await sleep(6000)
        response = await callGeminiOnce([
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ], 600)
      }

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`API error (${response.status}): ${errBody.slice(0, 200)}`)
      }

      const data = await response.json()
      const rawContent = data.choices?.[0]?.message?.content || ''
      const finishReason = data.choices?.[0]?.finish_reason

      if (!rawContent.trim()) {
        if (finishReason === 'content_filter' || finishReason === 'safety') {
          throw new Error('The response was filtered. Try lowering the spice level or picking a different tone.')
        }
        throw new Error('No response received. Try again, or try a lower spice level.')
      }

      const cleaned = stripThinking(rawContent)
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      const jsonText = jsonMatch ? jsonMatch[0] : cleaned.replace(/```json|```/g, '').trim()

      const parsed = JSON.parse(jsonText)
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
            <div className="upload-hint">Works best with a normal back-and-forth chat</div>
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
