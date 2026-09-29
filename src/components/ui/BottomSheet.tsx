'use client'

import React, { useEffect, useRef } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  fullHeight?: boolean
}

export default function BottomSheet({ isOpen, onClose, children, fullHeight = false }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div 
        ref={sheetRef}
        className={`relative w-full bg-[var(--card)] rounded-t-[32px] shadow-2xl transition-transform transform translate-y-0 ${fullHeight ? 'h-[90vh]' : 'max-h-[90vh]'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex justify-center pt-3 pb-2 w-full touch-none cursor-grab" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-[var(--border)]" />
        </div>
        
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: fullHeight ? 'calc(90vh - 40px)' : 'calc(90vh - 40px)' }}>
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}} />
    </div>
  )
}
