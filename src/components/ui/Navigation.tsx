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
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-panel safe-area-pb border-t border-[var(--border)]">
      <div className="flex items-center justify-around px-2 py-3 h-[72px]">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path
          return (
            <Link 
              key={tab.name} 
              href={tab.path}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-2xl transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill={isActive ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                strokeWidth={isActive ? '0' : '2'} 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="mb-1"
              >
                {tab.icon}
              </svg>
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
