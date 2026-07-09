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

  if (loading) return <p style={{ padding: 20 }}>Loading saved items...</p>

  return (
    <div style={{ padding: 20 }}>
      <h2>Saved</h2>
      {items.length === 0 && <p>No saved items yet.</p>}
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: '1px solid #333',
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.type}</p>
          <p>{item.content}</p>
          <button onClick={() => deleteItem(item.id)} style={{ marginTop: 8 }}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
      }
