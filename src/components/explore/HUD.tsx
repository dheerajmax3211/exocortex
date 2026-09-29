'use client';

import React, { useEffect, useState } from 'react';

interface HUDProps {
  nodeCount?: number;
  edgeCount?: number;
  onSearchClick?: () => void;
}

export default function HUD({ nodeCount = 0, edgeCount = 0, onSearchClick }: HUDProps) {
  const [greeting, setGreeting] = useState('Good day');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full z-10 pointer-events-none">
      <div 
        className="bg-black/40 backdrop-blur-md border-b border-white/10 text-white flex items-center justify-between pointer-events-auto"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
          paddingBottom: '1rem',
          paddingLeft: 'calc(env(safe-area-inset-left) + 1rem)',
          paddingRight: 'calc(env(safe-area-inset-right) + 1rem)',
        }}
      >
        <div>
          <h1 className="font-serif text-2xl font-semibold m-0" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
            {greeting}
          </h1>
          <p className="font-mono text-xs text-white/70 mt-1 uppercase tracking-wider">
            {nodeCount} memories traced &middot; {edgeCount} connections
          </p>
        </div>
        <button 
          onClick={onSearchClick}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Search"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
