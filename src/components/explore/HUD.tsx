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
    <div className="fixed top-0 left-0 w-full z-20 pointer-events-none">
      <div 
        className="bg-black/60 backdrop-blur-xl border-b border-white/10 text-white flex items-center justify-between pointer-events-auto shadow-2xl"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 0.85rem)',
          paddingBottom: '0.85rem',
          paddingLeft: 'calc(env(safe-area-inset-left) + 1.25rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1.25rem)',
        }}
      >
        <div className="min-w-0 pr-4">
          <h1 className="font-serif text-xl sm:text-2xl font-semibold m-0 truncate text-white tracking-tight" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            {greeting}
          </h1>
          <p className="font-mono text-[11px] sm:text-xs text-white/70 mt-0.5 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
            <span>{nodeCount} memories traced</span>
            <span>&middot;</span>
            <span>{edgeCount} connections</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Subconscious Mind State & Life Vectors Button */}
          {onOpenMind && (
            <button
              onClick={onOpenMind}
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-mono text-indigo-300 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
              aria-label="Subconscious Mind State"
              title="Living Mind State & Life Vectors"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse" />
              <span className="hidden sm:inline">Life Vectors</span>
            </button>
          )}

          {/* Decision Simulator Button */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              aria-label="Decision Simulator"
              title="Run Decision / What-If Simulation"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <span className="hidden sm:inline">Simulate</span>
            </button>
          )}

          {onTodayClick && (
            <button 
              onClick={onTodayClick}
              className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
              aria-label="Morning Briefing"
              title="Morning Briefing"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span className="hidden sm:inline">Today</span>
            </button>
          )}

          <button 
            onClick={onSearchClick}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Search entities"
            title="Search entities (Cmd+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
