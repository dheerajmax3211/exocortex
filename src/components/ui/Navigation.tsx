'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const tabs = [
    { name: 'Explore', path: '/', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { name: 'Ask', path: '/ask', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
    { name: 'Timeline', path: '/timeline', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
    { name: 'Browse', path: '/browse', icon: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></> },
    { name: 'Settings', path: '/settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></> }
  ]

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-[#0a0a12]/75 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] transition-all">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path
          return (
            <Link 
              key={tab.name} 
              href={tab.path}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-mono tracking-wider transition-all duration-200 group ${
                isActive 
                  ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)] border border-white/15' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill={isActive ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                strokeWidth={isActive ? '0' : '2'} 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${isActive ? 'text-cyan-400 scale-105' : 'group-hover:scale-110'}`}
              >
                {tab.icon}
              </svg>
              <span className={`text-[11px] font-medium transition-all ${isActive ? 'inline text-white' : 'hidden md:inline'}`}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
