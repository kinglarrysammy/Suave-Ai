export function stripThinking(raw) {
  if (!raw) return raw
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const idx = cleaned.indexOf('<think>')
  if (idx !== -1) {
    cleaned = cleaned.slice(0, idx)
  }
  return cleaned.trim()
}
