'use client'

import React, { useState, useEffect } from 'react'
import HUD from './HUD'
import ExploreCanvas from './ExploreCanvas'
import Navigation from '@/components/ui/Navigation'
import FloatingAddButton from '@/components/ui/FloatingAddButton'
import SearchOverlay from './SearchOverlay'
import OnThisDaySheet from './OnThisDaySheet'
import EntityProfileSheet from './EntityProfileSheet'
import LivingMindPanel from './LivingMindPanel'
import DecisionSimulatorModal from './DecisionSimulatorModal'
import MorningBriefingModal from './MorningBriefingModal'

interface ExploreViewProps {
  nodeCount: number
  edgeCount: number
}

export default function ExploreView({ nodeCount, edgeCount }: ExploreViewProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isOnThisDayOpen, setIsOnThisDayOpen] = useState(false)
  const [isMindOpen, setIsMindOpen] = useState(false)
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
  const [isBriefingOpen, setIsBriefingOpen] = useState(false)
  const [profileEntityId, setProfileEntityId] = useState<string | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  useEffect(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('lastBriefingSeen') !== todayDate) {
      setIsBriefingOpen(true);
    }
  }, []);

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
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#030308] text-white overflow-hidden relative selection:bg-cyan-500/30">
      {/* Subtle cosmic vignette & atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.08),rgba(0,0,0,0))] pointer-events-none z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.05),rgba(0,0,0,0))] pointer-events-none z-10" />

      <HUD 
        nodeCount={nodeCount} 
        edgeCount={edgeCount} 
        onSearchClick={() => setIsSearchOpen(true)}
        onTodayClick={() => setIsBriefingOpen(true)}
        onOpenMind={() => setIsMindOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
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

      <LivingMindPanel
        isOpen={isMindOpen}
        onClose={() => setIsMindOpen(false)}
        onOpenSimulator={() => {
          setIsMindOpen(false)
          setIsSimulatorOpen(true)
        }}
      />

      <DecisionSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      <MorningBriefingModal
        isOpen={isBriefingOpen}
        onClose={() => setIsBriefingOpen(false)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <FloatingAddButton />
      <Navigation />
    </main>
  )
}
