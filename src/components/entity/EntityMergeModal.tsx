'use client'

import React, { useState } from 'react'

interface EntityMergeModalProps {
  isOpen: boolean
  onClose: () => void
  primaryEntity: {
    id: string
    name: string
  }
}

export default function EntityMergeModal({ isOpen, onClose, primaryEntity }: EntityMergeModalProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [secondaryEntity, setSecondaryEntity] = useState<any | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isMerging, setIsMerging] = useState(false)

  if (!isOpen) return null

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
      setResults(list.filter((e: any) => e.id !== primaryEntity.id))
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleMerge = async () => {
    if (!secondaryEntity) return
    setIsMerging(true)
    try {
      await fetch('/api/entities/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryId: primaryEntity.id,
          secondaryId: secondaryEntity.id
        })
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-serif text-white">Merge Entities</h2>
          <p className="text-sm text-white/60">
            Merge another entity into <strong className="text-white">{primaryEntity.name}</strong>.
          </p>

          {!secondaryEntity ? (
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Search entity to merge..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div className="max-h-40 overflow-y-auto space-y-2">
                {isSearching && <p className="text-white/50 text-sm">Searching...</p>}
                {results.map(entity => (
                  <button
                    key={entity.id}
                    onClick={() => setSecondaryEntity(entity)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 text-white border border-transparent hover:border-white/10 transition-colors"
                  >
                    <div className="font-medium">{entity.name}</div>
                    {entity.summary && <div className="text-xs text-white/50 truncate">{entity.summary}</div>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-200/90 text-sm space-y-2">
              <p>
                <strong>{secondaryEntity.name}</strong> will be merged into <strong>{primaryEntity.name}</strong>.
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>All connections to {secondaryEntity.name} will be repointed to {primaryEntity.name}.</li>
                <li>{secondaryEntity.name} will be added as an alias.</li>
                <li>{secondaryEntity.name} will be deleted.</li>
              </ul>
              <p className="font-medium mt-2">This action cannot be undone.</p>
              
              <button 
                onClick={() => setSecondaryEntity(null)}
                className="text-amber-400 hover:text-amber-300 underline text-xs mt-2"
              >
                Choose a different entity
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-black/20 border-t border-white/10 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-white/70 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!secondaryEntity || isMerging}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMerging ? 'Merging...' : 'Confirm Merge'}
          </button>
        </div>
      </div>
    </div>
  )
}
