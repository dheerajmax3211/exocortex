'use client';

import React, { useEffect, useState } from 'react';

interface HUDProps {
  nodeCount?: number;
  edgeCount?: number;
  onSearchClick?: () => void;
  onTodayClick?: () => void;
  onOpenMind?: () => void;
  onOpenSimulator?: () => void;
}

export default function HUD({ 
  nodeCount = 0, 
  edgeCount = 0, 
  onSearchClick, 
  onTodayClick,
  onOpenMind,
  onOpenSimulator
}: HUDProps) {
  const [greeting, setGreeting] = useState('Good day');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-20 pointer-events-none">
      <div 
        className="bg-black/35 backdrop-blur-2xl border-b border-white/10 text-white flex items-center justify-between pointer-events-auto transition-all"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
          paddingBottom: '0.75rem',
          paddingLeft: 'calc(env(safe-area-inset-left) + 1.25rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1.25rem)',
        }}
      >
        {/* Left: Telemetry & Consciousness Status */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)] shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-semibold text-cyan-400">
                EXOCORTEX
              </span>
              <span className="text-[10px] text-white/30">&middot;</span>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 flex items-center gap-1">
                ONLINE
              </span>
            </div>
            <p className="font-mono text-[11px] text-white/60 tracking-wider whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5 mt-0.5">
              <span className="text-white/90 font-medium">{nodeCount}</span>
              <span className="text-white/40">nodes</span>
              <span className="text-white/20">&bull;</span>
              <span className="text-white/90 font-medium">{edgeCount}</span>
              <span className="text-white/40">synapses</span>
            </p>
          </div>
        </div>

        {/* Right: Modern Glass Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Subconscious Mind State & Life Vectors Button */}
          {onOpenMind && (
            <button
              onClick={onOpenMind}
              className="px-3 py-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-mono text-indigo-300 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.15)] group"
              aria-label="Subconscious Mind State"
              title="Living Mind State & Life Vectors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8] group-hover:animate-ping" />
              <span className="hidden sm:inline tracking-wider">Vectors</span>
            </button>
          )}

          {/* Decision Simulator Button */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="px-3 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              aria-label="Decision Simulator"
              title="Run Decision / What-If Simulation"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              <span className="hidden sm:inline tracking-wider">Simulate</span>
            </button>
          )}

          {onTodayClick && (
            <button 
              onClick={onTodayClick}
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
              aria-label="Morning Briefing"
              title="Morning Briefing"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              <span className="hidden sm:inline tracking-wider">Briefing</span>
            </button>
          )}

          <button 
            onClick={onSearchClick}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
            aria-label="Search entities"
            title="Search entities (Cmd+K)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <kbd className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-white/60">⌘K</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
