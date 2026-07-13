import { supabase } from './supabaseClient'

export const OWNER_EMAIL = 'samoladimeji098@gmail.com'
const DAILY_LIMIT = 20

export async function consumeUsage(session) {
  if (!session) return { allowed: false, message: 'Please log in.' }
  if (session.user.email === OWNER_EMAIL) return { allowed: true }

  const today = new Date().toISOString().slice(0, 10)
  const userId = session.user.id

  const { data: existing } = await supabase
    .from('usage_counters')
    .select('*')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .maybeSingle()

  if (!existing) {
    await supabase.from('usage_counters').insert({ user_id: userId, usage_date: today, count: 1 })
    return { allowed: true }
  }

  if (existing.count >= DAILY_LIMIT) {
    return { allowed: false, message: `Daily limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` }
  }

  await supabase
    .from('usage_counters')
    .update({ count: existing.count + 1 })
    .eq('id', existing.id)

  return { allowed: true }
}
