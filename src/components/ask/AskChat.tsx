'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  isNotRecorded?: boolean;
}

export default function AskChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const speakAsMe = typeof window !== 'undefined' && localStorage.getItem('speakAsMe') === 'true';
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          speak_as_me: speakAsMe
        })
      });
      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        citations: data.citations || [],
        isNotRecorded: data.isNotRecorded
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-4 pb-safe">
      <div className="flex-1 overflow-y-auto space-y-6 py-4 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50 text-lg font-serif">
            Ask me anything about your memories...
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : msg.isNotRecorded 
                      ? 'bg-red-900/40 text-red-200 border border-red-900/50'
                      : 'bg-white/10 text-white font-serif text-lg leading-relaxed'
                }`}
              >
                {msg.content}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {msg.citations.map((cit, i) => (
                      <a 
                        key={i} 
                        href={`/timeline?search=${encodeURIComponent(cit)}`}
                        className="text-xs bg-black/40 text-indigo-300 hover:text-white px-2 py-1 rounded-md border border-white/10 transition-colors inline-block"
                      >
                        [{cit}]
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse"></span>
              <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse delay-150"></span>
              <span className="w-2 h-2 rounded-full bg-white/40 animate-pulse delay-300"></span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="pt-4 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a memory..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-6 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="bg-white text-black p-3 rounded-full hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
