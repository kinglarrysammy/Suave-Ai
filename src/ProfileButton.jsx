import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ProfileButton({ session }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleChangePassword = async () => {
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    setMessage(error ? error.message : 'Check your email for a password reset link.')
  }

  const handleDeleteRequest = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setLoading(true)
    const { error } = await supabase.from('account_requests').insert({
      user_id: session.user.id,
      type: 'delete',
    })
    setLoading(false)
    if (!error) {
      setMessage('Deletion request submitted. This will be processed manually within a few days.')
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)} style={{ padding: '10px 12px' }}>
        👤
      </button>

      {open && (
        <div className="feedback-overlay" onClick={() => setOpen(false)}>
          <div className="feedback-card" onClick={(e) => e.stopPropagation()}>
            <div className="section-label">Account</div>
            <p className="subtext">{session.user.email}</p>

            <button
              className="btn-secondary"
              onClick={handleChangePassword}
              disabled={loading}
              style={{ width: '100%', marginBottom: 10 }}
            >
              Change Password
            </button>

            <button
              className="btn-secondary"
              onClick={handleDeleteRequest}
              disabled={loading}
              style={{ width: '100%', marginBottom: 10, color: 'var(--danger)' }}
            >
              {confirmDelete ? 'Tap again to confirm deletion' : 'Request Account Deletion'}
            </button>

            {message && <p className="subtext" style={{ marginBottom: 10 }}>{message}</p>}

            <button className="btn-primary" onClick={() => setOpen(false)} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
              }
