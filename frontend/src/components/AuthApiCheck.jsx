import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'
).replace(/\/$/, '')

function AuthApiCheck() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function testEndpoint(path, invalidToken = false) {
    setLoading(true)
    setResult('')

    try {
      const { data, error } = await supabase.auth.getSession()

      if (error) throw error

      const token = invalidToken
        ? 'invalid-test-token'
        : data.session?.access_token

      if (!token) {
        setResult('Please sign in before testing.')
        return
      }

      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(25000),
      })

      const body = await response.json()

      const message =
        body.message ||
        `Verified account. Role: ${body.profile?.role}`

      setResult(`HTTP ${response.status}: ${message}`)
    } catch {
      setResult(
        'Request failed. Check that Flask is running and VITE_API_URL is correct.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8 border-t pt-6">
      <h2 className="text-lg font-semibold">
        API connection tests
      </h2>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => testEndpoint('/api/me')}
        >
          Test my account
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => testEndpoint('/api/resources')}
        >
          Test resources
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => testEndpoint('/api/admin/health')}
        >
          Test admin access
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => testEndpoint('/api/me', true)}
        >
          Test invalid token
        </Button>
      </div>

      <p role="status" className="mt-4 text-sm">
        {loading ? 'Checking with Flask...' : result}
      </p>
    </section>
  )
}

export default AuthApiCheck