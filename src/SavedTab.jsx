import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function SavedTab({ session }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('saved_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setItems(data)
    setLoading(false)
  }

  const deleteItem = async (id) => {
    await supabase.from('saved_items').delete().eq('id', id)
    fetchItems()
  }

  return (
    <div>
      <div className="brand">Saved</div>
      <div className="subtext">Your saved replies, messages, and images.</div>

      {loading && <p className="subtext">Loading...</p>}
      {!loading && items.length === 0 && <p className="subtext">No saved items yet.</p>}

      {items.map((item) => (
        <div key={item.id} className="card">
          <p style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 6 }}>{item.type}</p>
          {item.type === 'AI Image' ? (
            <img
              src={item.content}
              alt="Saved"
              style={{ width: '100%', borderRadius: 10, marginBottom: 10 }}
            />
          ) : (
            <p style={{ marginBottom: 10 }}>{item.content}</p>
          )}
          <button className="btn-secondary" onClick={() => deleteItem(item.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
    }
