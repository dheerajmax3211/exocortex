'use client'

import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet'

interface ReviewSheetProps {
  isOpen: boolean
  onClose: () => void
  data: any
  onEdit: () => void
}

const TYPE_COLORS: Record<string, string> = {
  person: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  place: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  restaurant: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  dish: 'bg-red-500/20 text-red-400 border-red-500/30',
  movie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  show: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  book: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  period: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  event: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  org: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  school: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  item: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

export default function ReviewSheet({ isOpen, onClose, data, onEdit }: ReviewSheetProps) {
  const [isSaving, setIsSaving] = useState(false)
  
  const extraction = data?.extraction || data || {}
  const entryId = data?.entry_id
  const candidates = data?.candidates || []

  // Local state to allow resolving ambiguous entity matches
  const [entityMatches, setEntityMatches] = useState<Record<string, string | null>>(() => {
    const initial: Record<string, string | null> = {}
    for (const ent of extraction.entities || []) {
      if (ent.match?.existing_id) {
        initial[ent.temp_id] = ent.match.existing_id
      }
    }
    return initial
  })

  const eventDateFormatted = extraction.event_date || new Date().toISOString().split('T')[0]

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Map entities with user-selected matches
      const resolvedEntities = (extraction.entities || []).map((ent: any) => ({
        ...ent,
        match: entityMatches[ent.temp_id] 
          ? { existing_id: entityMatches[ent.temp_id], confidence: 1.0 }
          : ent.match
      }))

      const payload = {
        entry_id: entryId,
        entities: resolvedEntities,
        edges: extraction.edges || [],
        facts: extraction.facts || [],
        event_date: extraction.event_date || null
      }

      const res = await fetch('/api/ingest/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('Failed to commit memory')
      }

      onClose()
      // Refresh home graph view
      window.location.reload()
    } catch (err) {
      console.error('Commit failed:', err)
      alert('Could not save memory. Please check console.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} fullHeight>
      <div className="flex flex-col space-y-6 pt-2 pb-8">
        <header>
          <p className="text-sm font-mono text-white/50">Filed under: {eventDateFormatted}</p>
          <h2 className="text-2xl font-serif mt-1 text-white">Review Memory Graph</h2>
        </header>

        {/* Entities Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
            Entities Extracted ({extraction.entities?.length || 0})
          </h3>
          <div className="flex flex-wrap gap-2">
            {extraction.entities?.map((entity: any) => {
              const colorClass = TYPE_COLORS[entity.type] || TYPE_COLORS.other
              const isMatched = !!entityMatches[entity.temp_id] || (entity.match?.existing_id && entity.match?.confidence > 0.8)
              
              // Find matching candidates for ambiguous picker
              const potentialMatches = candidates.filter((c: any) => 
                c.name.toLowerCase().includes(entity.name.toLowerCase()) || 
                entity.name.toLowerCase().includes(c.name.toLowerCase())
              )

              return (
                <div 
                  key={entity.temp_id} 
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2 ${colorClass}`}
                >
                  <span>{entity.name}</span>
                  <span className="text-[10px] uppercase opacity-70">({entity.type})</span>
                  {isMatched && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      matched
                    </span>
                  )}
                  {potentialMatches.length > 1 && (
                    <select
                      value={entityMatches[entity.temp_id] || ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setEntityMatches(prev => ({ ...prev, [entity.temp_id]: val || null }))
                      }}
                      className="bg-black/60 text-xs text-white border border-white/20 rounded px-1 py-0.5 ml-1"
                    >
                      <option value="">Create New</option>
                      {potentialMatches.map((cand: any) => (
                        <option key={cand.id} value={cand.id}>
                          Link to: {cand.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Connections / Edges Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
            Connections & Opinions ({extraction.edges?.length || 0})
          </h3>
          <ul className="space-y-2">
            {extraction.edges?.map((edge: any, i: number) => {
              const srcEnt = extraction.entities?.find((e: any) => e.temp_id === edge.src_temp_id)?.name || 'Source'
              const dstEnt = extraction.entities?.find((e: any) => e.temp_id === edge.dst_temp_id)?.name || 'Target'
              const rating = edge.props?.rating_10 ? `★ ${edge.props.rating_10}/10` : null
              const sentiment = edge.props?.sentiment ? `[${edge.props.sentiment}]` : null
              const quote = edge.props?.quote ? `"${edge.props.quote}"` : null

              return (
                <li key={i} className="text-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{srcEnt}</span>
                    <span className="text-xs font-mono text-indigo-400">-- {edge.relation} --&gt;</span>
                    <span className="font-medium text-white">{dstEnt}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {rating && <span className="text-amber-400 font-mono">{rating}</span>}
                    {sentiment && <span className="text-white/60 font-mono">{sentiment}</span>}
                    {quote && <span className="text-white/40 italic">{quote}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Clarifying Questions from LLM */}
        {extraction.questions?.length > 0 && (
          <section className="space-y-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
              Brain Questions / Ambiguities
            </h3>
            <ul className="space-y-1">
              {extraction.questions.map((q: string, i: number) => (
                <li key={i} className="text-sm text-amber-200">
                  • {q}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10 mt-auto">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            {isSaving ? 'Saving to Graph...' : 'Save to Memory'}
          </button>
          <button 
            onClick={onEdit} 
            disabled={isSaving}
            className="px-4 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 font-medium transition-colors"
          >
            Edit
          </button>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
