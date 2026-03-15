import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Sprječava dvostruki poziv u development modu
  const initialized = useRef(false)

  /**
   * Dohvaća profil iz public."user" tablice.
   * Ako trigger nije aktivan, profil neće postojati — to je OK,
   * auth i dalje radi, samo profile === null.
   */
  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    console.log('[AuthContext] Dohvaćam profil za:', userId)

    const { data, error } = await supabase
      .from('user')
      .select('*, role(role_id, role_code)')
      .eq('user_id', userId)
      .single()

    if (error) {
      // PGRST116 = "no rows found" — znači trigger nije kreirao profil
      if (error.code === 'PGRST116') {
        console.warn('[AuthContext] Profil ne postoji u "user" tablici (trigger nije aktivan)')
      } else {
        console.error('[AuthContext] Greška pri dohvatu profila:', error.message)
      }
      setProfile(null)
      return null
    }

    console.log('[AuthContext] Profil dohvaćen:', data?.email, '| Rola:', data?.role?.role_code)
    setProfile(data)
    return data
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    console.log('[AuthContext] Inicijalizacija...')

    // 1. Dohvati postojeću sesiju
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      console.log('[AuthContext] Početna sesija:', s ? `✓ ${s.user.email}` : '✗ nema')
      if (error) console.error('[AuthContext] getSession greška:', error.message)

      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id)
      }
      setLoading(false)
    })

    // 2. Slušaj promjene auth stanja
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        console.log('[AuthContext] Auth event:', event, '| User:', s?.user?.email ?? 'null')

        setSession(s)
        setUser(s?.user ?? null)

        if (s?.user) {
          await fetchProfile(s.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  /* ─── Auth metode ─── */

  const signUp = async ({ email, password, firstName, lastName, roleId }) => {
  console.log('[Auth] signUp pokušaj:', email, '| roleId:', roleId)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, role_id: roleId },
    }
  })

  if (error) {
    console.error('[Auth] signUp greška:', error.message)
    return { data: null, error }
  }

  console.log('[Auth] Korisnik kreiran:', data.user?.id)

  // Ako ima sesiju odmah (email confirm OFF), postavi stanje
  if (data.session) {
    setUser(data.user)
    setSession(data.session)
    if (data.user) {
      await fetchProfile(data.user.id)
    }
  }

  return { data, error: null }
}

  const signIn = async ({ email, password }) => {
    console.log('[Auth] signIn pokušaj:', email)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[Auth] signIn greška:', error.message, '| Status:', error.status)
    } else {
      console.log('[Auth] signIn uspjeh:', data.user?.id)
      console.log('[Auth] Sesija:', data.session ? '✓ postoji' : '✗ nema')

      if (data.user) {
      // ODMAH postavi stanje — ne čekaj onAuthStateChange
      setUser(data.user)
      setSession(data.session)
        await fetchProfile(data.user.id)
      }
    }

    return { data, error }
  }

  const signOut = async () => {
    console.log('[Auth] signOut...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[Auth] signOut greška:', error.message)
    } else {
      console.log('[Auth] signOut uspjeh')
    }
    setProfile(null)
    setUser(null)
    setSession(null)
    return { error }
  }

  /* ─── Izvedene vrijednosti ─── */
  const isSeller = profile?.role?.role_code === 'SELLER'
  const isBuyer = profile?.role?.role_code === 'BUYER'

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
    isSeller,
    isBuyer,
    refetchProfile: () => fetchProfile(user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth mora biti unutar AuthProvider')
  }
  return context
}