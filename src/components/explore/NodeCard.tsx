'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GraphNode } from '@/lib/graph/renderer';

interface NodeCardProps {
  node: GraphNode;
  x: number;
  y: number;
  onClose?: () => void;
}

const CATEGORY_COLORS: Record<GraphNode['type'], string> = {
  person: '#6366f1',
  place: '#22c55e',
  restaurant: '#f59e0b',
  dish: '#ef4444',
  movie: '#8b5cf6',
  event: '#06b6d4',
  period: '#ec4899',
  other: '#94a3b8',
};

export default function NodeCard({ node, x, y, onClose }: NodeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [clampedPos, setClampedPos] = useState({ x, y });

  useEffect(() => {
    setMounted(true);
  }, []);

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
      className={`fixed z-20 w-64 bg-[#12121a]/80 backdrop-blur-lg border border-white/10 rounded-xl p-4 shadow-2xl transition-all duration-150 ease-out ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      style={{
        left: clampedPos.x,
        top: clampedPos.y,
        transformOrigin: 'top left'
      }}
    >
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-white/50 hover:text-white"
        >
          &times;
        </button>
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <span 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
          {node.type}
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2">{node.label}</h3>
      
      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
        <p className="text-sm text-white/80">
          Last visited on Sep 28
        </p>
      </div>
    </div>
  );
}
