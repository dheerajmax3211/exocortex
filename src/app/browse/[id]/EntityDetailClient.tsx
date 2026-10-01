'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import EntityEditModal from '@/components/entity/EntityEditModal'
import EntityMergeModal from '@/components/entity/EntityMergeModal'

interface EntityDetailClientProps {
  entity: any
  facts: any[]
  edges: any[]
  entries: any[]
}

export default function EntityDetailClient({ entity, facts, edges, entries }: EntityDetailClientProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isMergeOpen, setIsMergeOpen] = useState(false)

  // Group edges by relation
  const edgesByRelation: Record<string, any[]> = {}
  for (const edge of edges) {
    const rel = edge.relation || 'related_to'
    if (!edgesByRelation[rel]) edgesByRelation[rel] = []
    edgesByRelation[rel].push(edge)
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between mb-8">
        <Link 
          href="/browse" 
          className="text-white/60 hover:text-white flex items-center text-sm font-medium transition-colors"
        >
          &larr; Back to Browse
        </Link>
        <div className="flex items-center gap-2">
          <Link 
            href={`/?focus=${entity.id}`} 
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Focus in Explore
          </Link>
          <button 
            onClick={() => setIsEditOpen(true)}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium text-white transition-colors"
          >
            Edit
          </button>
          <button 
            onClick={() => setIsMergeOpen(true)}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium text-amber-400 transition-colors"
          >
            Merge
          </button>
        </div>
      </div>

      {/* Main Entity Card */}
      <div className="bg-[#12121c] border border-white/10 rounded-2xl p-6 md:p-8 mb-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
                {entity.name}
              </h1>
              <span className="px-3 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[11px] font-mono uppercase tracking-wider">
                {entity.type}
              </span>
            </div>
            {entity.aliases && entity.aliases.length > 0 && (
              <p className="text-xs text-white/50 font-mono mt-1">
                Aliases: {entity.aliases.join(', ')}
              </p>
            )}
          </div>
        </div>
        
        {entity.summary && (
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 my-6">
            <p className="text-white/80 text-sm md:text-base leading-relaxed">
              {entity.summary}
            </p>
          </div>
        )}

        {/* Discrete Facts */}
        {facts && facts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/60 mb-4">
              Grounded Facts ({facts.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {facts.map((fact: any) => (
                <div key={fact.id} className="bg-white/5 p-3.5 rounded-xl border border-white/5 text-sm">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">
                    {fact.key}
                  </div>
                  <div className="text-white font-medium">{fact.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections Grouped by Relation */}
        {Object.keys(edgesByRelation).length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/60 mb-4">
              Graph Connections ({edges.length})
            </h3>
            <div className="space-y-4">
              {Object.entries(edgesByRelation).map(([relation, relEdges]) => (
                <div key={relation} className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <h4 className="text-xs font-mono text-indigo-400 uppercase tracking-wider mb-3">
                    {relation.replace(/_/g, ' ')} ({relEdges.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {relEdges.map((e: any) => {
                      const otherEntityName = e.dst?.name === entity.name ? e.src?.name : e.dst?.name || 'Related Node';
                      const otherEntityId = e.dst?.name === entity.name ? e.src_id || e.src : e.dst_id || e.dst;
                      const rating = e.props?.rating_10 ? `★ ${e.props.rating_10}/10` : null;

                      return (
                        <Link 
                          key={e.id}
                          href={`/browse/${otherEntityId}`}
                          className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/70 border border-white/10 text-xs text-white flex items-center gap-2 transition-colors"
                        >
                          <span className="font-medium">{otherEntityName}</span>
                          {rating && <span className="text-amber-400 font-mono">{rating}</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source Entries */}
        {entries && entries.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/60 mb-4">
              Source Memories ({entries.length})
            </h3>
            <div className="space-y-3">
              {entries.map((entry: any) => (
                <div key={entry.id} className="bg-white/5 p-4 rounded-xl border border-white/5 text-xs text-white/80 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span>{entry.event_date || new Date(entry.entered_at).toLocaleDateString()}</span>
                    <span>[{entry.source || 'typed'}]</span>
                  </div>
                  <p className="italic text-sm text-white/90 font-serif">"{entry.raw_text}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EntityEditModal 
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        entity={entity}
        onSuccess={(action) => {
          if (action === 'deleted') {
            window.location.href = '/browse'
          } else {
            window.location.reload()
          }
        }}
      />

      {/* Merge Modal */}
      <EntityMergeModal 
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
        primaryEntity={{ id: entity.id, name: entity.name }}
      />
    </div>
  )
}
