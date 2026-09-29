'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/ui/Navigation';
import Link from 'next/link';

export default function ImportPage() {
  const [inputText, setInputText] = useState('');
  const [entityType, setEntityType] = useState('movie');
  const [preview, setPreview] = useState<{new: any[], duplicates: any[], total: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const router = useRouter();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setPreview(null);

    try {
      const items = inputText.split('\n').map(i => i.trim()).filter(Boolean);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type: entityType, action: 'preview' })
      });
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      console.error('Preview error:', e);
      alert('Failed to preview items.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || preview.new.length === 0) return;
    setIsCommitting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: preview.new, type: entityType, action: 'commit' })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `Successfully committed ${data.count} items!`);
        router.push('/');
      } else {
        alert(data.error || 'Failed to commit items.');
      }
    } catch (e) {
      console.error(e);
      alert('Commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 sm:p-6 pb-28">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/settings" className="text-xs font-mono text-white/60 hover:text-white transition-colors">
            &larr; Back to Settings
          </Link>
          <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            Bulk Memory Ingestion
          </span>
        </div>

        <div className="bg-[#12121c] border border-white/10 p-6 rounded-2xl shadow-xl space-y-6">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Bulk Import</h1>
            <p className="text-xs text-white/50 mt-1">
              Paste a list of movies, restaurants, or books to ingest them into your consumed memory set.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-white/60 mb-2">Category Type</label>
              <select 
                className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                value={entityType}
                onChange={e => setEntityType(e.target.value)}
              >
                <option value="movie">Movies</option>
                <option value="show">TV Shows</option>
                <option value="restaurant">Restaurants</option>
                <option value="book">Books</option>
                <option value="dish">Dishes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-white/60 mb-2">Upload CSV / Text</label>
              <input 
                type="file" 
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="w-full bg-white/5 border border-white/10 p-2 rounded-xl text-xs text-white/70 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-white/10 file:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-white/60 mb-2">
              Paste Items (one per line, optional: <code className="text-indigo-400">Title | Rating /10 | Year</code>)
            </label>
            <textarea 
              className="w-full h-44 bg-white/5 border border-white/10 p-3.5 rounded-xl font-mono text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={"Inception | 9 | 2010\nThe Godfather | 10 | 1972\nInterstellar | 9 | 2014"}
            />
          </div>

          <button 
            onClick={handleProcess}
            disabled={loading || !inputText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Normalizing & Checking for Duplicates...' : 'Preview Import & Deduplicate'}
          </button>

          {preview && (
            <div className="bg-white/5 border border-white/10 p-5 rounded-xl space-y-4 animate-in fade-in">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="font-serif font-bold text-lg text-white">Import Diff Summary</h3>
                <span className="text-xs font-mono text-white/50">{preview.total || (preview.new.length + preview.duplicates.length)} parsed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono uppercase text-emerald-400 font-semibold">New to Add</span>
                    <span className="text-xs font-bold text-emerald-400">{preview.new.length}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {preview.new.map((i, idx) => (
                      <div key={idx} className="text-xs text-white/80 font-mono truncate">
                        • {i.normalized_title || i.title} {i.year ? `(${i.year})` : ''} {i.rating_10 ? `[★ ${i.rating_10}/10]` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono uppercase text-amber-400 font-semibold">Already in Brain</span>
                    <span className="text-xs font-bold text-amber-400">{preview.duplicates.length}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {preview.duplicates.map((i, idx) => (
                      <div key={idx} className="text-xs text-white/60 font-mono truncate">
                        • {i.normalized_title || i.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleCommit}
                disabled={isCommitting || preview.new.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isCommitting ? 'Committing to Brain...' : `Commit ${preview.new.length} New Entities to Memory`}
              </button>
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </main>
  );
}
