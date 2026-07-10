import { useState, useRef, useEffect } from 'react'
import { useSpeechToText } from './useSpeechToText'
import { getLatestConversation, listConversations, getConversation, saveConversation, deleteConversation } from './conversationStore'

const SYSTEM_PROMPT =
  'You are a helpful, knowledgeable general-purpose assistant. Answer questions on any topic clearly and accurately. If the user sends an image, look at it carefully and answer based on what you actually see in it. Keep responses concise unless the user asks for detail.'

export default function AIAssistant({ session }) {
  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const { isListening, error: micError, startListening, stopListening } = useSpeechToText()

  useEffect(() => {
    if (!session) return
    getLatestConversation(session.user.id, 'assistant').then((convo) => {
      if (convo) {
        setMessages(convo.messages || [])
        setConversationId(convo.id)
      }
    })
  }, [session])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const persist = async (updatedMessages) => {
    if (!session) return
    const { id } = await saveConversation({
      id: conversationId,
      userId: session.user.id,
      mode: 'assistant',
      messages: updatedMessages,
    })
    if (id && !conversationId) setConversationId(id)
  }

  const startNewChat = () => {
    setMessages([])
    setConversationId(null)
    setImage(null)
    setImagePreview(null)
    setShowHistory(false)
  }

  const openHistory = async () => {
    if (!showHistory && session) {
      const list = await listConversations(session.user.id, 'assistant')
      setHistory(list)
    }
    setShowHistory(!showHistory)
  }

  const loadOldChat = async (id) => {
    const convo = await getConversation(id)
    if (convo) {
      setMessages(convo.messages || [])
      setConversationId(convo.id)
    }
    setShowHistory(false)
  }

  const deleteOldChat = async (e, id) => {
    e.stopPropagation()
    await deleteConversation(id)
    setHistory((prev) => prev.filter((h) => h.id !== id))
    if (id === conversationId) {
      setMessages([])
      setConversationId(null)
    }
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
      return
    }
    startListening((transcript) => {
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
    })
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
    })

  const sendMessage = async () => {
    if ((!input.trim() && !image) || loading) return
    setLoading(true)
    setError('')

    const userContent = input.trim() || 'Take a look at this.'
    let apiContent = userContent

    try {
      if (image) {
        const base64Image = await toBase64(image)
        apiContent = [
          { type: 'text', text: userContent },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ]
      }

      const userMessage = { role: 'user', content: userContent }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)
      setInput('')
      setImage(null)
      setImagePreview(null)

      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: apiContent },
      ]

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: apiMessages,
          max_tokens: 700,
        }),
      })

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not respond.'
      const finalMessages = [...newMessages, { role: 'assistant', content: reply }]
      setMessages(finalMessages)
      persist(finalMessages)
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
    <div className="chat-page">
      <div className="brand">✨ AI Assistant</div>
      <div className="subtext">Ask anything, or send an image and ask about it.</div>

      <div className="chat-toolbar">
        <button className="btn-secondary" onClick={startNewChat}>+ New Chat</button>
        <button className="btn-secondary" onClick={openHistory}>🕐 History</button>
      </div>

      {showHistory && (
        <div className="history-panel">
          {history.length === 0 && <p className="history-empty">No past conversations yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="history-item" onClick={() => loadOldChat(h.id)}>
              <span style={{ flex: 1 }}>{h.title || 'Conversation'}</span>
              <button className="delete-history-btn" onClick={(e) => deleteOldChat(e, h.id)}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">✨</span>
            Ask me anything, or attach a photo and ask a question about it.
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

      {imagePreview && (
        <div className="attach-preview">
          <img src={imagePreview} alt="attached" />
          <span>Image attached</span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}
            onClick={() => { setImage(null); setImagePreview(null) }}
          >
            Remove
          </button>
        </div>
      )}

      <div className="chat-input-row">
        <label className="attach-btn">
          📎
          <input type="file" accept="image/*" onChange={handleImageSelect} />
        </label>
        <button
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={handleMicClick}
          type="button"
        >
          🎤
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={(!input.trim() && !image) || loading}
        >
          ➤
        </button>
      </div>
    </div>
  )
    }
