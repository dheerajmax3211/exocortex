'use client';

import React, { useState } from 'react';
import Navigation from '@/components/ui/Navigation';
import Link from 'next/link';

export default function BackfillPage() {
  const [periodName, setPeriodName] = useState('8th Grade');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fields, setFields] = useState({
    school: '',
    classTeacher: '',
    subjectTeachers: '',
    classmates: '',
    friends: '',
    memorableEvents: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName.trim()) return;

    setLoading(true);
    setStatus('Ingesting life period and extracting graph relationships...');
    try {
      const res = await fetch('/api/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          period_name: periodName.trim(), 
          start_date: startDate || null,
          end_date: endDate || null,
          fields 
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.message || `Created ${data.createdEntitiesCount || 0} entities and ${data.createdEdgesCount || 0} connections.`);
      } else {
        setStatus('Error: ' + (data.error || 'Failed to backfill'));
      }
    } catch (err: any) {
      console.error(err);
      setStatus('Error occurred: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fieldDescriptions: Record<string, string> = {
    school: 'Name of the school or institution you attended',
    classTeacher: 'Who was your main class teacher / advisor?',
    subjectTeachers: 'Which teachers taught which subjects? (e.g. Mrs. Sharma taught maths)',
    classmates: 'Classmates or students you remember from this time',
    friends: 'Close friends you spent time with during this period',
    memorableEvents: 'Field trips, sports days, competitions, or notable memories'
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 sm:p-6 pb-28">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/settings" className="text-xs font-mono text-white/60 hover:text-white transition-colors">
            &larr; Back to Settings
          </Link>
          <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            Retrospective Memory Ingestion
          </span>
        </div>

        <div className="bg-[#12121c] border border-white/10 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Backfill Mode</h1>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Fill in old chapters of your life. An LLM connects teachers to subjects, classmates to periods, and schools to you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-mono uppercase text-white/60 mb-2">Period Name *</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500" 
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  placeholder="e.g. 8th Grade, MSc, First Job"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-white/60 mb-2">Start Year/Date</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="e.g. 2012 or 2012-06-01"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-white/60 mb-2">End Year/Date</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="e.g. 2013 or 2013-05-31"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {Object.entries(fields).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs font-mono uppercase text-indigo-400 mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <p className="text-[11px] text-white/40 mb-1.5 font-sans">
                    {fieldDescriptions[key] || 'Provide any details you recall'}
                  </p>
                  <textarea 
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl h-20 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-none"
                    value={value}
                    onChange={(e) => setFields({...fields, [key]: e.target.value})}
                    placeholder={`Free-text details for ${key.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>

            <button 
              type="submit" 
              disabled={loading || !periodName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing & Connecting Graph...' : 'Submit Life Period to Graph'}
            </button>

            {status && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/90">
                {status}
              </div>
            )}
          </form>
        </div>
      </div>

      <Navigation />
    </main>
  );
}
