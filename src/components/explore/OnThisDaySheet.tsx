'use client'

import React, { useState, useEffect } from 'react'
import BottomSheet from '../ui/BottomSheet'

interface OnThisDaySheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function OnThisDaySheet({ isOpen, onClose }: OnThisDaySheetProps) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      fetch('/api/timeline?date=today')
        .then(res => res.json())
        .then(resData => {
          setData(resData)
          setIsLoading(false)
        })
        .catch(err => {
          console.error(err)
          setIsLoading(false)
        })
    }
  }, [isOpen])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} fullHeight>
      <div className="flex flex-col h-full space-y-6 pt-2 pb-8">
        <header>
          <p className="text-sm font-mono text-[var(--muted)]">Memories from</p>
          <h2 className="text-3xl font-display mt-1 text-[var(--foreground)]">On This Day</h2>
        </header>

        {isLoading ? (
          <div className="flex flex-col space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-white/5 h-24 rounded-xl w-full"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-8 overflow-y-auto pb-10 hide-scrollbar flex-1">
            {data?.years?.map((yearGroup: any, idx: number) => (
              <section key={idx} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-serif text-[var(--accent)] font-medium">
                    {yearGroup.yearsAgo} year{yearGroup.yearsAgo !== 1 ? 's' : ''} ago today
                  </h3>
                  <div className="h-px flex-1 bg-white/10"></div>
                  <span className="text-xs font-mono text-[var(--muted)]">{yearGroup.year}</span>
                </div>
                
                <div className="space-y-3">
                  {yearGroup.entries.map((entry: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <p className="text-[var(--foreground)] text-sm leading-relaxed">{entry.text}</p>
                      
                      {entry.entities && entry.entities.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                          {entry.entities.map((entity: any, j: number) => (
                            <span key={j} className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-md">
                              {entity.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {(!data?.years || data.years.length === 0) && (
              <div className="text-center py-10 text-[var(--muted)]">
                <p>No memories found for this day in previous years.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
