import { supabase } from '@/lib/supabase'

const API_URL = (
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:5000'
).replace(/\/$/, '')

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  const token = data.session?.access_token

  if (!token) {
    const sessionError = new Error('Please sign in to continue.')
    sessionError.status = 401
    throw sessionError
  }

  const headers = { Authorization: `Bearer ${token}` }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  let response

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    })
  } catch (requestError) {
    if (
      requestError?.name === 'TimeoutError' ||
      requestError?.name === 'AbortError'
    ) {
      throw new Error(
        'The API request timed out. Please refresh and try again.',
        { cause: requestError }
      )
    }

    throw new Error(
      'Could not reach the API. Check that Flask is running and the API URL is correct.',
      { cause: requestError }
    )
  }

  let result

  try {
    result = await response.json()
  } catch (parseError) {
    const responseError = new Error(
      `The API returned an unreadable response (HTTP ${response.status}). Check the Flask route and terminal.`,
      { cause: parseError }
    )
    responseError.status = response.ok ? 502 : response.status
    throw responseError
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    const responseError = new Error('The API returned an unexpected response.')
    responseError.status = response.ok ? 502 : response.status
    throw responseError
  }

  if (!response.ok) {
    const requestError = new Error(
      typeof result.message === 'string'
        ? result.message
        : 'The request could not be completed.'
    )
    requestError.status = response.status
    throw requestError
  }

  return result
}