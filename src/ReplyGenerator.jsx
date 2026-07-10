import { useState } from 'react'
import { supabase } from './supabaseClient'

const TONES = [
  { key: 'flirty', emoji: '😏', label: 'Flirty' },
  { key: 'funny', emoji: '😂', label: 'Funny' },
  { key: 'confident', emoji: '🔥', label: 'Confident' },
  { key: 'casual', emoji: '💬', label: 'Casual' },
]

export default function ReplyGenerator({ session }) {
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [tone, setTone] = useState('flirty')
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [savedIndices, setSavedIndices] = useState([])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    setReplies([])
    setSavedIndices([])
    setError('')
  }

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
    })

  const callGroq = async (messages, maxTokens = 500) => {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages,
        max_tokens: maxTokens,
      }),
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  const generateReplies = async () => {
    if (!image) return
    setLoading(true)
    setError('')
    setReplies([])

    try {
      const base64Image = await toBase64(image)

      setLoadingStep('Reading the conversation...')
      const transcriptRaw = await callGroq([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Transcribe this chat screenshot. List every message bubble you can see, in top-to-bottom order.
For each one, output a line in this exact format:
LEFT: <message text>
or
RIGHT: <message text>

Use LEFT for messages aligned to the left side of the screen, and RIGHT for messages aligned to the right side of the screen (usually green/blue bubbles). Do not add commentary, do not summarize, do not skip any message. Just the labeled list.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ], 600)

      if (!transcriptRaw.trim()) {
        throw new Error('Could not read the conversation from the image.')
      }

      const lines = transcriptRaw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('LEFT:') || l.startsWith('RIGHT:'))

      const lastLeftLine = [...lines].reverse().find((l) => l.startsWith('LEFT:'))
      const herLastMessage = lastLeftLine
        ? lastLeftLine.replace('LEFT:', '').trim()
        : null

      if (!herLastMessage) {
        throw new Error('Could not identify the other person\'s message. Try a clearer screenshot.')
      }

      setLoadingStep('Writing replies...')
      const replyRaw = await callGroq([
        {
          role: 'user',
          content: `Here is a chat transcript for context:
${lines.join('\n')}

The other person's most recent message is: "${herLastMessage}"

Write 3 different reply options, in a ${tone} tone, that directly and naturally respond to that message, fitting the flow of the conversation.

Return ONLY a JSON array of exactly 3 strings. No markdown, no explanation.`,
          },
        ],
        500,
      )

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

  return (
    <div>
      <div className="brand">Reply Generator</div>
      <div className="subtext">Upload a chat screenshot, pick a vibe, get replies.</div>

      <div className="section-label">1. Upload screenshot</div>
      <div className="upload-zone">
        {imagePreview ? (
          <img src={imagePreview} alt="preview" className="preview-img" />
        ) : (
          <>
            <div className="upload-icon">⬆️</div>
            <div className="upload-title">Click to upload or drag and drop</div>
            <div className="upload-hint">PNG, JPG up to 10MB</div>
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
              <div>
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
