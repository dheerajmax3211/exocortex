'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AudioRecorder } from '@/components/add/AudioRecorder';

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
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('speakAsMe');
    if (saved !== null) {
      setSpeakAsMe(saved === 'true');
    }
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setSpeechSupported(supported);
    if (supported) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    try {
      const savedMessages = sessionStorage.getItem('virtual_twin_messages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem('virtual_twin_messages', JSON.stringify(messages));
      } else {
        sessionStorage.removeItem('virtual_twin_messages');
      }
    } catch (e) {}
  }, [messages]);

  const handleClearChat = () => {
    if (activeSpeechId) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
    }
    setMessages([]);
    try {
      sessionStorage.removeItem('virtual_twin_messages');
    } catch (e) {}
  };

  const toggleSpeakAsMe = () => {
    const next = !speakAsMe;
    setSpeakAsMe(next);
    localStorage.setItem('speakAsMe', String(next));
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSpeakText = (messageId: string, text: string) => {
    if (!speechSupported) return;

    if (activeSpeechId === messageId) {
      window.speechSynthesis.cancel();
      setActiveSpeechId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Strip markdown formatting, symbols, and links for natural voice playback
    const cleanSpeech = text
      .replace(/###\s+/g, '')
      .replace(/####\s+/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/>\s+/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[-•]\s+/g, '. ')
      .replace(/[^\w\s.,!?'"%-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en-IN') || 
      v.lang.startsWith('en-GB') || 
      v.name.includes('Natural') || 
      v.lang.startsWith('en-US')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => setActiveSpeechId(null);
    utterance.onerror = () => setActiveSpeechId(null);

    window.speechSynthesis.speak(utterance);
    setActiveSpeechId(messageId);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      // Downscale and compress to keep payload safely within serverless limits (<400KB)
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setAttachedImage(compressed);
        } else {
          setAttachedImage(rawDataUrl);
        }
      };
      img.onerror = () => {
        setAttachedImage(rawDataUrl);
      };
      img.src = rawDataUrl;
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
      const fallbackMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: speakAsMe 
          ? "I hit a momentary glitch processing that memory. Give me just a second and try asking me again."
          : "Encountered a momentary connection error while accessing your memory network. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, fallbackMsg]);
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
    <div className="flex flex-col h-full w-full max-w-3xl mx-auto p-4 pb-safe relative">
      {/* Consciousness Command Deck Header */}
      <div className="flex items-center justify-between py-2.5 px-4 mb-3 rounded-2xl bg-[#0c0d18]/85 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-xs font-mono shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500 shadow-[0_0_8px_#22d3ee]"></span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tracking-[0.2em] uppercase font-bold text-cyan-400">
              EXOCORTEX
            </span>
            <span className="text-white/20">&middot;</span>
            <span className="text-[11px] text-white/80 font-medium">
              {speakAsMe ? 'Virtual Twin (1st Person)' : 'Analyst Persona (3rd Person)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-[11px] text-white/40 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-all"
              title="Reset conversation"
            >
              Clear
            </button>
          )}
          <button 
            onClick={toggleSpeakAsMe}
            className="text-[11px] px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span>{speakAsMe ? 'Switch to 3rd' : 'Switch to 1st'}</span>
            <span className="text-cyan-400 text-[10px]">⇄</span>
          </button>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-5 py-2 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.31 2.69 6 6 6h4a6 6 0 0 0 6-6 8 8 0 0 0-8-8z"/>
                  <path d="M10 18v3"/>
                  <path d="M14 18v3"/>
                </svg>
              </div>
              <h2 className="text-2xl font-serif text-white font-medium tracking-tight">Cognitive Sparring Deck</h2>
              <p className="text-xs font-mono text-white/50 max-w-md mt-1.5 leading-relaxed">
                Direct neural interface with your episodic memory graph, subconscious life vectors, and mental models. Speak, upload images, or listen to thoughts out loud.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(p.text);
                    if (p.title.includes('📸')) {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="p-3.5 text-left rounded-2xl bg-[#0c0d18]/60 hover:bg-[#121424]/80 border border-white/10 hover:border-cyan-500/40 transition-all duration-200 group shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between"
                >
                  <div className="text-xs font-medium text-cyan-300 group-hover:text-cyan-200 transition-colors flex items-center justify-between">
                    <span>{p.title}</span>
                    <span className="text-white/20 group-hover:text-cyan-400 text-xs transition-colors">↗</span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-1.5 line-clamp-2 leading-relaxed font-sans">{p.text}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 relative group transition-all ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-cyan-950/40 via-blue-950/50 to-indigo-950/60 border border-cyan-500/30 border-r-2 border-r-cyan-400 text-white rounded-tr-sm shadow-lg' 
                    : msg.isNotRecorded 
                      ? 'bg-rose-950/40 text-rose-200 border border-rose-900/50 rounded-tl-sm' 
                      : 'bg-[#0c0d18]/90 text-white border border-white/10 border-t-cyan-500/50 rounded-tl-sm shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-2xl'
                }`}
              >
                {/* User attached image rendering */}
                {msg.image && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-white/20 max-w-xs shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={msg.image} alt="User upload" className="w-full h-auto max-h-60 object-cover" />
                  </div>
                )}

                <div className={`whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user' ? 'text-sm font-sans text-white/95' : 'text-sm sm:text-base font-serif text-slate-100'
                }`}>
                  {msg.content}
                </div>

                {/* Voice speech button & citations for assistant answers */}
                {msg.role === 'assistant' && (
                  <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                    {speechSupported ? (
                      <button
                        onClick={() => handleSpeakText(msg.id, msg.content)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all ${
                          activeSpeechId === msg.id 
                            ? 'bg-cyan-500 text-black font-semibold shadow-[0_0_15px_#22d3ee] animate-pulse' 
                            : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                        }`}
                        title={activeSpeechId === msg.id ? 'Stop voice playback' : 'Listen to Virtual Me speak'}
                      >
                        {activeSpeechId === msg.id ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-black animate-ping"></span>
                            <span>Speaking...</span>
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                            <span>Listen to Twin</span>
                          </>
                        )}
                      </button>
                    ) : <div />}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap items-center">
                        <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Grounding:</span>
                        {msg.citations.map((cit, i) => (
                          <a 
                            key={i} 
                            href={`/timeline?search=${encodeURIComponent(cit)}`}
                            className="text-[11px] font-mono bg-cyan-950/40 text-cyan-300 hover:text-white px-2 py-0.5 rounded-md border border-cyan-500/30 hover:border-cyan-400 transition-colors inline-block"
                          >
                            [{cit}]
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start">
            <div className="bg-[#0c0d18]/90 border border-cyan-500/30 rounded-2xl rounded-tl-sm p-4 flex items-center gap-3 backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-4 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="w-1.5 h-6 rounded-full bg-indigo-400 animate-pulse delay-100"></span>
                <span className="w-1.5 h-3 rounded-full bg-cyan-400 animate-pulse delay-200"></span>
              </div>
              <span className="text-xs font-mono text-cyan-300/80">Simulating neural pathways &amp; episodic memories...</span>
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
            className="w-16 h-16 rounded-xl object-cover border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-1.5 -right-1.5 bg-black/90 hover:bg-rose-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center border border-white/20 transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      {/* Futuristic Floating Input Dock */}
      <div className="pt-2 shrink-0">
        <form 
          onSubmit={handleSubmit} 
          className="flex items-center gap-2 p-1.5 rounded-full bg-[#0c0d18]/90 backdrop-blur-2xl border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.7)]"
        >
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
            className={`p-2.5 rounded-full border transition-all shrink-0 ${
              attachedImage 
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Attach image or photo for visual evaluation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          {/* Voice Audio Recorder */}
          <div className="shrink-0">
            <AudioRecorder 
              onTranscription={(transcript) => {
                setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
              }}
              isProcessing={isLoading}
            />
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={attachedImage ? "How's this person / would I like them?" : "Spar with your digital twin or speak..."}
            className="flex-1 bg-transparent px-3 py-2 text-white placeholder-white/30 focus:outline-none text-sm font-sans"
          />

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={(!input.trim() && !attachedImage) || isLoading}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-2.5 rounded-full hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            title="Send query"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
