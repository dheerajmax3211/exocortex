'use client';

import React, { useState, useRef, useEffect } from 'react';
import { playNodeTone, playSuccessChime } from '@/lib/audio/soundscapes';

interface QuickSparDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onHighlightEntities: (entityNames: string[]) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

export default function QuickSparDrawer({
  isOpen,
  onClose,
  onHighlightEntities
}: QuickSparDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "I am your digital alter-ego. Ask me anything about your past, or let's spar on your current priorities and tensions."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    setIsLoading(true);
    playNodeTone('other');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });

      if (!res.ok) throw new Error('Sparring failed');

      const data = await res.json();
      const answer = data.answer || "I'm turning that over in my neural network...";
      const citations = data.citations || [];

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        citations
      }]);

      playSuccessChime();

      // Extract entity names from answer and citations to highlight on the 3D graph
      const mentioned: string[] = [...citations];
      const bracketMatches = answer.match(/\[\[(.*?)\]\]/g);
      if (bracketMatches) {
        bracketMatches.forEach((m: string) => mentioned.push(m.replace(/\[\[|\]\]/g, '').trim()));
      }

      if (mentioned.length > 0) {
        onHighlightEntities(mentioned);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Neural sparring encountered a transient hiccup. Please ask again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full sm:w-96 md:w-[420px] bg-[#090a12]/90 backdrop-blur-2xl border-l border-white/10 shadow-[-16px_0_40px_rgba(0,0,0,0.8)] flex flex-col text-white animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-ping" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold tracking-wider text-cyan-300 uppercase">
              Neural Sparring Copilot
            </h3>
            <p className="text-[10px] font-mono text-white/40">Real-Time Graph Grounded</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          title="Close Copilot (Esc)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-100 rounded-br-sm'
                  : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>

              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                  {m.citations.map((c, cIdx) => (
                    <button
                      key={cIdx}
                      onClick={() => onHighlightEntities([c])}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                    >
                      🔗 {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400/80 p-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
            <span>Scanning 94 neural nodes & memories...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Dock */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Spar with your digital twin..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-7 h-7 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
