import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext } from '@/context/auth-context'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [profileResult, setProfileResult] = useState({
    userId: null,
    profile: null,
    error: '',
  })

  const userId = session?.user?.id ?? null

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)

      if (!nextSession) {
        setProfileResult({
          userId: null,
          profile: null,
          error: '',
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return

    let active = true

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, is_active')
          .eq('id', userId)
          .single()

        if (!active) return

        setProfileResult({
          userId,
          profile: error ? null : data,
          error: error
            ? 'Unable to load your profile. Please sign out and try again.'
            : '',
        })
      } catch {
        if (!active) return

        setProfileResult({
          userId,
          profile: null,
          error: 'Unable to load your profile. Please try again.',
        })
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [userId])

  const profileMatchesUser =
    Boolean(userId) && profileResult.userId === userId

  const profile = profileMatchesUser
    ? profileResult.profile
    : null

  const profileError = profileMatchesUser
    ? profileResult.error
    : ''

  const profileLoading =
    Boolean(userId) && !profileMatchesUser

  const isActive = profile?.is_active === true

  const isAdmin =
    isActive && profile?.role === 'administrator'

  async function signOut() {
    return supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    isActive,
    isAdmin,
    profileError,
    loading: authLoading || profileLoading,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}