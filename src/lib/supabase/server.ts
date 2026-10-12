import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: bearerToken ? {
        headers: {
          Authorization: `Bearer ${bearerToken}`
        }
      } : undefined,
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* Server Component, can't set cookies */ }
        },
      },
    }
  )

  if (bearerToken) {
    const origGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = ((jwt?: string) => origGetUser(jwt || bearerToken)) as any
  }

  return client
}
