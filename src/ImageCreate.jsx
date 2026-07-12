import { useState } from 'react'
import { supabase } from './supabaseClient'

const STYLES = [
  { key: 'realistic', emoji: '📷', label: 'Realistic' },
  { key: 'cinematic', emoji: '🎬', label: 'Cinematic' },
  { key: 'anime', emoji: '🎨', label: 'Anime' },
  { key: 'fantasy', emoji: '✨', label: 'Fantasy Art' },
]

const STYLE_HINTS = {
  realistic: 'photorealistic, shot on a professional DSLR camera, natural lighting, sharp focus, 8k resolution, highly detailed skin and textures',
  cinematic: 'cinematic lighting, dramatic composition, film grain, wide aspect ratio, moody color grading, shot like a movie still, 8k',
  anime: 'anime art style, clean line art, vibrant colors, studio-quality cel shading, detailed background, trending anime illustration',
  fantasy: 'fantasy digital painting, epic composition, dramatic lighting, intricate detail, concept art quality, trending on artstation',
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ImageCreate({ session }) {
  const [idea, setIdea] = useState('')
  const [style, setStyle] = useState('realistic')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const checkImageLoads = (url) =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })

  const generateImage = async () => {
    if (!idea.trim() || loading) return
    setLoading(true)
    setError('')
    setImageUrl('')
    setSaved(false)

    try {
      setLoadingStep('Crafting your prompt...')

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
              content: `You are an expert AI art prompt engineer. Take this simple image idea and rewrite it into a single, highly detailed, professional-grade prompt for an AI image generator.

Idea: "${idea.trim()}"
Desired style: ${STYLE_HINTS[style]}

Include specifics on: subject and pose, composition and framing, lighting, color palette, and quality boosters appropriate for the style. Output ONLY the final descriptive prompt text, nothing else — no preamble, no quotes, no explanation.`,
            },
          ],
          max_tokens: 300,
        }),
      })

      const data = await response.json()
      const finalPrompt = data.choices?.[0]?.message?.content?.trim() || idea.trim()

      let attempt = 0
      let success = false

      while (attempt < 3 && !success) {
        attempt++
        setLoadingStep(attempt === 1 ? 'Generating your image...' : `Server busy, retrying (${attempt}/3)...`)

        const seed = Math.floor(Math.random() * 1000000)
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`

        const loaded = await checkImageLoads(url)

        if (loaded) {
          setImageUrl(url)
          success = true
        } else if (attempt < 3) {
          await sleep(3000)
        }
      }

      if (!success) {
        throw new Error('The image server is busy right now. Please try again in a moment.')
      }
    } catch (err) {
      setError(err.message || 'Failed to generate image. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const saveImage = async () => {
    if (!session || !imageUrl) return
    const { error } = await supabase.from('saved_items').insert({
      user_id: session.user.id,
      type: 'AI Image',
      content: imageUrl,
    })
    if (!error) setSaved(true)
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <div className="brand">🎨 Create Image</div>
      <div className="subtext">Describe what you want, pick a style, get a polished result.</div>

      <div className="section-label">1. Describe your idea</div>
      <textarea
        placeholder="e.g. a lion standing on a cliff at sunset"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={3}
        style={{ marginBottom: 20, resize: 'vertical' }}
        disabled={loading}
      />

      <div className="section-label">2. Choose a style</div>
      <div className="tone-grid">
        {STYLES.map((s) => (
          <div
            key={s.key}
            className={`tone-card ${style === s.key ? 'selected' : ''}`}
            onClick={() => !loading && setStyle(s.key)}
            style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
          >
            <span className="tone-emoji">{s.emoji}</span>
            {s.label}
          </div>
        ))}
      </div>

      <button
        className="btn-gradient"
        onClick={generateImage}
        disabled={!idea.trim() || loading}
      >
        {loading ? loadingStep || 'Generating...' : '✨ Generate Image ✨'}
      </button>

      <p className="subtext" style={{ marginTop: 10, textAlign: 'center' }}>
        Uses a free image server — can take 10-30 seconds, sometimes longer during busy periods.
      </p>

      {error && <p className="error-text">{error}</p>}

      {imageUrl && (
        <div className="card" style={{ marginTop: 20 }}>
          <img
            src={imageUrl}
            alt="Generated"
            style={{ width: '100%', borderRadius: 12, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
            >
              Open Full Size
            </a>
            <button
              className={saved ? 'btn-secondary' : 'btn-primary'}
              onClick={saveImage}
              disabled={saved}
              style={{ flex: 1 }}
            >
              {saved ? '✓ Saved' : '💾 Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
          }
