import React from 'react'
import Link from 'next/link'
import Navigation from '@/components/ui/Navigation'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!entity) {
    notFound()
  }

  // Fetch facts for this entity
  const { data: facts } = await supabase
    .from('facts')
    .select('*')
    .eq('entity_id', id)
    .is('deleted_at', null)

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-24">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <Link href="/browse" className="text-blue-400 hover:text-blue-300 hover:underline flex items-center text-sm">
            &larr; Back to Browse
          </Link>
          <div className="flex gap-2">
            <Link href={`/?focus=${id}`} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-200 transition">
              Focus in Explore
            </Link>
            <button className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 rounded text-sm text-red-400 transition">
              Delete
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-100">{entity.name}</h1>
            <span className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300 uppercase tracking-wider">{entity.type}</span>
          </div>
          
          {entity.summary && (
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 text-base md:text-lg mb-8 leading-relaxed">
                {entity.summary}
              </p>
            </div>
          )}

          {facts && facts.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-800">
              <h3 className="text-xl font-semibold mb-4 text-gray-200">Facts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {facts.map(fact => (
                  <div key={fact.id} className="bg-gray-800/50 p-4 rounded-xl border border-gray-800">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{fact.fact_type}</div>
                    <div className="text-gray-200">{fact.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </main>
  )
}
