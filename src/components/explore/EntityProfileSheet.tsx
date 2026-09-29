'use client'

import React, { useEffect, useState } from 'react'
import BottomSheet from '../ui/BottomSheet'
import Link from 'next/link'

interface EntityProfileSheetProps {
  entityId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function EntityProfileSheet({ entityId, isOpen, onClose }: EntityProfileSheetProps) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && entityId) {
      setIsLoading(true)
      fetch(`/api/entities/${entityId}`)
        .then(res => res.json())
        .then(resData => {
          setData(resData)
          setIsLoading(false)
        })
        .catch(err => {
          console.error(err)
          setIsLoading(false)
        })
    } else {
      setData(null)
    }
  }, [isOpen, entityId])

  if (!isOpen) return null

  const entity = data?.entity
  const facts = data?.facts || []
  const edges = data?.edges || []
  const entries = data?.entries || []

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} fullHeight>
      <div className="flex flex-col space-y-6 pt-2 pb-8">
        {isLoading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/2"></div>
            <div className="h-4 bg-white/10 rounded w-1/3"></div>
            <div className="h-24 bg-white/10 rounded"></div>
          </div>
        ) : entity ? (
          <>
            <header className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {entity.type}
                </span>
                <h2 className="text-3xl font-serif font-bold text-white mt-2">
                  {entity.name}
                </h2>
                {entity.aliases && entity.aliases.length > 0 && (
                  <p className="text-xs text-white/50 mt-1 font-mono">
                    Also known as: {entity.aliases.join(', ')}
                  </p>
                )}
              </div>
              <Link 
                href={`/browse/${entity.id}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Full Page &rarr;
              </Link>
            </header>

            {entity.summary && (
              <section className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-sm text-white/80 leading-relaxed">{entity.summary}</p>
              </section>
            )}

            {/* Facts */}
            {facts.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">Grounded Facts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {facts.map((f: any) => (
                    <div key={f.id} className="bg-white/5 border border-white/5 rounded-lg p-3 text-sm">
                      <span className="text-white/40 font-mono text-xs block">{f.key}</span>
                      <span className="text-white font-medium">{f.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Connections */}
            {edges.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
                  Connections ({edges.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {edges.map((e: any) => (
                    <div key={e.id} className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                      <span className="text-indigo-400 font-mono text-xs">{e.relation.replace(/_/g, ' ')}</span>
                      {e.props?.rating_10 && (
                        <span className="text-amber-400 text-xs font-mono">★ {e.props.rating_10}/10</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Source entries */}
            {entries.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
                  Source Memories ({entries.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {entries.map((entry: any) => (
                    <div key={entry.id} className="bg-white/5 border border-white/5 rounded-lg p-3 text-xs text-white/70 space-y-1">
                      <div className="font-mono text-white/40">
                        {entry.event_date || new Date(entry.entered_at).toLocaleDateString()}
                      </div>
                      <p className="line-clamp-2 italic">"{entry.raw_text}"</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="text-white/50 text-sm py-8 text-center">Entity details could not be loaded.</p>
        )}
      </div>
    </BottomSheet>
  )
}
