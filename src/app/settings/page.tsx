'use client'

import React, { useState, useEffect } from 'react'
import Navigation from '@/components/ui/Navigation'

export default function SettingsPage() {
  const [speakAsMe, setSpeakAsMe] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    setSpeakAsMe(localStorage.getItem('speakAsMe') === 'true')
    setTheme(localStorage.getItem('theme') || 'dark')
  }, [])

  const handleSpeakAsMeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked
    setSpeakAsMe(val)
    localStorage.setItem('speakAsMe', String(val))
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
    try {
      const res = await fetch('/api/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'brain_export.json'
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        alert('Export failed')
      }
    } catch (err) {
      console.error(err)
      alert('Error exporting data')
    }
  }
  
  const handleReprocess = async () => {
    try {
      alert('Reprocessing started in background.')
      await fetch('/api/reprocess', { method: 'POST' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSignOut = async () => {
    await fetch('/auth/signout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-24">
      <div className="max-w-xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-8 text-gray-100">Settings</h1>

        <div className="space-y-6">
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-200 border-b border-gray-800 pb-2">Preferences</h2>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-gray-200 font-medium">Speak as me</div>
                <div className="text-xs text-gray-500 mt-1">Generate first-person summaries</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={speakAsMe} onChange={handleSpeakAsMeToggle} />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-200 font-medium">Theme</div>
                <div className="text-xs text-gray-500 mt-1">App appearance</div>
              </div>
              <select 
                value={theme} 
                onChange={handleThemeToggle} 
                className="bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-200 border-b border-gray-800 pb-2">Data Management</h2>
            
            <div className="space-y-3">
              <button onClick={handleExport} className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                <span className="text-gray-200 font-medium">Export Data</span>
                <span className="text-xs text-gray-400">JSON</span>
              </button>
              
              <button onClick={handleReprocess} className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                <span className="text-gray-200 font-medium">Reprocess Memories</span>
                <span className="text-xs text-gray-400">LLM sync</span>
              </button>
            </div>
          </section>

          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-6 text-gray-200 border-b border-gray-800 pb-2">Account</h2>
            
            <button onClick={handleSignOut} className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium transition border border-red-500/20">
              Sign Out
            </button>
          </section>
        </div>
      </div>

      <Navigation />
    </main>
  )
}
