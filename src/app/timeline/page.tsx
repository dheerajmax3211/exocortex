'use client'

import React, { useState, useEffect } from 'react'
import Navigation from '@/components/ui/Navigation'

interface Entry {
  id: string
  text_content: string
  event_date: string
  created_at: string
}

export default function TimelinePage() {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch('/api/timeline')
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
    fetchTimeline()
  }, [])

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-24">
      <div className="max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-8 text-gray-100">Timeline</h1>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading memories...</div>
        ) : Object.keys(entries).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center bg-gray-900/50 rounded-2xl border border-gray-800">
            <p className="text-xl mb-2 text-gray-300">No memories recorded yet.</p>
            <p className="text-sm">Your journey begins here.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(entries).map(([date, dayEntries]) => (
              <div key={date} className="relative">
                <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur py-4 border-b border-gray-800 mb-6">
                  <h2 className="text-lg font-semibold text-gray-200">
                    {new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h2>
                </div>
                <div className="space-y-6">
                  {dayEntries.map(entry => (
                    <div key={entry.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{entry.text_content}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-gray-500 font-medium">
                          {new Date(entry.event_date || entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
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
