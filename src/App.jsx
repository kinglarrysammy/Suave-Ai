import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SavedTab from './SavedTab'
import ReplyGenerator from './ReplyGenerator'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('reply')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSignUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Check your email to confirm signup.')
    setLoading(false)
  }

  const handleSignIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : '')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (session) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Suave</h1>
        <p>Logged in as {session.user.email}</p>
        <button onClick={handleLogout}>Log out</button>

        <div style={{ margin: '20px 0', display: 'flex', gap: 10 }}>
          <button onClick={() => setActiveTab('reply')} disabled={activeTab === 'reply'}>
            Reply Generator
          </button>
          <button onClick={() => setActiveTab('saved')} disabled={activeTab === 'saved'}>
            Saved
          </button>
        </div>

        <hr style={{ margin: '20px 0' }} />

        {activeTab === 'reply' && <ReplyGenerator />}
        {activeTab === 'saved' && <SavedTab session={session} />}
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h1>Suave</h1>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 10, padding: 10 }}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: 10, padding: 10 }}
      />
      <button onClick={handleSignIn} disabled={loading} style={{ marginRight: 10 }}>
        Log In
      </button>
      <button onClick={handleSignUp} disabled={loading}>
        Sign Up
      </button>
      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  )
          }
