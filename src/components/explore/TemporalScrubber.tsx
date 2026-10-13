'use client';

import React, { useState, useEffect, useRef } from 'react';
import { playScrubTone } from '@/lib/audio/soundscapes';

interface TemporalScrubberProps {
  minTimestamp: number; // ms
  maxTimestamp: number; // ms
  currentTimestamp: number; // ms
  onChange: (timestamp: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  activeCount: number;
  totalCount: number;
}

export default function TemporalScrubber({
  minTimestamp,
  maxTimestamp,
  currentTimestamp,
  onChange,
  isPlaying,
  onTogglePlay,
  activeCount,
  totalCount
}: TemporalScrubberProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDraggingRef = useRef(false);

  // Format timestamp into human-readable month/year
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  };

  const progress = maxTimestamp > minTimestamp 
    ? Math.max(0, Math.min(1, (currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp))) 
    : 1;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const newTs = minTimestamp + val * (maxTimestamp - minTimestamp);
    onChange(newTs);
    playScrubTone(val);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center">
      {/* Compact / Expanded Glass Visor */}
      <div className="bg-black/60 hover:bg-black/75 backdrop-blur-2xl border border-white/15 rounded-full px-4 py-2 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 transition-all duration-300">
        {/* Play/Pause Auto-Evolution Button */}
        <button
          onClick={onTogglePlay}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isPlaying 
              ? 'bg-cyan-500 text-black shadow-[0_0_15px_#00f0ff]' 
              : 'bg-white/10 hover:bg-white/20 text-white/90'
          }`}
          title={isPlaying ? 'Pause Neural Evolution' : 'Auto-Play Neural Evolution across Time'}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Current Date Badge */}
        <div className="flex items-center gap-2 min-w-[130px]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff] animate-pulse" />
          <span className="font-mono text-xs font-semibold tracking-wider text-cyan-300">
            {formatDate(currentTimestamp)}
          </span>
          <span className="text-[10px] font-mono text-white/40">
            ({activeCount}/{totalCount})
          </span>
        </div>

        {/* Interactive Scrub Track */}
        <div className="w-36 sm:w-56 md:w-72 flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={progress}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* Reset to Today button */}
        <button
          onClick={() => onChange(maxTimestamp)}
          disabled={progress >= 0.99}
          className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider transition-all ${
            progress >= 0.99
              ? 'text-white/30 cursor-default'
              : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
          }`}
          title="Fast-forward to present state"
        >
          NOW
        </button>
      </div>

      <div className="text-[9px] font-mono tracking-[0.2em] text-white/40 mt-1 uppercase">
        Chronesthesia 4D Engine
      </div>
    </div>
  );
}
