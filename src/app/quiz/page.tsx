'use client';
import { useState, useEffect } from 'react';

export default function QuizPage() {
  const [question, setQuestion] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{correct: boolean, correctAnswer: string} | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quiz');
      const data = await res.json();
      setQuestion(data);
      setResult(null);
      setAnswer('');
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
    if (!question) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: question.entity_id, answer, question_type: question.type })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 pb-20 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-8">Recall Quiz</h1>
      
      {question ? (
        <div className="bg-gray-900 p-8 rounded-xl shadow-lg max-w-lg w-full">
          <p className="text-xl mb-6 text-center">{question.question}</p>
          
          <form onSubmit={handleSubmit}>
            <input 
              type="text" 
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer..."
              disabled={!!result}
            />
            
            {!result ? (
              <button 
                type="submit" 
                disabled={loading || !answer}
                className="w-full bg-blue-600 px-4 py-3 rounded font-semibold disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Submit'}
              </button>
            ) : (
              <div className={`p-4 rounded mb-4 ${result.correct ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                <p className="font-bold text-lg mb-1">{result.correct ? 'Correct!' : 'Incorrect.'}</p>
                {!result.correct && <p>The correct answer was: {result.correctAnswer}</p>}
              </div>
            )}
          </form>
          
          {result && (
            <button 
              onClick={fetchQuestion}
              className="w-full mt-4 bg-gray-700 px-4 py-3 rounded font-semibold hover:bg-gray-600 transition"
            >
              Next Question
            </button>
          )}
        </div>
      ) : (
        <p>Loading question...</p>
      )}
    </div>
  );
}
