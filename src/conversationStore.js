import { supabase } from './supabaseClient'

export async function getLatestConversation(userId, mode) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}

export async function listConversations(userId, mode) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .eq('mode', mode)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data
}

export async function getConversation(id) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function saveConversation({ id, userId, mode, messages }) {
  const firstUserMsg = messages.find((m) => m.role === 'user')?.content || 'New conversation'
  const title = firstUserMsg.slice(0, 40)

  if (id) {
    const { error } = await supabase
      .from('conversations')
      .update({ messages, title, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { id, error }
  } else {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, mode, title, messages })
      .select()
      .single()
    return { id: data?.id, error }
  }
}

export async function deleteConversation(id) {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  return { error }
}
