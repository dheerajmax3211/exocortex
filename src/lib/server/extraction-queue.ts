import { SupabaseClient } from '@supabase/supabase-js'

function isMissingTableOrFunction(err: any): boolean {
  if (!err) return false;
  const code = err.code;
  const msg = err.message || '';
  return (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

export async function enqueueExtraction(supabase: SupabaseClient, entryId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('extraction_queue')
      .insert({
        entry_id: entryId,
        user_id: userId,
        status: 'pending'
      })
      .select('id')
      .single()

    if (error) {
      if (isMissingTableOrFunction(error) || error.code === '23505') {
        return null
      }
      return null
    }
  } catch (err: any) {
    if (isMissingTableOrFunction(err)) {
      return null
    }
    console.warn('Durable enqueue skipped:', err?.message || err)
  }
}

export async function claimNextJob(supabase: SupabaseClient, workerId: string = 'cron') {
  try {
    const { data: jobId, error } = await supabase.rpc('claim_extraction_job', {
      p_worker_id: workerId
    })
    
    if (error) {
      if (isMissingTableOrFunction(error)) {
        return null
      }
      throw error
    }

    if (!jobId) return null

    // Get the full job details
    const { data: job, error: jobError } = await supabase
      .from('extraction_queue')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError) throw jobError
    return job

  } catch (err: any) {
    if (isMissingTableOrFunction(err)) {
      return null
    }
    console.error('Failed to claim extraction job:', err)
    return null
  }
}

export async function completeJob(supabase: SupabaseClient, entryId: string, status: 'completed' | 'failed', errorMsg?: string) {
  try {
    const { error } = await supabase.rpc('complete_extraction_job', {
      p_entry_id: entryId,
      p_status: status,
      p_error: errorMsg || null
    })

    if (error) {
      if (isMissingTableOrFunction(error)) {
        // Fallback to manual update if rpc missing but table exists
        const { error: directError } = await supabase
          .from('extraction_queue')
          .update({
            status: status,
            error_message: errorMsg || null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('entry_id', entryId)
        
        if (directError && isMissingTableOrFunction(directError)) {
          return
        }
        return
      }
      return
    }
  } catch (err: any) {
    if (isMissingTableOrFunction(err)) return
    console.error('Failed to complete job:', err)
  }
}

export async function getJobStatus(supabase: SupabaseClient, entryId: string) {
  try {
    const { data, error } = await supabase
      .from('extraction_queue')
      .select('status, error_message, attempt')
      .eq('entry_id', entryId)
      .maybeSingle()
      
    if (error) {
      if (isMissingTableOrFunction(error)) return null
      return null
    }
    return data
  } catch (err: any) {
    if (isMissingTableOrFunction(err)) return null
    return null
  }
}
