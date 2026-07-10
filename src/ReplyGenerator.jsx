import { useState } from 'react'

const TONES = [
  { key: 'flirty', label: '😏 Flirty' },
  { key: 'funny', label: '😂 Funny' },
  { key: 'confident', label: '🔥 Confident' },
  { key: 'casual', label: '💬 Casual' },
]

export default function ReplyGenerator() {
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [tone, setTone] = useState('flirty')
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    setReplies([])
    setError('')
  }

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
    })

  const generateReplies = async () => {
    if (!image) return
    setLoading(true)
    setError('')
    setReplies([])

    try {
      const base64Image = await toBase64(image)

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a dating conversation assistant. Look at this chat screenshot and generate 3 different reply options in a ${tone} tone. Return ONLY a JSON array of 3 strings, nothing else, no markdown formatting.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
      })

      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setReplies(parsed)
    } catch (err) {
      setError('Failed to generate replies. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="brand">Reply Generator</div>
      <div className="subtext">Upload a chat screenshot, pick a vibe, get replies.</div>

      <div className="upload-zone">
        {imagePreview ? (
          <img src={imagePreview} alt="preview" className="preview-img" />
        ) : (
          <p>📤 Drop or choose a screenshot</p>
        )}
        <input type="file" accept="image/*" onChange={handleImageChange} />
      </div>

      <div className="tone-grid">
        {TONES.map((t) => (
          <div
            key={t.key}
            className={`tone-card ${tone === t.key ? 'selected' : ''}`}
            onClick={() => setTone(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <button
        className="btn-primary"
        onClick={generateReplies}
        disabled={!image || loading}
        style={{ width: '100%', padding: '14px' }}
      >
        {loading ? 'Generating...' : 'Generate Replies'}
      </button>

      {error && <p className="error-text">{error}</p>}

      {replies.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {replies.map((reply, i) => (
            <div key={i} className="reply-card">
              {reply}
            </div>
          ))}
        </div>
      )}
    </div>
  )
        }
