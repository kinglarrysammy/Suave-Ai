import { useState, useRef, useEffect } from 'react'
import { useSpeechToText } from './useSpeechToText'

const SYSTEM_PROMPT =
  'You are a supportive, insightful dating coach. Help the user navigate their dating life, decode texts, understand relationship dynamics, and build confidence. Keep responses concise, practical, and encouraging. Stay strictly focused on dating and relationships — do not answer unrelated general knowledge questions.'

export default function DatingCoach() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const { isListening, error: micError, startListening, stopListening } = useSpeechToText()

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
      return
    }
    startListening((transcript) => {
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
    })
  }

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

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">💘</span>
            Ask me anything about your dating life.
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
      {micError && <p className="error-text">{micError}</p>}

      <div className="chat-input-row">
        <button
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={handleMicClick}
          type="button"
        >
          🎤
        </button>
        <input
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
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
