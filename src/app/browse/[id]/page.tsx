import React from 'react'
import Navigation from '@/components/ui/Navigation'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import * as db from '@/lib/db'
import EntityDetailClient from './EntityDetailClient'

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const entity = await db.getEntity(supabase, id)

  if (!entity) {
    notFound()
  }

  // Fetch facts, edges, and entries
  const [facts, edges, entries] = await Promise.all([
    db.getFactsForEntity(supabase, id),
    db.getEdgesForEntity(supabase, id),
    db.getEntriesForEntity(supabase, id)
  ])

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0f] text-white p-4 pb-28">
      <EntityDetailClient 
        entity={entity}
        facts={facts || []}
        edges={edges || []}
        entries={entries || []}
      />
      <Navigation />
    </main>
  )
}
