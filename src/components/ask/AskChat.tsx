'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  citations?: string[];
  isNotRecorded?: boolean;
}

export default function AskChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [speakAsMe, setSpeakAsMe] = useState(true);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('speakAsMe');
    if (saved !== null) {
      setSpeakAsMe(saved === 'true');
    }
  }, []);

  const toggleSpeakAsMe = () => {
    const next = !speakAsMe;
    setSpeakAsMe(next);
    localStorage.setItem('speakAsMe', String(next));
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageText = customText || input;
    if ((!messageText.trim() && !attachedImage) || isLoading) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: messageText,
      image: attachedImage || undefined
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const currentImage = attachedImage;
    setAttachedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          speak_as_me: speakAsMe,
          image: currentImage
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

  const samplePrompts = [
    { title: "📸 Person / Dating Evaluation", text: "How's this girl? Would I like her based on her vibe, image, and info?" },
    { title: "🎬 Movie Taste Simulation", text: "Would I like Dune: Part Two based on everything you know about my taste?" },
    { title: "🧠 Honest Gut Check", text: "Be my inner voice: what would I honestly think about this situation?" },
    { title: "🍻 Favorite Spot Recall", text: "Where would I genuinely want to hang out tonight knowing my past favorites?" }
  ];

  return (
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-4 pb-safe">
      {/* Consciousness Mode Banner */}
      <div className="flex items-center justify-between py-2 px-3 mb-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-white/80">
            {speakAsMe ? 'Virtual Me (Digital Twin Active)' : 'Virtual Assistant (Third-Person)'}
          </span>
        </div>
        <button 
          onClick={toggleSpeakAsMe}
          className="text-[11px] text-indigo-300 hover:text-white underline transition-colors"
        >
          {speakAsMe ? 'Switch to 3rd Person' : 'Switch to 1st Person'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 py-4 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div>
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.31 2.69 6 6 6h4a6 6 0 0 0 6-6 8 8 0 0 0-8-8z"/>
                  <path d="M10 18v3"/>
                  <path d="M14 18v3"/>
                </svg>
              </div>
              <h2 className="text-xl font-serif text-white font-semibold">Alive Virtual Me</h2>
              <p className="text-sm text-white/50 max-w-md mt-1">
                Your living digital consciousness. Send text or attach photos (dating profiles, outfits, places) to get an unfiltered gut check from your exact vantage point.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(p.text);
                    if (p.title.includes('📸')) {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="p-3 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                >
                  <div className="text-xs font-medium text-indigo-300 group-hover:text-white transition-colors">{p.title}</div>
                  <div className="text-[11px] text-white/40 mt-1 line-clamp-2">{p.text}</div>
                </button>
              ))}
            </div>
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
                      : 'bg-white/10 text-white font-serif text-base sm:text-lg leading-relaxed shadow-lg'
                }`}
              >
                {/* User attached image rendering */}
                {msg.image && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/20 max-w-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.image} alt="User upload" className="w-full h-auto max-h-60 object-cover" />
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>

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
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-150"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-300"></span>
              <span className="text-xs font-mono text-white/50 ml-2">Simulating your mind...</span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Image Preview Thumbnail Before Sending */}
      {attachedImage && (
        <div className="relative inline-block mb-2 ml-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={attachedImage} 
            alt="Preview" 
            className="w-16 h-16 rounded-xl object-cover border-2 border-indigo-500 shadow-md"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-1.5 -right-1.5 bg-black/80 hover:bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center border border-white/20 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="pt-2 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Hidden File Input for Vision */}
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleImageSelect}
          />

          {/* Camera / Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-full border transition-all ${
              attachedImage 
                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Attach image or photo for visual evaluation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={attachedImage ? "How's this person / would I like them?" : "Ask me anything or attach an image..."}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-6 py-3 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors text-sm sm:text-base"
          />

          <button 
            type="submit" 
            disabled={(!input.trim() && !attachedImage) || isLoading}
            className="bg-white text-black p-3 rounded-full hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
