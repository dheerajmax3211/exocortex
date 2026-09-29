'use client'

import React, { useState, useEffect, useRef } from 'react'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  onSelectNode: (id: string) => void
}

export default function SearchOverlay({ isOpen, onClose, onSelectNode }: SearchOverlayProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          // You might need to expose a way to open this from outside, 
          // but typically the parent handles the Cmd+K state.
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch('')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
    }
  }, [isOpen])

  const handleSearch = async (q: string) => {
    setSearch(q)
    if (q.length < 2) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/entities?search=${encodeURIComponent(q)}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.entities || data.data || []
      setResults(list)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#1a1a24] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in slide-in-from-top-10 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search entities..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full bg-transparent border-none text-white text-lg focus:outline-none placeholder-white/30"
          />
          <button onClick={onClose} className="text-xs border border-white/20 rounded px-1.5 py-0.5 text-white/50 hover:bg-white/10">ESC</button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isSearching && search.length >= 2 && results.length === 0 && (
            <div className="p-4 text-white/50 text-center text-sm">Searching...</div>
          )}
          
          {!isSearching && search.length >= 2 && results.length === 0 && (
            <div className="p-4 text-white/50 text-center text-sm">No results found for &quot;{search}&quot;</div>
          )}
          
          {results.map(entity => (
            <button
              key={entity.id}
              onClick={() => {
                onSelectNode(entity.id)
                onClose()
              }}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 text-white flex flex-col gap-1 transition-colors"
            >
              <div className="font-medium flex items-center justify-between">
                <span>{entity.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{entity.type}</span>
              </div>
              {entity.summary && <div className="text-sm text-white/50 truncate">{entity.summary}</div>}
            </button>
          ))}
          
          {search.length < 2 && (
            <div className="p-4 text-white/30 text-center text-sm">Type at least 2 characters to search...</div>
          )}
        </div>
      </div>
    </div>
  )
}
