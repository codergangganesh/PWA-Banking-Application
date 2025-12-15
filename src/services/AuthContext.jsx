import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [firstLogin, setFirstLogin] = useState(true)

  // Get user session
  const getSession = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user || null)
      return session
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  }, [])

  // Sign up with email and password
  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })
      
      if (error) throw error
      
      // Don't automatically log in after signup - just return the data
      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    }
  }

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      setSession(data.session)
      setUser(data.user)
      
      // Check if this is the user's first login
      const isFirstLogin = firstLogin;
      setFirstLogin(false);
      
      return { data, error: null, firstLogin: isFirstLogin }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      
      if (error) throw error
      
      return { data, error: null }
    } catch (error) {
      console.error('Google sign in error:', error)
      return { data: null, error }
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setSession(null)
      setUser(null)
      setFirstLogin(true)
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    }
  }

  // Reset password
  const resetPassword = async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Reset password error:', error)
      return { data: null, error }
    }
  }

  // Update password
  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (error) throw error
      
      setUser(data.user)
      return { data, error: null }
    } catch (error) {
      console.error('Update password error:', error)
      return { data: null, error }
    }
  }

  // Update user metadata
  const updateUserMetadata = async (metadata) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: metadata,
      })
      
      if (error) throw error
      
      setUser(data.user)
      return { data, error: null }
    } catch (error) {
      console.error('Update user metadata error:', error)
      return { data: null, error }
    }
  }

  // Listen for auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setUser(session?.user || null)
        setLoading(false)
        
        // Handle OAuth login events
        if (event === 'SIGNED_IN' && session?.user) {
          // This will trigger for both email/password and OAuth logins
          // The UI can show appropriate messages based on the login method
          console.log('User signed in:', session.user);
        }
      }
    )

    getSession().then(() => {
      setLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [getSession])

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateUserMetadata,
    getSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
