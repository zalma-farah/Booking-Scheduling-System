import { supabase } from '@/lib/supabase'

const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'
).replace(/\/$/, '')

export async function apiRequest(
  path,
  { method = 'GET', body } = {}
) {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  const token = data.session?.access_token

  if (!token) {
    throw new Error('Please sign in to continue.')
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  })

  const result = await response.json()

  if (!response.ok) {
    const requestError = new Error(
      result.message || 'The request could not be completed.'
    )

    requestError.status = response.status
    throw requestError
  }

  return result
}