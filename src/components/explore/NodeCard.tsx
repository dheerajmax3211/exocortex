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
  person: '#6366f1',
  place: '#22c55e',
  restaurant: '#f59e0b',
  dish: '#ef4444',
  movie: '#8b5cf6',
  show: '#a855f7',
  book: '#eab308',
  event: '#06b6d4',
  period: '#ec4899',
  school: '#14b8a6',
  org: '#3b82f6',
  item: '#f97316',
  other: '#94a3b8',
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
      className={`fixed z-30 w-72 bg-[#0e0e16]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl transition-all duration-150 ease-out ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      style={{
        left: clampedPos.x,
        top: clampedPos.y,
        transformOrigin: 'top left'
      }}
    >
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
          aria-label="Close fact card"
        >
          &times;
        </button>
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <span 
          className="w-2.5 h-2.5 rounded-full" 
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
        <span className="text-[10px] font-mono font-semibold text-white/70 uppercase tracking-widest">
          {node.type}
        </span>
      </div>
      
      <h3 className="text-lg font-serif font-bold text-white mb-2 leading-tight">
        {node.label}
      </h3>

      {node.isTension && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-2 mb-3 text-xs flex items-start gap-1.5 font-medium">
          <span>⚠️</span>
          <span>Active Life Tension: {node.tensionHeadline || 'Requires attention'}</span>
        </div>
      )}
      
      <div className="bg-white/5 rounded-xl p-3 border border-white/5 mb-3">
        {isLoading ? (
          <div className="h-4 bg-white/10 rounded animate-pulse w-3/4"></div>
        ) : (
          <p className="text-xs text-white/90 leading-relaxed font-sans">
            {factLine}
          </p>
        )}
      </div>

      {onViewProfile && (
        <button
          onClick={() => onViewProfile(node.id)}
          className="w-full text-xs font-medium py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center gap-1.5"
        >
          <span>View Profile</span>
          <span className="font-mono text-white/60">&rarr;</span>
        </button>
      )}
    </div>
  );
}
