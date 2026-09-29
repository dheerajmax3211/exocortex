'use client'

import React, { useState } from 'react'
import HUD from './HUD'
import ExploreCanvas from './ExploreCanvas'
import Navigation from '@/components/ui/Navigation'
import FloatingAddButton from '@/components/ui/FloatingAddButton'
import SearchOverlay from './SearchOverlay'
import OnThisDaySheet from './OnThisDaySheet'

interface ExploreViewProps {
  nodeCount: number
  edgeCount: number
}

export default function ExploreView({ nodeCount, edgeCount }: ExploreViewProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isOnThisDayOpen, setIsOnThisDayOpen] = useState(false)

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#0a0a0f] text-white overflow-hidden relative">
      <HUD 
        nodeCount={nodeCount} 
        edgeCount={edgeCount} 
        onSearchClick={() => setIsSearchOpen(true)}
      />
      
      <div className="absolute inset-0 z-0">
        <ExploreCanvas />
      </div>

      <SearchOverlay 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNode={(id) => {
          setIsSearchOpen(false)
          window.location.href = `/browse/${id}`
        }}
      />

      <OnThisDaySheet
        isOpen={isOnThisDayOpen}
        onClose={() => setIsOnThisDayOpen(false)}
      />

      <FloatingAddButton />
      <Navigation />
    </main>
  )
}
