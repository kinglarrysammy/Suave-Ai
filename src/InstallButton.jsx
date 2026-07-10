import { useState, useEffect } from 'react'

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua))

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (dismissed) return null
  if (!deferredPrompt && !isIOS) return null

  return (
    <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>Install Suave</div>
        <div className="subtext" style={{ marginBottom: 0, fontSize: 12 }}>
          {isIOS ? 'Tap Share, then "Add to Home Screen"' : 'Add to your home screen for quick access'}
        </div>
      </div>
      {!isIOS && (
        <button className="btn-primary" onClick={handleInstall}>Install</button>
      )}
      {isIOS && (
        <button className="btn-secondary" onClick={() => setDismissed(true)}>Got it</button>
      )}
    </div>
  )
          }
