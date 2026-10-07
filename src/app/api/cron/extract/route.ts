import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimNextJob, completeJob } from '@/lib/server/extraction-queue'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const headersList = await headers()
    
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = headersList.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        const url = new URL(request.url)
        if (url.searchParams.get('secret') !== cronSecret) {
          return new NextResponse('Unauthorized', { status: 401 })
        }
      }
    }

    const supabase = await createClient()

    const maxJobs = 3
    let processed = 0
    const results = []

    for (let i = 0; i < maxJobs; i++) {
      const job = await claimNextJob(supabase, 'cron_worker')
      
      if (!job) {
        break
      }

      console.log(`[Cron Extract] Claimed job for entry ${job.entry_id}, attempt ${job.attempt}`)

      const { data: entry } = await supabase
        .from('entries')
        .select('*')
        .eq('id', job.entry_id)
        .single()

      if (!entry) {
        await completeJob(supabase, job.entry_id, 'failed', 'Entry not found')
        results.push({ id: job.entry_id, status: 'failed', error: 'Entry not found' })
        continue
      }

      try {
        const baseUrl = new URL(request.url).origin
        const ingestUrl = `${baseUrl}/api/ingest?async=false`
        
        const res = await fetch(ingestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({
            text: entry.raw_text,
            source: entry.source,
            user_id: entry.user_id,
            entry_id: entry.id // this will be treated as retryEntryId if implemented, but we just pass the text
          })
        })

        if (!res.ok) {
           const errText = await res.text()
           throw new Error(`Ingest API returned ${res.status}: ${errText}`)
        }

        const data = await res.json()
        await completeJob(supabase, job.entry_id, 'completed')
        results.push({ id: job.entry_id, status: 'completed', data })
        processed++
      } catch (e: any) {
        console.error('Failed to process job:', e)
        await completeJob(supabase, job.entry_id, 'failed', e.message)
        results.push({ id: job.entry_id, status: 'failed', error: e.message })
      }
    }

    return NextResponse.json({ processed, results })
  } catch (err: any) {
    console.error('Cron extraction error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
