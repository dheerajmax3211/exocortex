'use client'

import React, { useState, useEffect } from 'react'
import Navigation from '@/components/ui/Navigation'

interface Entry {
  id: string
  text_content: string
  event_date: string
  created_at: string
  entities?: Array<{ id: string; name: string; type: string }>
}

export default function TimelinePage() {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState<string | null>(null)

  const fetchTimeline = async (filter?: string | null) => {
    setLoading(true)
    try {
      const url = filter ? `/api/timeline?search=${encodeURIComponent(filter)}` : '/api/timeline'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entriesByDate || {})
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialSearch = params.get('search')
    setSearchFilter(initialSearch)
    fetchTimeline(initialSearch)
  }, [])

  const handleClearFilter = () => {
    setSearchFilter(null)
    window.history.replaceState({}, '', '/timeline')
    fetchTimeline(null)
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-28 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif font-bold text-white">Timeline</h1>
        </div>

        {searchFilter && (
          <div className="mb-6 flex items-center justify-between p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
            <span className="text-xs font-mono text-indigo-300">
              Filtering memories matching: <strong className="text-white">&quot;{searchFilter}&quot;</strong>
            </span>
            <button 
              onClick={handleClearFilter}
              className="text-xs text-white/60 hover:text-white underline ml-4"
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-white/50 font-mono text-sm">Loading memories...</div>
        ) : Object.keys(entries).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/50 text-center bg-[#12121c] rounded-2xl border border-white/10 p-8">
            <p className="text-lg mb-2 text-white">No memories found.</p>
            <p className="text-xs text-white/40">Try clearing the search filter or record a new memory.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(entries).map(([date, dayEntries]) => (
              <div key={date} className="relative">
                <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur py-4 border-b border-white/10 mb-6">
                  <h2 className="text-base font-serif font-semibold text-white/90">
                    {date === 'Undated' ? 'Undated Memories' : new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h2>
                </div>
                <div className="space-y-4">
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="bg-[#12121c] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors shadow-sm">
                      <p className="text-white/80 whitespace-pre-wrap leading-relaxed text-sm">{entry.text_content}</p>
                      
                      {entry.entities && entry.entities.length > 0 && (
                        <div className="mt-3 flex gap-1.5 flex-wrap">
                          {entry.entities.map(ent => (
                            <a
                              key={ent.id}
                              href={`/?focus=${ent.id}`}
                              className="text-[10px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white px-2 py-0.5 rounded-full transition-colors"
                            >
                              {ent.name}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
                        <span>
                          {new Date(entry.created_at || entry.event_date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </main>
  )
}
