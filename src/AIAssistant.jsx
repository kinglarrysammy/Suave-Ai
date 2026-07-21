import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useSpeechToText } from './useSpeechToText'
import { getLatestConversation, listConversations, getConversation, saveConversation, deleteConversation } from './conversationStore'
import { consumeUsage } from './usageLimiter'
import { stripThinking } from './aiUtils'
import ImageCreate from './ImageCreate'

const SYSTEM_PROMPT =
  'You are a helpful, knowledgeable general-purpose assistant. Answer questions on any topic clearly and accurately. If the user sends an image, look at it carefully and answer based on what you actually see in it. Format your responses clearly using markdown: short paragraphs, line breaks between ideas, and bullet points or numbered lists when helpful. Do not write everything as one dense block of text. Keep responses concise unless the user asks for detail.'

export default function AIAssistant({ session }) {
  const [view, setView] = useState('chat')
  const [messages, setMessages] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [images, setImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
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
    setImages([])
    setImagePreviews([])
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

  const addFiles = (fileList) => {
    const files = Array.from(fileList)
    setImages((prev) => [...prev, ...files])
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
  }

  const handleGallerySelect = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleCameraCapture = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
    })

  const sendMessage = async () => {
    if ((!input.trim() && images.length === 0) || loading) return

    const usage = await consumeUsage(session)
    if (!usage.allowed) {
      setError(usage.message)
      return
    }

    setLoading(true)
    setError('')

    const hasImages = images.length > 0
    const model = hasImages ? 'qwen/qwen3.6-27b' : 'openai/gpt-oss-120b'
    const userContent = input.trim() || 'Take a look at this.'
    let apiContent = userContent

    try {
      if (hasImages) {
        const base64Images = await Promise.all(images.map(toBase64))
        apiContent = [
          { type: 'text', text: userContent },
          ...base64Images.map((b64) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${b64}` },
          })),
        ]
      }

      const userMessage = { role: 'user', content: userContent }
      const newMessages = [...messages, userMessage]
      setMessages([...newMessages, { role: 'assistant', content: '' }])
      setInput('')
      setImages([])
      setImagePreviews([])

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
          model,
          messages: apiMessages,
          max_tokens: 1000,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        if (response.status === 429) {
          throw new Error('Rate limit reached. Wait about 15-20 seconds and try again.')
        }
        throw new Error(`API error (${response.status}): ${errBody.slice(0, 200)}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let rawText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue

          try {
            const json = JSON.parse(payload)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              rawText += delta
              const visible = stripThinking(rawText)
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: visible }
                return updated
              })
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      const finalText = stripThinking(rawText)

      if (!finalText) {
        throw new Error('No response received from the AI. Try again in a moment.')
      }

      const finalMessages = [...newMessages, { role: 'assistant', content: finalText }]
      setMessages(finalMessages)
      persist(finalMessages)
    } catch (err) {
      setError(err.message || 'Failed to get a response. Try again.')
      setMessages((prev) => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.role === 'assistant' && !updated[updated.length - 1]?.content) {
          updated.pop()
        }
        return updated
      })
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
      <div className="mode-grid" style={{ marginBottom: 12 }}>
        <div
          className={`tone-card ${view === 'chat' ? 'selected' : ''}`}
          onClick={() => setView('chat')}
        >
          💬 Ask Anything
        </div>
        <div
          className={`tone-card ${view === 'image' ? 'selected' : ''}`}
          onClick={() => setView('image')}
        >
          🎨 Create Image
        </div>
      </div>

      {view === 'image' && <ImageCreate session={session} />}

      {view === 'chat' && (
        <>
          <div className="brand">✨ AI Assistant</div>
          <div className="subtext">Ask anything, or send images and ask about them.</div>

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
                Ask me anything, or attach photos and ask a question about them.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.role === 'assistant' ? <ReactMarkdown>{m.content || ' '}</ReactMarkdown> : m.content}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          {error && <p className="error-text">{error}</p>}
          {micError && <p className="error-text">{micError}</p>}

          {imagePreviews.length > 0 && (
            <div className="attach-preview-list">
              {imagePreviews.map((src, i) => (
                <div key={i} className="attach-thumb">
                  <img src={src} alt={`attached ${i}`} />
                  <button onClick={() => removeImage(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <label className="attach-btn">
              📎
              <input type="file" accept="image/*" multiple onChange={handleGallerySelect} />
            </label>
            <label className="attach-btn">
              📷
              <input type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} />
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
              disabled={(!input.trim() && images.length === 0) || loading}
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  )
        }
