'use client'

import { useState } from 'react'
import AddMemorySheet from '../add/AddMemorySheet'

export default function FloatingAddButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 z-40 w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: 'calc(92px + env(safe-area-inset-bottom))',
          boxShadow: '0 4px 20px var(--accent-glow)',
        }}
        aria-label="Add Memory"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {isOpen && <AddMemorySheet isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  )
}
