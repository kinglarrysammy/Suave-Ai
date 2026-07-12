import { useState, useEffect } from 'react'

export default function OnboardingModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('suave_onboarded')
    if (!seen) setShow(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem('suave_onboarded', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="feedback-overlay" onClick={dismiss}>
      <div className="feedback-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-label">Welcome to Suave</div>
        <p className="subtext" style={{ marginBottom: 14 }}>Quick guide to the 4 tabs:</p>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>↩️ Reply</p>
          <p className="subtext" style={{ marginBottom: 0 }}>Upload a chat screenshot, get suggested replies.</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>💘 Coach</p>
          <p className="subtext" style={{ marginBottom: 0 }}>Talk through a dating situation — approaching someone, texting, DMs.</p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>✨ Assistant</p>
          <p className="subtext" style={{ marginBottom: 0 }}>General questions, image analysis, and AI image generation.</p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>🔖 Saved</p>
          <p className="subtext" style={{ marginBottom: 0 }}>Everything you've saved from the other tabs.</p>
        </div>

        <button className="btn-primary" onClick={dismiss} style={{ width: '100%' }}>
          Got it
        </button>
      </div>
    </div>
  )
}
