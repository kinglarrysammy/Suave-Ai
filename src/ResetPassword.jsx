import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  const handleUpdate = async () => {
    if (!password.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: password.trim() })
    setLoading(false)
    if (error) {
      setMessage(error.message)
    } else {
      setDone(true)
      setMessage('Password updated. You can now use the app.')
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    }
  }

  return (
    <div className="app-shell" style={{ paddingTop: 60 }}>
      <div className="brand" style={{ fontSize: 28, textAlign: 'center' }}>Reset Password</div>
      <div className="subtext" style={{ textAlign: 'center', marginBottom: 24 }}>
        Enter a new password for your account.
      </div>
      <div className="card">
        <input
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: 14 }}
          disabled={done}
        />
        <button
          className="btn-primary"
          onClick={handleUpdate}
          disabled={!password.trim() || loading || done}
          style={{ width: '100%' }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
        {message && <p className="subtext" style={{ marginTop: 12 }}>{message}</p>}
      </div>
    </div>
  )
          }
