'use client';

import React, { useState, useEffect } from 'react';
import type { MindState } from '@/lib/subconscious-engine';

interface LivingMindPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSimulator: () => void;
}

export default function LivingMindPanel({ isOpen, onClose, onOpenSimulator }: LivingMindPanelProps) {
  const [mindState, setMindState] = useState<MindState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMindState = async (force = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const endpoint = force ? '/api/mind-state' : '/api/mind-state';
      const res = await fetch(endpoint, {
        method: force ? 'POST' : 'GET'
      });
      if (res.ok) {
        const data = await res.json();
        setMindState(data);
      }
    } catch (err) {
      console.error('Failed to load mind state:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMindState();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const vectors = mindState?.vectors || {
    career_score: 50,
    finance_score: 50,
    fitness_score: 50,
    execution_score: 50,
    mindset_score: 50,
    daily_thought: 'Evaluating subconscious memory streams...',
    updated_at: new Date().toISOString()
  };

  const tensions = mindState?.tensions || [];

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-400';
    if (score >= 50) return 'text-amber-400 bg-amber-400';
    return 'text-rose-400 bg-rose-400';
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-md h-full bg-[#0d0e16]/95 border-l border-white/15 p-6 shadow-2xl flex flex-col text-white overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-pulse" />
            <h2 className="text-base font-serif font-bold text-white tracking-wide">
              Subconscious Living Mind
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMindState(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xs font-mono disabled:opacity-40"
              title="Re-synthesize Neural State"
            >
              {isRefreshing ? '...' : '↻'}
            </button>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
              aria-label="Close panel"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {/* Daily Subconscious Pulse */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black border border-indigo-500/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-15">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.1 6.7 5.2 8.1l.8.4V22h6v-2.5l.8-.4C18.9 17.7 21 14.6 21 11a9 9 0 0 0-9-9z"/>
              </svg>
            </div>
            <span className="text-[10px] font-mono uppercase text-indigo-400 tracking-widest block mb-1">
              Daily Inner Voice Pulse
            </span>
            <p className="text-xs font-serif italic text-white/90 leading-relaxed">
              &quot;{vectors.daily_thought}&quot;
            </p>
          </div>

          {/* Life Vectors (0-100) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-white/60 tracking-wider">
                Subconscious Life Vectors
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-500/20">
                Live Telemetry
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                { key: 'career', label: 'Career & Trajectory', score: vectors.career_score, icon: '💼', color: '#00f0ff' },
                { key: 'finance', label: 'Financial Autonomy', score: vectors.finance_score, icon: '💰', color: '#10b981' },
                { key: 'fitness', label: 'Physical Vitality', score: vectors.fitness_score, icon: '⚡', color: '#f59e0b' },
                { key: 'execution', label: 'Execution Velocity', score: vectors.execution_score, icon: '🎯', color: '#818cf8' },
                { key: 'mindset', label: 'Mindset & Clarity', score: vectors.mindset_score, icon: '🧠', color: '#c084fc' },
              ].map((vec) => (
                <div 
                  key={vec.key} 
                  className="bg-white/[0.03] hover:bg-white/[0.06] p-3 rounded-2xl border border-white/10 transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm shadow-inner">
                      {vec.icon}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white/90 group-hover:text-white transition-colors">
                        {vec.label}
                      </div>
                      <div className="w-36 h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-700"
                          style={{ 
                            width: `${vec.score}%`,
                            backgroundColor: vec.color,
                            boxShadow: `0 0 10px ${vec.color}80`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span 
                      className="font-mono text-sm font-bold tracking-tight"
                      style={{ color: vec.color }}
                    >
                      {vec.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Cognitive Tensions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-white/60 tracking-wider">
                Active Cognitive Tensions
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/20">
                {tensions.length} Detected
              </span>
            </div>

            {tensions.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-white/50 text-center">
                No active tensions detected. Memory graph is coherent.
              </div>
            ) : (
              <div className="space-y-3">
                {tensions.map((t) => (
                  <div 
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${
                        t.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        t.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {t.severity}
                      </span>
                      <span className="text-[10px] font-mono text-white/40">
                        {t.dimension.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white leading-tight">
                      {t.headline}
                    </h4>

                    <p className="text-[11px] text-white/70 leading-relaxed font-sans">
                      {t.analysis}
                    </p>

                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <span className="text-[10px] font-mono text-cyan-400 block mb-0.5">
                        ⚡ Direct Move:
                      </span>
                      <p className="text-[11px] text-white/90 font-medium">
                        {t.actionable_directive}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Decision Simulation Launcher */}
          <div className="pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenSimulator();
              }}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-mono text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Launch &quot;What-If&quot; Simulator</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
