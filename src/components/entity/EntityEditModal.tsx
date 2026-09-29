'use client'

import React, { useState, useEffect } from 'react'

interface EntityEditModalProps {
  isOpen: boolean
  onClose: () => void
  entity: {
    id: string
    name: string
    aliases: string[]
    summary: string
    type: string
  }
}

export default function EntityEditModal({ isOpen, onClose, entity }: EntityEditModalProps) {
  const [name, setName] = useState('')
  const [aliases, setAliases] = useState('')
  const [summary, setSummary] = useState('')
  const [type, setType] = useState('person')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (entity && isOpen) {
      setName(entity.name)
      setAliases(entity.aliases?.join(', ') || '')
      setSummary(entity.summary || '')
      setType(entity.type || 'person')
      setShowDeleteConfirm(false)
    }
  }, [entity, isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch(`/api/entities/${entity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          aliases: aliases.split(',').map(s => s.trim()).filter(Boolean),
          summary,
          type
        })
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await fetch(`/api/entities/${entity.id}`, {
        method: 'DELETE'
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1a1a24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-serif text-white">Edit Entity</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Aliases (comma-separated)</label>
              <input
                type="text"
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 appearance-none"
              >
                <option value="person">Person</option>
                <option value="place">Place</option>
                <option value="organization">Organization</option>
                <option value="event">Event</option>
                <option value="concept">Concept</option>
                <option value="movie">Movie</option>
                <option value="restaurant">Restaurant</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Summary</label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-black/20 border-t border-white/10 flex flex-wrap gap-2 justify-between">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
