'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setMessage({
        text: 'Supabase credentials are not configured yet in .env.local or Vercel.',
        type: 'info'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage({ text: error.message, type: 'error' });
      } else {
        setMessage({
          text: 'Check your email for the magic link to log in!',
          type: 'success',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to send magic link', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl mb-2">Virtual Brain</h1>
          <p className="text-white/50 font-serif italic">A mirror of your mind</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {message && (
            <div className={`p-3 rounded-xl mb-4 text-xs font-mono ${
              message.type === 'success' 
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' 
                : message.type === 'error'
                ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleMagicLink} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-white/70 mb-2">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" 
                required
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-medium py-2.5 rounded-lg hover:bg-white/90 disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
            </button>
          </form>
          
          <p className="text-center text-xs text-white/40">
            A passwordless login link will be sent directly to your inbox.
          </p>
        </div>
      </div>
    </div>
  );
}
