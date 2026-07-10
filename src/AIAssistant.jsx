import { useState, useRef, useEffect } from 'react'

const SYSTEM_PROMPT =
  'You are a helpful, knowledgeable general-purpose assistant. Answer questions on any topic clearly and accurately. Keep responses concise unless the user asks for detail.'

export default function AIAssistant() {
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
      <div className="brand">✨ AI Assistant</div>
      <div className="subtext">Ask anything — general knowledge and information.</div>

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">✨</span>
            Ask me anything.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-typing">Typing...</div>}
        <div ref={scrollRef} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="chat-input-row">
        <input
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
