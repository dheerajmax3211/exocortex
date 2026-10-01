'use client';

import React, { useEffect, useState } from 'react';

interface MindState {
  vectors: {
    career_score: number;
    finance_score: number;
    fitness_score: number;
    execution_score: number;
    mindset_score: number;
    daily_thought: string;
  };
  tensions: Array<{
    id: string;
    headline: string;
    analysis: string;
    actionable_directive: string;
    severity: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenSimulator: () => void;
}

export default function MorningBriefingModal({ isOpen, onClose, onOpenSimulator }: Props) {
  const [data, setData] = useState<MindState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !data) {
      setIsLoading(true);
      fetch('/api/mind-state')
        .then(r => r.json())
        .then(d => {
          setData(d);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, data]);

  const handleAcknowledge = () => {
    const todayDate = new Date().toISOString().split('T')[0];
    localStorage.setItem('lastBriefingSeen', todayDate);
    onClose();
  };

  if (!isOpen) return null;

  const topTension = data?.tensions?.[0];
  const topPriority = topTension?.actionable_directive || "Reflect on your current state and recalibrate.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-md bg-[#0c0d18]/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.85)] flex flex-col max-h-[85vh] text-white relative"
      >
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🌅</span>
            <h2 className="text-lg font-serif font-bold text-white tracking-wide">
              Morning Consciousness Briefing
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1 hide-scrollbar">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* Daily Quote */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-black border border-indigo-500/20">
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest block mb-1">
                  Subconscious Alter-Ego:
                </span>
                <p className="text-sm font-serif italic text-white/90 leading-relaxed">
                  &quot;{data.vectors.daily_thought}&quot;
                </p>
              </div>

              {/* Life Vectors */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase text-white/60 tracking-wider">Life Vector Telemetry</h3>
                <div className="grid grid-cols-2 gap-3">
                  <VectorMeter label="Career" value={data.vectors.career_score} color="bg-cyan-400" />
                  <VectorMeter label="Finance" value={data.vectors.finance_score} color="bg-emerald-400" />
                  <VectorMeter label="Fitness" value={data.vectors.fitness_score} color="bg-amber-400" />
                  <VectorMeter label="Execution" value={data.vectors.execution_score} color="bg-indigo-400" />
                </div>
              </div>

              {/* Top Priority / Top Tension */}
              {topTension && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono uppercase text-white/60 tracking-wider">Top Cognitive Tension</h3>
                    <SeverityBadge severity={topTension.severity} />
                  </div>
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                    <strong className="block mb-1 text-red-400">{topTension.headline}</strong>
                    <span className="text-xs opacity-90 block mb-2">{topTension.analysis}</span>
                  </div>
                  
                  <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1">
                      Highest Leverage Move Today:
                    </span>
                    <p className="text-sm text-white/90 font-medium">
                      {topPriority}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
             <div className="text-center py-10 text-white/50 text-sm">Failed to load mind state.</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-2 pt-4 border-t border-white/10">
          <button
            onClick={() => {
               onOpenSimulator();
               onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-medium text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            Run Simulation on this Move
          </button>
          <button
            onClick={handleAcknowledge}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium text-xs font-mono uppercase tracking-wider transition-all flex items-center justify-center"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

function VectorMeter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-mono uppercase text-white/70">{label}</span>
        <span className="text-[10px] font-mono text-white/90">{Math.round(value)}</span>
      </div>
      <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const isCritical = severity === 'critical';
  const isModerate = severity === 'moderate';
  
  const bg = isCritical ? 'bg-red-500/20' : isModerate ? 'bg-amber-500/20' : 'bg-blue-500/20';
  const text = isCritical ? 'text-red-400' : isModerate ? 'text-amber-400' : 'text-blue-400';
  const border = isCritical ? 'border-red-500/30' : isModerate ? 'border-amber-500/30' : 'border-blue-500/30';
  
  return (
    <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${bg} ${text} ${border}`}>
      {severity}
    </span>
  );
}
