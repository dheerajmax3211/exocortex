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

  const handleGoogleLogin = async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setMessage({
        text: 'Supabase credentials are not configured yet in .env.local or Vercel.',
        type: 'info'
      });
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage({ text: error.message, type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to initiate Google login', type: 'error' });
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
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
          
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0f0f15] px-2 text-white/40">Or continue with</span>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white/5 border border-white/10 text-white font-medium py-2.5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
