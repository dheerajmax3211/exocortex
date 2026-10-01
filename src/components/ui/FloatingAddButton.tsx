'use client'

import { useState } from 'react'
import AddMemorySheet from '../add/AddMemorySheet'

export default function FloatingAddButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 via-indigo-600 to-violet-600 text-white shadow-[0_0_25px_rgba(6,182,212,0.45)] border border-cyan-400/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center pointer-events-auto group"
        style={{
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
        }}
        aria-label="Add Memory"
        title="Ingest New Memory (+)"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {isOpen && <AddMemorySheet isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  )
}
