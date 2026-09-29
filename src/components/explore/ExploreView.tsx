'use client'

import React, { useState, useEffect } from 'react'
import HUD from './HUD'
import ExploreCanvas from './ExploreCanvas'
import Navigation from '@/components/ui/Navigation'
import FloatingAddButton from '@/components/ui/FloatingAddButton'
import SearchOverlay from './SearchOverlay'
import OnThisDaySheet from './OnThisDaySheet'
import EntityProfileSheet from './EntityProfileSheet'

interface ExploreViewProps {
  nodeCount: number
  edgeCount: number
}

export default function ExploreView({ nodeCount, edgeCount }: ExploreViewProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isOnThisDayOpen, setIsOnThisDayOpen] = useState(false)
  const [profileEntityId, setProfileEntityId] = useState<string | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#0a0a0f] text-white overflow-hidden relative">
      <HUD 
        nodeCount={nodeCount} 
        edgeCount={edgeCount} 
        onSearchClick={() => setIsSearchOpen(true)}
        onTodayClick={() => setIsOnThisDayOpen(true)}
      />
      
      <div className="absolute inset-0 z-0">
        <ExploreCanvas 
          onViewProfile={(id) => setProfileEntityId(id)}
          focusedNodeId={focusedNodeId}
        />
      </div>

      <SearchOverlay 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNode={(id) => {
          setIsSearchOpen(false)
          setFocusedNodeId(id)
        }}
      />

      <OnThisDaySheet
        isOpen={isOnThisDayOpen}
        onClose={() => setIsOnThisDayOpen(false)}
      />

      <EntityProfileSheet 
        entityId={profileEntityId}
        isOpen={!!profileEntityId}
        onClose={() => setProfileEntityId(null)}
      />

      <FloatingAddButton />
      <Navigation />
    </main>
  )
}
