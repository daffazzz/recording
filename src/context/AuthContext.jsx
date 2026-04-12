import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)

    useEffect(() => {
        // Get current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setAuthLoading(false)
        })

        // Listen to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setAuthLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error }
        return { data }
    }

    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { error }
        return { data }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    const value = { user, session, authLoading, signIn, signUp, signOut }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}
