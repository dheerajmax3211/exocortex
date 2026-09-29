'use client'

import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet'

interface ReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  data: any
  onEdit: () => void
}

export default function ReviewSheet({ isOpen, onClose, data, onEdit }: ReviewSheetProps) {
  const [isSaving, setIsSaving] = useState(false)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/ingest/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      })
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} fullHeight>
      <div className="flex flex-col space-y-6 pt-2 pb-8">
        <header>
          <p className="text-sm font-mono text-[var(--muted)]">Filed under: {today}</p>
          <h2 className="text-2xl font-display mt-1 text-[var(--foreground)]">Review Memory</h2>
        </header>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Entities Detected</h3>
          <div className="flex flex-wrap gap-2">
            {data?.entities?.map((entity: any, i: number) => (
              <div key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                entity.status === 'ambiguous' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {entity.name}
                {entity.status === 'ambiguous' && (
                  <select className="bg-transparent border-none outline-none text-xs ml-1 cursor-pointer">
                    <option value="">Select...</option>
                    {entity.options.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Connections</h3>
          <ul className="space-y-2">
            {data?.edges?.map((edge: string, i: number) => (
              <li key={i} className="text-[var(--foreground)] text-sm px-4 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                {edge}
              </li>
            ))}
          </ul>
        </section>

        {data?.questions?.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Brain Questions</h3>
            <ul className="space-y-2">
              {data.questions.map((q: string, i: number) => (
                <li key={i} className="text-sm italic text-[var(--accent)]">"{q}"</li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--border)] mt-auto">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--accent)] text-white font-medium"
          >
            {isSaving ? 'Saving...' : 'Confirm & Save'}
          </button>
          <button 
            onClick={onEdit}
            disabled={isSaving}
            className="px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--foreground)] font-medium"
          >
            Edit Text
          </button>
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-3 rounded-xl bg-red-500/10 text-red-500 font-medium"
          >
            Discard
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
