'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
import NeuralLensBar, { NeuralLens } from './NeuralLensBar'
import TemporalScrubber from './TemporalScrubber'
import QuickSparDrawer from './QuickSparDrawer'

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
  const [isQuickSparOpen, setIsQuickSparOpen] = useState(false)
  const [profileEntityId, setProfileEntityId] = useState<string | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  // 4D Chronesthesia Temporal Scrubber state
  const [temporalThreshold, setTemporalThreshold] = useState<number | null>(null)
  const [isPlayingEvolution, setIsPlayingEvolution] = useState(false)

  // Multi-Perspective Neural Lens state
  const [activeLens, setActiveLens] = useState<NeuralLens>('all')

  // Live entity spotlighting from Quick-Spar drawer / citations
  const [highlightedEntities, setHighlightedEntities] = useState<string[]>([])

  // Cinematic Auto-Orbit state
  const [isAutoOrbit, setIsAutoOrbit] = useState(true)

  // Real-time graph telemetry
  const [graphStats, setGraphStats] = useState({
    minTimestamp: Date.now() - 365 * 24 * 3600 * 1000 * 2,
    maxTimestamp: Date.now(),
    activeNodesCount: nodeCount,
    totalNodesCount: nodeCount,
    tensionCount: 0,
  })

  const handleStatsChange = useCallback((stats: {
    minTimestamp: number;
    maxTimestamp: number;
    activeNodesCount: number;
    totalNodesCount: number;
    tensionCount: number;
  }) => {
    setGraphStats(prev => {
      if (
        prev.minTimestamp === stats.minTimestamp &&
        prev.maxTimestamp === stats.maxTimestamp &&
        prev.activeNodesCount === stats.activeNodesCount &&
        prev.totalNodesCount === stats.totalNodesCount &&
        prev.tensionCount === stats.tensionCount
      ) {
        return prev;
      }
      return stats;
    });
  }, [])

  // Auto-play neural evolution across time
  useEffect(() => {
    if (!isPlayingEvolution) return

    const { minTimestamp, maxTimestamp } = graphStats
    if (maxTimestamp <= minTimestamp) return

    const totalRange = maxTimestamp - minTimestamp
    const step = totalRange * 0.015

    const interval = setInterval(() => {
      setTemporalThreshold(prev => {
        const current = prev ?? minTimestamp
        const next = current + step
        if (next >= maxTimestamp) {
          setIsPlayingEvolution(false)
          return maxTimestamp
        }
        return next
      })
    }, 180)

    return () => clearInterval(interval)
  }, [isPlayingEvolution, graphStats])

  // Morning briefing retention trigger
  useEffect(() => {
    const todayDate = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('lastBriefingSeen') !== todayDate) {
      setIsBriefingOpen(true);
    }
  }, []);

  // Keyboard shortcuts: Cmd+K (Search), Cmd+J (Quick-Spar Copilot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setIsQuickSparOpen(prev => !prev)
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

      {/* Top Telemetry & Control HUD */}
      <HUD 
        nodeCount={graphStats.activeNodesCount || nodeCount} 
        edgeCount={edgeCount} 
        onSearchClick={() => setIsSearchOpen(true)}
        onTodayClick={() => setIsBriefingOpen(true)}
        onOpenMind={() => setIsMindOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenQuickSpar={() => setIsQuickSparOpen(prev => !prev)}
      />

      {/* Floating Multi-Perspective Neural Lens Bar */}
      <NeuralLensBar 
        activeLens={activeLens}
        onSelectLens={setActiveLens}
        tensionCount={graphStats.tensionCount}
      />
      
      {/* 3D Force-Directed Neural Universe */}
      <div className="absolute inset-0 z-0">
        <ExploreCanvas 
          onViewProfile={(id) => setProfileEntityId(id)}
          focusedNodeId={focusedNodeId}
          activeLens={activeLens}
          temporalThreshold={temporalThreshold}
          highlightedEntityNames={highlightedEntities}
          isAutoOrbit={isAutoOrbit}
          onToggleAutoOrbit={() => setIsAutoOrbit(prev => !prev)}
          onStatsChange={handleStatsChange}
        />
      </div>

      {/* 4D Chronesthesia Temporal Scrubber Dock */}
      <TemporalScrubber 
        minTimestamp={graphStats.minTimestamp}
        maxTimestamp={graphStats.maxTimestamp}
        currentTimestamp={temporalThreshold ?? graphStats.maxTimestamp}
        onChange={setTemporalThreshold}
        isPlaying={isPlayingEvolution}
        onTogglePlay={() => setIsPlayingEvolution(prev => !prev)}
        activeCount={graphStats.activeNodesCount}
        totalCount={graphStats.totalNodesCount}
      />

      {/* Slide-Over Quick-Spar Copilot Drawer */}
      <QuickSparDrawer 
        isOpen={isQuickSparOpen}
        onClose={() => setIsQuickSparOpen(false)}
        onHighlightEntities={(entities) => setHighlightedEntities(entities)}
      />

      {/* Search Overlay */}
      <SearchOverlay 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectNode={(id) => {
          setIsSearchOpen(false)
          setFocusedNodeId(id)
        }}
      />

      {/* Historical Chronesthesia Sheet */}
      <OnThisDaySheet
        isOpen={isOnThisDayOpen}
        onClose={() => setIsOnThisDayOpen(false)}
      />

      {/* Entity Deep-Dive Profile */}
      <EntityProfileSheet 
        entityId={profileEntityId}
        isOpen={!!profileEntityId}
        onClose={() => setProfileEntityId(null)}
      />

      {/* Living Mind State & Alter-Ego Vectors */}
      <LivingMindPanel
        isOpen={isMindOpen}
        onClose={() => setIsMindOpen(false)}
        onOpenSimulator={() => {
          setIsMindOpen(false)
          setIsSimulatorOpen(true)
        }}
      />

      {/* Monte-Carlo Decision Simulator */}
      <DecisionSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      {/* Morning Consciousness Briefing */}
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
