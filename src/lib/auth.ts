import { createClient as createServerClient } from './supabase/server'
import { createClient as createBrowserClient } from './supabase/client'
import { Provider } from '@supabase/supabase-js'

export async function getUserOptional() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUser() {
  const user = await getUserOptional()
  if (!user) throw new Error('Not authenticated')
  return user
}

export async function signInWithEmail(email: string) {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signInWithGoogle() {
  const supabase = createBrowserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google' as Provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) throw error
  return data.url
}

export async function signOut() {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
