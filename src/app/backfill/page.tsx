'use client';
import { useState } from 'react';

export default function BackfillPage() {
  const [period, setPeriod] = useState('High School');
  const [fields, setFields] = useState({
    school: '',
    classTeacher: '',
    subjectTeachers: '',
    classmates: '',
    friends: '',
    events: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Processing...');
    try {
      const res = await fetch('/api/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, fields })
      });
      const data = await res.json();
      setStatus(`Created ${data.createdEntitiesCount || 0} entities and ${data.createdEdgesCount || 0} edges.`);
    } catch (err) {
      setStatus('Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 pb-20">
      <h1 className="text-2xl font-bold mb-4">Backfill Memories</h1>
      
      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="mb-4">
          <label className="block mb-2 text-gray-300">Life Period</label>
          <input 
            type="text" 
            className="w-full bg-gray-900 border border-gray-800 p-2 rounded" 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. 8th Grade, College, First Job"
          />
        </div>

        {Object.entries(fields).map(([key, value]) => (
          <div key={key} className="mb-4">
            <label className="block mb-2 text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
            <textarea 
              className="w-full bg-gray-900 border border-gray-800 p-2 rounded h-24"
              value={value}
              onChange={(e) => setFields({...fields, [key]: e.target.value})}
            />
          </div>
        ))}

        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Submit Backfill'}
        </button>

        {status && <p className="mt-4 text-green-400">{status}</p>}
      </form>
    </div>
  );
}
