'use client';

import React from 'react';
import { playNodeTone } from '@/lib/audio/soundscapes';

export type NeuralLens = 'all' | 'tensions' | 'social' | 'culinary' | 'hubs' | 'media';

interface NeuralLensBarProps {
  activeLens: NeuralLens;
  onSelectLens: (lens: NeuralLens) => void;
  tensionCount?: number;
}

const LENSES: { id: NeuralLens; label: string; icon: string; countBadge?: boolean }[] = [
  { id: 'all', label: 'Cosmos', icon: '🌐' },
  { id: 'tensions', label: 'Tensions', icon: '⚡', countBadge: true },
  { id: 'social', label: 'Social', icon: '👥' },
  { id: 'culinary', label: 'Culinary', icon: '🍽️' },
  { id: 'hubs', label: 'Pillars', icon: '🏛️' },
  { id: 'media', label: 'Media', icon: '🎬' },
];

export default function NeuralLensBar({
  activeLens,
  onSelectLens,
  tensionCount = 0
}: NeuralLensBarProps) {
  const handleSelect = (lens: NeuralLens) => {
    onSelectLens(lens);
    playNodeTone(lens === 'tensions' ? 'tension' : 'person', lens === 'tensions');
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div className="bg-black/45 hover:bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full px-1.5 py-1 flex items-center gap-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
        {LENSES.map(lens => {
          const isActive = activeLens === lens.id;
          return (
            <button
              key={lens.id}
              onClick={() => handleSelect(lens.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all flex items-center gap-1.5 ${
                isActive
                  ? lens.id === 'tensions'
                    ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span>{lens.icon}</span>
              <span className="hidden sm:inline font-medium">{lens.label}</span>
              {lens.countBadge && tensionCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {tensionCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
