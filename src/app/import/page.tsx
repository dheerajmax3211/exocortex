'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const [inputText, setInputText] = useState('');
  const [entityType, setEntityType] = useState('Movie');
  const [preview, setPreview] = useState<{new: any[], existing: any[], duplicates: any[]} | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleProcess = async () => {
    setLoading(true);
    try {
      const items = inputText.split('\n').filter(i => i.trim());
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type: entityType, action: 'preview' })
      });
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: preview.new, type: entityType, action: 'commit' })
      });
      router.push('/');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 pb-20">
      <h1 className="text-2xl font-bold mb-4">Bulk Import</h1>
      
      <div className="mb-4">
        <label className="block mb-2">Entity Type</label>
        <select 
          className="w-full bg-gray-900 border border-gray-800 p-2 rounded"
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
        >
          <option>Movie</option>
          <option>Restaurant</option>
          <option>Book</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-2">Paste items (one per line, optional | rating | year)</label>
        <textarea 
          className="w-full h-40 bg-gray-900 border border-gray-800 p-2 rounded"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
        />
      </div>

      <button 
        onClick={handleProcess}
        disabled={loading || !inputText}
        className="bg-blue-600 px-4 py-2 rounded mb-6 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Preview Import'}
      </button>

      {preview && (
        <div className="bg-gray-900 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-2">Preview</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <h3 className="font-medium text-green-400">New ({preview.new.length})</h3>
              <ul className="text-sm">
                {preview.new.map((i, idx) => <li key={idx}>{i.title} {i.year ? `(${i.year})` : ''}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-yellow-400">Existing ({preview.existing.length})</h3>
              <ul className="text-sm">
                {preview.existing.map((i, idx) => <li key={idx}>{i.title}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-red-400">Duplicates in input ({preview.duplicates.length})</h3>
              <ul className="text-sm">
                {preview.duplicates.map((i, idx) => <li key={idx}>{i.title}</li>)}
              </ul>
            </div>
          </div>
          
          <button 
            onClick={handleCommit}
            disabled={loading || preview.new.length === 0}
            className="bg-green-600 px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Committing...' : 'Commit New Items'}
          </button>
        </div>
      )}
    </div>
  );
}
