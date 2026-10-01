'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GraphNode } from '@/lib/graph/renderer';

interface NodeCardProps {
  node: GraphNode & { isTension?: boolean; tensionSeverity?: string; tensionHeadline?: string };
  x: number;
  y: number;
  onClose?: () => void;
  onViewProfile?: (entityId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  person:     '#f472b6',
  place:      '#34d399',
  restaurant: '#fbbf24',
  dish:       '#fb923c',
  movie:      '#c084fc',
  show:       '#a855f7',
  book:       '#38bdf8',
  event:      '#facc15',
  period:     '#e879f9',
  school:     '#2dd4bf',
  org:        '#60a5fa',
  item:       '#94a3b8',
  other:      '#64748b',
};

export default function NodeCard({ node, x, y, onClose, onViewProfile }: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [clampedPos, setClampedPos] = useState({ x, y });
  const [factLine, setFactLine] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    let isCancelled = false;

    // Fetch real grounded fact line from API
    setIsLoading(true);
    fetch(`/api/graph/node/${node.id}`)
      .then(res => res.json())
      .then(data => {
        if (!isCancelled) {
          setFactLine(data.factLine || data.entity?.summary || 'Recorded in knowledge graph');
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setFactLine('Recorded in your memories');
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [node.id]);

  useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const margin = 16;
      let newX = x + 20;
      let newY = y + 20;

      if (newX + rect.width > window.innerWidth - margin) {
        newX = x - rect.width - 20;
      }
      if (newX < margin) newX = margin;

      if (newY + rect.height > window.innerHeight - margin) {
        newY = y - rect.height - 20;
      }
      if (newY < margin) newY = margin;

      setClampedPos({ x: newX, y: newY });
    }
  }, [x, y, node.id]);

  const color = CATEGORY_COLORS[node.type] || CATEGORY_COLORS.other;

  return (
    <div
      ref={cardRef}
      className={`fixed z-30 w-80 bg-[#070812]/85 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 shadow-[0_16px_50px_rgba(0,0,0,0.8)] transition-all duration-200 ease-out overflow-hidden ${mounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
      style={{
        left: clampedPos.x,
        top: clampedPos.y,
        transformOrigin: 'top left'
      }}
    >
      {/* Top subtle specular highlight */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-75"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`
        }}
      />

      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors flex items-center justify-center text-sm"
          aria-label="Close fact card"
        >
          &times;
        </button>
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <span 
          className="w-2 h-2 rounded-full" 
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-[10px] font-mono font-semibold text-white/60 uppercase tracking-[0.2em]">
          {node.type}
        </span>
      </div>
      
      <h3 className="text-base font-sans font-bold text-white mb-2 leading-snug tracking-tight">
        {node.label}
      </h3>

      {node.isTension && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl p-2.5 mb-3 text-xs flex items-start gap-2 font-mono">
          <span className="text-rose-400">⚠️</span>
          <span className="leading-tight">Tension: {node.tensionHeadline || 'Requires attention'}</span>
        </div>
      )}
      
      <div className="bg-white/5 rounded-xl p-3 border border-white/5 mb-3">
        {isLoading ? (
          <div className="space-y-1.5 animate-pulse">
            <div className="h-3.5 bg-white/10 rounded w-3/4"></div>
            <div className="h-3.5 bg-white/10 rounded w-1/2"></div>
          </div>
        ) : (
          <p className="text-xs text-white/80 leading-relaxed font-sans font-normal">
            {factLine}
          </p>
        )}
      </div>

      {onViewProfile && (
        <button
          onClick={() => onViewProfile(node.id)}
          className="w-full text-xs font-mono font-medium py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 hover:text-white transition-all flex items-center justify-center gap-2 border border-white/10 shadow-sm"
        >
          <span>View Dossier</span>
          <span className="text-cyan-400">&rarr;</span>
        </button>
      )}
    </div>
  );
}
