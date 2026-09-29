'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Navigation from '@/components/ui/Navigation'

interface Entity {
  id: string
  name: string
  type: string
  summary: string
  created_at: string
}

export default function BrowsePage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('All')
  const [search, setSearch] = useState('')

  const types = ['All', 'Person', 'Place', 'Organization', 'Event', 'Concept']

  useEffect(() => {
    async function fetchEntities() {
      setLoading(true)
      try {
        const query = new URLSearchParams()
        if (type !== 'All') query.set('type', type)
        if (search) query.set('search', search)
        
        const res = await fetch(`/api/entities?${query.toString()}`)
        if (res.ok) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.entities || data.data || []
          setEntities(list)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    // debounce search
    const timer = setTimeout(() => {
      fetchEntities()
    }, 300)
    
    return () => clearTimeout(timer)
  }, [type, search])

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-24">
      <h1 className="text-3xl font-bold mb-6">Browse Entities</h1>
      
      <div className="flex flex-col gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search entities..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 text-white rounded p-3 w-full border border-gray-700 focus:outline-none focus:border-blue-500"
        />
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {types.map(t => (
            <button 
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${type === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="flex justify-center py-10 text-gray-400">Loading entities...</div>
        ) : entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
            <p className="text-xl mb-2 text-gray-300">No entities found.</p>
            <p className="text-sm">Start adding memories or try a different search!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map(entity => (
              <Link href={`/browse/${entity.id}`} key={entity.id}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 hover:bg-gray-800/50 transition cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-semibold text-gray-100">{entity.name}</h2>
                    <span className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded-full text-gray-400">{entity.type}</span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">{entity.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Navigation />
    </main>
  )
}
