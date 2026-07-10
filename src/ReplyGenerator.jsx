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
                  text: `This is a screenshot of a chat conversation (WhatsApp, iMessage, or similar). Bubble alignment tells you who is who:
- Bubbles aligned to the RIGHT side of the screen (usually green or blue) = messages sent BY THE APP USER (the person asking for help). This is NOT the person they are texting.
- Bubbles aligned to the LEFT side of the screen (usually white or gray) = messages from THE OTHER PERSON the user is texting.

Your job: read the most recent message from THE OTHER PERSON (left-aligned, last one at the bottom of the visible chat) and generate 3 reply options that THE APP USER (right-aligned sender) could send back, in a ${tone} tone. The replies should directly respond to what the other person just said — matching the context and mood of the conversation, not contradicting or arguing with the user's own earlier messages.

Return ONLY a JSON array of 3 strings, nothing else, no markdown formatting, no explanation.`,
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
        {imagePreview && <img src={imagePreview} alt="preview" className="preview-img" />}
        {!imagePreview && <p>📤 No image selected yet</p>}
        <label className="upload-label">
          Upload your image
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </label>
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
