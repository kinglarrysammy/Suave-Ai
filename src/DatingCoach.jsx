import { useState, useRef, useEffect } from 'react'

const SYSTEM_PROMPT =
  'You are a supportive, insightful dating coach. Help the user navigate their dating life, decode texts, understand relationship dynamics, and build confidence. Keep responses concise, practical, and encouraging. Stay strictly focused on dating and relationships — do not answer unrelated general knowledge questions.'

export default function DatingCoach() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newMessages],
          max_tokens: 600,
        }),
      })

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not respond.'
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (err) {
      setError('Failed to get a response. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div>
      <div className="brand">💘 Dating Coach</div>
      <div className="subtext">Advice, texting help, and confidence — dating only.</div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 14,
          height: 400,
          overflowY: 'auto',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <p className="subtext" style={{ textAlign: 'center', marginTop: 40 }}>
            Ask me anything about your dating life.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.role === 'user' ? 'var(--gold-soft)' : 'var(--surface-hover)',
              color: m.role === 'user' ? 'var(--gold)' : 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic' }}>
            Typing...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-primary"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{ flexShrink: 0 }}
        >
          Send
        </button>
      </div>
    </div>
  )
                                       }
