'use client'

import React, { useState, useEffect } from 'react'
import Navigation from '@/components/ui/Navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const [speakAsMe, setSpeakAsMe] = useState(false)
  const [autoSave, setAutoSave] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [info, setInfo] = useState<any>(null)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isDreaming, setIsDreaming] = useState(false)
  const [dreamStatus, setDreamStatus] = useState<string | null>(null)

  useEffect(() => {
    setSpeakAsMe(localStorage.getItem('speakAsMe') === 'true')
    setAutoSave(localStorage.getItem('autoSave') === 'true')
    setTheme(localStorage.getItem('theme') || 'dark')

    fetch('/api/settings/info')
      .then(res => res.json())
      .then(data => setInfo(data))
      .catch(() => {})
  }, [])

  const handleSpeakAsMeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked
    setSpeakAsMe(val)
    localStorage.setItem('speakAsMe', String(val))
  }

  const handleAutoSaveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked
    setAutoSave(val)
    localStorage.setItem('autoSave', String(val))
  }

  const handleThemeToggle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setTheme(val)
    localStorage.setItem('theme', val)
    if (val === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `virtual_brain_backup_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        alert('Export failed')
      }
    } catch (err) {
      console.error(err)
      alert('Error exporting data')
    } finally {
      setIsExporting(false)
    }
  }
  
  const handleReprocess = async () => {
    setIsReprocessing(true)
    setReprocessStatus('Reprocessing all committed entries into your knowledge graph...')
    try {
      const res = await fetch('/api/reprocess', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'all' })
      })
      const data = await res.json()
      if (data.success) {
        setReprocessStatus(data.message || `Reprocessed ${data.reprocessed} entries successfully.`)
      } else {
        setReprocessStatus('Failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err: any) {
      console.error(err)
      setReprocessStatus('Reprocessing error: ' + err.message)
    } finally {
      setIsReprocessing(false)
    }
  }

  const handleDream = async () => {
    setIsDreaming(true)
    setDreamStatus('Replaying memories during REM dream sleep...')
    try {
      const res = await fetch('/api/dream', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.dream) {
        setDreamStatus(`✨ ${data.dream.title}: ${data.dream.insight}`)
      } else {
        setDreamStatus(data.message || 'Dream consolidation complete.')
      }
    } catch (e: any) {
      setDreamStatus('Dream failed: ' + e.message)
    } finally {
      setIsDreaming(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/auth/signout', { method: 'POST' })
    } finally {
      window.location.href = '/auth/login'
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-32 overflow-y-auto">
      <div className="max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-serif font-bold mb-6 text-white">Settings & Facilities</h1>

        <div className="space-y-6">
          {/* Quick Access to Specialized Facilities */}
          <section className="bg-[#12121c] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold mb-4">
              AI Memory Facilities
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link 
                href="/import"
                className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col justify-between"
              >
                <div className="text-sm font-medium text-white">Bulk Import</div>
                <div className="text-[11px] text-white/50 mt-1">Paste movie/food lists</div>
              </Link>

              <Link 
                href="/backfill"
                className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col justify-between"
              >
                <div className="text-sm font-medium text-white">Backfill Mode</div>
                <div className="text-[11px] text-white/50 mt-1">Prompted life periods</div>
              </Link>

              <Link 
                href="/quiz"
                className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col justify-between"
              >
                <div className="text-sm font-medium text-white">Recall Quiz</div>
                <div className="text-[11px] text-white/50 mt-1">SM-2 memory recall</div>
              </Link>
            </div>
          </section>

          {/* Model & System Info */}
          <section className="bg-[#12121c] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold mb-4">
              LLM & System Configuration
            </h2>
            {info ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Provider</span>
                  <span className="text-indigo-400 font-bold uppercase">{info.provider}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Model</span>
                  <span className="text-white">{info.model}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Timezone</span>
                  <span className="text-white">{info.timezone}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-white/50">Backup Target</span>
                  <span className="text-white truncate max-w-[200px]">{info.backupRepo}</span>
                </div>
              </div>
            ) : (
              <div className="h-20 animate-pulse bg-white/5 rounded-lg" />
            )}
          </section>

          {/* Preferences */}
          <section className="bg-[#12121c] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold mb-6">
              Preferences
            </h2>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-white font-medium text-sm">Speak-as-me Mode</div>
                <div className="text-xs text-white/50 mt-0.5">Render Ask answers in 1st person (&quot;I visited...&quot;)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={speakAsMe} onChange={handleSpeakAsMeToggle} />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-white font-medium text-sm">Auto-save Confident Memories</div>
                <div className="text-xs text-white/50 mt-0.5">Skip review sheet when there are no ambiguities or questions</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoSave} onChange={handleAutoSaveToggle} />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium text-sm">Theme</div>
                <div className="text-xs text-white/50 mt-0.5">Application color scheme</div>
              </div>
              <select 
                value={theme} 
                onChange={handleThemeToggle} 
                className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </section>

          {/* Data Management */}
          <section className="bg-[#12121c] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold mb-4">
              Data Management & Backup
            </h2>
            
            <div className="space-y-3">
              <button 
                onClick={handleExport} 
                disabled={isExporting}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
              >
                <div>
                  <div className="text-white font-medium text-sm text-left">Export All Data</div>
                  <div className="text-xs text-white/50 text-left mt-0.5">JSON archive + Markdown summary</div>
                </div>
                <span className="text-xs font-mono text-indigo-400">{isExporting ? 'Exporting...' : 'Download'}</span>
              </button>
              
              <button 
                onClick={handleReprocess} 
                disabled={isReprocessing}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
              >
                <div>
                  <div className="text-white font-medium text-sm text-left">Reprocess Memories</div>
                  <div className="text-xs text-white/50 text-left mt-0.5">Rebuild graph from raw entries</div>
                </div>
                <span className="text-xs font-mono text-indigo-400">{isReprocessing ? 'Processing...' : 'Run'}</span>
              </button>

              {reprocessStatus && (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white/80 font-mono">
                  {reprocessStatus}
                </div>
              )}

              <button 
                onClick={handleDream} 
                disabled={isDreaming}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
              >
                <div>
                  <div className="text-white font-medium text-sm text-left">Trigger Dream Consolidation</div>
                  <div className="text-xs text-white/50 text-left mt-0.5">Subconscious pattern synthesis across years</div>
                </div>
                <span className="text-xs font-mono text-indigo-400">{isDreaming ? 'Consolidating...' : 'Dream'}</span>
              </button>

              {dreamStatus && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 font-mono">
                  {dreamStatus}
                </div>
              )}
            </div>
          </section>

          {/* Account */}
          <section className="bg-[#12121c] border border-white/10 rounded-2xl p-6 shadow-lg">
            <h2 className="text-xs font-mono uppercase tracking-wider text-white/60 font-semibold mb-4">
              Account
            </h2>
            
            <button 
              onClick={handleSignOut} 
              className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition-colors border border-red-500/20 text-sm"
            >
              Sign Out
            </button>
          </section>
        </div>
      </div>

      <Navigation />
    </main>
  )
}
