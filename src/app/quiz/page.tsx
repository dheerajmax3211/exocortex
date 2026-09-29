'use client';

import React, { useState, useEffect } from 'react';
import Navigation from '@/components/ui/Navigation';
import Link from 'next/link';

export default function QuizPage() {
  const [question, setQuestion] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{correct: boolean, correctAnswer: string, message: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQuestion = async () => {
    setLoading(true);
    setResult(null);
    setAnswer('');
    try {
      const res = await fetch('/api/quiz');
      const data = await res.json();
      setQuestion(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !answer.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          entity_id: question.entity_id, 
          answer: answer.trim(), 
          correct_answer: question.correct_answer,
          question_type: question.question_type 
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-4 pb-28 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/settings" className="text-white/60 hover:text-white text-xs font-mono transition-colors">
            &larr; Back to Settings
          </Link>
          <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            SM-2 Spaced Repetition
          </span>
        </div>

        <div className="bg-[#12121c] border border-white/10 p-6 sm:p-8 rounded-2xl shadow-2xl">
          <h1 className="text-2xl font-serif font-bold text-white mb-2 text-center">Recall Quiz</h1>
          <p className="text-xs text-white/50 text-center mb-6">Test your memory on details from your personal graph</p>
          
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-mono text-white/50">Consulting your memory graph...</p>
            </div>
          ) : question?.question ? (
            <div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 mb-6">
                <p className="text-base sm:text-lg text-white font-serif leading-relaxed text-center">
                  "{question.question}"
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 p-3.5 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm font-sans"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your memory recall..."
                  disabled={!!result || isSubmitting}
                  autoFocus
                />
                
                {!result ? (
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !answer.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Checking Recall...' : 'Submit Recall'}
                  </button>
                ) : (
                  <div className={`p-4 rounded-xl border ${result.correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                    <p className="font-bold text-sm mb-1">{result.correct ? '✓ Exact Recall!' : '✗ Memory Gap'}</p>
                    <p className="text-xs text-white/80">{result.message}</p>
                    {!result.correct && (
                      <p className="text-xs mt-2 font-mono text-white/90">
                        Recorded Answer: <strong>{result.correctAnswer}</strong>
                      </p>
                    )}
                  </div>
                )}
              </form>
              
              {result && (
                <button 
                  onClick={fetchQuestion}
                  className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-medium text-sm transition-colors"
                >
                  Next Recall Question &rarr;
                </button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-white/60 text-sm space-y-3">
              <p>{question?.message || 'No memories found to quiz. Add more entries to your brain!'}</p>
              <Link href="/" className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs rounded-xl font-medium">
                Go to Explore
              </Link>
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </main>
  );
}
