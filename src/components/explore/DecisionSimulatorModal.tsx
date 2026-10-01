'use client';

import React, { useState } from 'react';
import type { DecisionSimulationResult } from '@/lib/decision-simulator';

interface DecisionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SCENARIOS = [
  "What if I leave TruAudience in 6 months to pursue a ₹35 LPA offer in Singapore?",
  "What if I pause dating apps for 6 months to focus 100% on fitness and distributed systems?",
  "What if I move full-time to Mysore to eliminate rent and aggressively wipe out all loans?",
  "What if I buy the 85mm portrait lens on credit card right now vs waiting for bonus?"
];

export default function DecisionSimulatorModal({ isOpen, onClose }: DecisionSimulatorModalProps) {
  const [scenario, setScenario] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DecisionSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (textToSimulate?: string) => {
    const text = textToSimulate || scenario;
    if (!text || text.trim().length < 5) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: text.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Simulation failed');
      }

      const simResult: DecisionSimulationResult = await res.json();
      setResult(simResult);
    } catch (err: any) {
      setError(err.message || 'Something went wrong during simulation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-2xl max-h-[90vh] bg-[#0c0d14] border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
            <h2 className="text-lg font-serif font-bold text-white tracking-wide">
              Decision &amp; Scenario Simulator
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Input Section */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-white/60 tracking-wider">
              Hypothetical Decision / &quot;What If?&quot;
            </label>
            <div className="relative">
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="E.g. What if I resign from TransUnion in 6 months to pursue a ₹35 LPA offer in Singapore?"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors resize-none font-sans"
              />
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setScenario(p);
                    handleSimulate(p);
                  }}
                  className="text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1 text-white/70 hover:text-white transition-colors text-left truncate max-w-full"
                >
                  &quot;{p.slice(0, 48)}...&quot;
                </button>
              ))}
            </div>

            <button
              onClick={() => handleSimulate()}
              disabled={isLoading || scenario.trim().length < 5}
              className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white font-medium text-xs font-mono uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Simulating All Life Vectors...</span>
                </>
              ) : (
                <>
                  <span>Run Neural Simulation</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Simulation Output */}
          {result && (
            <div className="space-y-4 pt-3 border-t border-white/10 animate-fadeIn">
              {/* Verdict & Probability Banner */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-white/50 tracking-widest block mb-0.5">
                    Strategic Verdict
                  </span>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {result.verdict}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-white/50 tracking-widest block mb-0.5">
                    Success Probability
                  </span>
                  <span className="text-xl font-mono font-bold text-cyan-400">
                    {result.success_probability}%
                  </span>
                </div>
              </div>

              {/* Alter-Ego Quote */}
              {result.alter_ego_quote && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-black border border-indigo-500/20">
                  <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest block mb-1">
                    Inner Voice Sparring Partner:
                  </span>
                  <p className="text-sm font-serif italic text-white/90 leading-relaxed">
                    &quot;{result.alter_ego_quote}&quot;
                  </p>
                </div>
              )}

              {/* Multi-Domain Analysis Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block mb-1">
                    Financial Impact
                  </span>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {result.financial_impact}
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                    Career Trajectory
                  </span>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {result.career_trajectory}
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block mb-1">
                    Wellbeing &amp; Social
                  </span>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {result.wellbeing_and_psychology}
                  </p>
                </div>
              </div>

              {/* Tactical Steps */}
              {result.tactical_steps && result.tactical_steps.length > 0 && (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <h4 className="text-xs font-mono uppercase text-white/70 tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span>⚡ Concrete Tactical Roadmap</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-white/85">
                    {result.tactical_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-cyan-400 text-[10px] mt-0.5">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blindspots */}
              {result.blindspots && result.blindspots.length > 0 && (
                <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                  <h4 className="text-xs font-mono uppercase text-red-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <span>⚠️ Uncomfortable Blindspots</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-white/80 list-disc list-inside">
                    {result.blindspots.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
