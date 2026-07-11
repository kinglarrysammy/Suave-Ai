import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function FeedbackButton({ session }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim() || !session) return
    setSubmitting(true)
    const { error } = await supabase.from('feedback').insert({
      user_id: session.user.id,
      message: message.trim(),
    })
    setSubmitting(false)
    if (!error) {
      setSubmitted(true)
      setMessage('')
      setTimeout(() => {
        setSubmitted(false)
        setOpen(false)
      }, 1500)
    }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)} style={{ padding: '10px 12px' }}>
        💬
      </button>

      {open && (
        <div className="feedback-overlay" onClick={() => setOpen(false)}>
          <div className="feedback-card" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <p style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 600 }}>
                ✓ Thanks for the feedback!
              </p>
            ) : (
              <>
                <div className="section-label">Send Feedback</div>
                <p className="subtext">Found a bug? Have a suggestion? Let me know.</p>
                <textarea
                  placeholder="Type your feedback here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" onClick={() => setOpen(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    style={{ flex: 1 }}
                  >
                    {submitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
          }
