import { useState, useRef, useEffect } from 'react'
import { useSpeechToText } from './useSpeechToText'
import { supabase } from './supabaseClient'
import { getLatestConversation, listConversations, getConversation, saveConversation } from './conversationStore'

const SYSTEM_PROMPT = `You are a supportive, insightful dating coach. Your job is to help the user with real dating situations — approaching a crush, texting someone new, DMing someone on social media, keeping a conversation going, or figuring out if someone is interested.

Important: Do not immediately generate lines or advice on the first message if the situation is unclear. First ask 1-3 short clarifying questions to understand: who the person is (how they know them, what platform), what the user's goal is (start a conversation, ask them out, keep it going), and what vibe they want (playful, sincere, confident). Once you have enough context, give clear, practical advice and, if relevant, 2-3 example messages the user could send.

Keep every response concise and conversational. Stay strictly focused on dating and relationships — do not answer unrelated general knowledge questions.`

export default function DatingCoach({ session }) {
  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedIndices, setSavedIndices] = useState([])
  const scrollRef = useRef(null)
  const { isListening, error: micError, startListening, stopListening } = useSpeechToText()

  useEffect(() => {
    if (!session) return
    getLatestConversation(session.user.id, 'coach').then((convo) => {
      if (convo) {
        setMessages(convo.messages || [])
        setConversationId(convo.id)
      }
    })
  }, [session])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const persist = async (updatedMessages) => {
    if (!session) return
    const { id } = await saveConversation({
      id: conversationId,
      userId: session.user.id,
      mode: 'coach',
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
      const list = await listConversations(session.user.id, 'coach')
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

    let userContent = input.trim() || 'Take a look at this.'
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

  const saveMessage = async (index, content) => {
    if (!session) return
    const { error } = await supabase.from('saved_items').insert({
      user_id: session.user.id,
      type: 'Dating Coach',
      content,
    })
    if (!error) setSavedIndices((prev) => [...prev, index])
  }

  return (
    <div className="chat-page">
      <div className="brand">💘 Dating Coach</div>
      <div className="subtext" style={{ marginBottom: 10 }}>
        Have a crush but don't know how to approach? Tell me the situation and I'll help you
        craft the right message.
      </div>

      <div className="chat-toolbar">
        <button className="btn-secondary" onClick={startNewChat}>+ New Chat</button>
        <button className="btn-secondary" onClick={openHistory}>🕐 History</button>
      </div>

      {showHistory && (
        <div className="history-panel">
          {history.length === 0 && <p className="history-empty">No past conversations yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="history-item" onClick={() => loadOldChat(h.id)}>
              {h.title || 'Conversation'}
            </div>
          ))}
        </div>
      )}

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">💘</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`chat-bubble ${m.role}`}>{m.content}</div>
            {m.role === 'assistant' && (
              <button
                className={`save-btn ${savedIndices.includes(i) ? 'saved' : ''}`}
                onClick={() => saveMessage(i, m.content)}
                disabled={savedIndices.includes(i)}
              >
                {savedIndices.includes(i) ? '✓ Saved' : '💾 Save'}
              </button>
            )}
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
        <input
          placeholder={isListening ? 'Listening...' : 'Tell me the situation...'}
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
