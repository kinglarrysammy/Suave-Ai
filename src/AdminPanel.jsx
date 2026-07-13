import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('feedback')
  const [feedback, setFeedback] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const { data: fb } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
    const { data: req } = await supabase
      .from('account_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setFeedback(fb || [])
    setRequests(req || [])
    setLoading(false)
  }

  const handleOpen = () => {
    setOpen(true)
    loadData()
  }

  const dismissFeedback = async (id) => {
    await supabase.from('feedback').delete().eq('id', id)
    setFeedback((prev) => prev.filter((f) => f.id !== id))
  }

  const dismissRequest = async (id) => {
    await supabase.from('account_requests').delete().eq('id', id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <>
      <button className="btn-secondary" onClick={handleOpen} style={{ padding: '10px 12px' }}>
        🛠️
      </button>

      {open && (
        <div className="feedback-overlay" onClick={() => setOpen(false)}>
          <div className="feedback-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            <div className="section-label">Admin Panel</div>

            <div className="mode-grid" style={{ marginBottom: 14 }}>
              <div
                className={`tone-card ${tab === 'feedback' ? 'selected' : ''}`}
                onClick={() => setTab('feedback')}
              >
                💬 Feedback ({feedback.length})
              </div>
              <div
                className={`tone-card ${tab === 'requests' ? 'selected' : ''}`}
                onClick={() => setTab('requests')}
              >
                🗑️ Requests ({requests.length})
              </div>
            </div>

            {loading && <p className="subtext">Loading...</p>}

            {!loading && tab === 'feedback' && (
              <>
                {feedback.length === 0 && <p className="subtext">No feedback yet.</p>}
                {feedback.map((f) => (
                  <div key={f.id} className="card">
                    <p style={{ fontSize: 13, marginBottom: 8 }}>{f.message}</p>
                    <p className="subtext" style={{ marginBottom: 8 }}>
                      {new Date(f.created_at).toLocaleString()}
                    </p>
                    <button className="btn-secondary" onClick={() => dismissFeedback(f.id)}>
                      Dismiss
                    </button>
                  </div>
                ))}
              </>
            )}

            {!loading && tab === 'requests' && (
              <>
                {requests.length === 0 && <p className="subtext">No account requests.</p>}
                {requests.map((r) => (
                  <div key={r.id} className="card">
                    <p style={{ fontSize: 13, marginBottom: 4 }}>
                      Type: <strong>{r.type}</strong>
                    </p>
                    <p className="subtext" style={{ marginBottom: 4 }}>User ID: {r.user_id}</p>
                    <p className="subtext" style={{ marginBottom: 8 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <button className="btn-secondary" onClick={() => dismissRequest(r.id)}>
                      Mark Handled
                    </button>
                  </div>
                ))}
              </>
            )}

            <button className="btn-primary" onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 10 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
                    }
