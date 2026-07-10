import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SavedTab from './SavedTab'
import ReplyGenerator from './ReplyGenerator'
import DatingCoach from './DatingCoach'
import AIAssistant from './AIAssistant'
import InstallButton from './InstallButton'

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
      <div className="app-shell">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="brand" style={{ marginBottom: 0, fontSize: 22 }}>Suave</div>
          </div>
          <button className="btn-secondary" onClick={handleLogout}>Log out</button>
        </div>

        <InstallButton />

        <div className="navbar">
          <button className={activeTab === 'reply' ? 'active' : ''} onClick={() => setActiveTab('reply')}>
            <span className="nav-icon">↩️</span>
            Reply
          </button>
          <button className={activeTab === 'coach' ? 'active' : ''} onClick={() => setActiveTab('coach')}>
            <span className="nav-icon">💘</span>
            Coach
          </button>
          <button className={activeTab === 'assistant' ? 'active' : ''} onClick={() => setActiveTab('assistant')}>
            <span className="nav-icon">✨</span>
            Assistant
          </button>
          <button className={activeTab === 'saved' ? 'active' : ''} onClick={() => setActiveTab('saved')}>
            <span className="nav-icon">🔖</span>
            Saved
          </button>
        </div>

        {activeTab === 'reply' && <ReplyGenerator session={session} />}
        {activeTab === 'coach' && <DatingCoach session={session} />}
        {activeTab === 'assistant' && <AIAssistant />}
        {activeTab === 'saved' && <SavedTab session={session} />}
      </div>
    )
  }

  return (
    <div className="app-shell" style={{ paddingTop: 60 }}>
      <div className="brand" style={{ fontSize: 32, textAlign: 'center' }}>Suave</div>
      <div className="subtext" style={{ textAlign: 'center', marginBottom: 24 }}>
        Smooth conversations, smarter replies.
      </div>

      <div className="card">
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={handleSignIn} disabled={loading} style={{ flex: 1 }}>
            Log In
          </button>
          <button className="btn-secondary" onClick={handleSignUp} disabled={loading} style={{ flex: 1 }}>
            Sign Up
          </button>
        </div>
        {message && <p className="subtext" style={{ marginTop: 12 }}>{message}</p>}
      </div>
    </div>
  )
        }
