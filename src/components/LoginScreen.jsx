import React, { useState } from 'react'
import { useAuth } from '../services/AuthContext'
import { motion } from 'framer-motion'
import LoadingSpinner from './LoadingSpinner' // Added import

const LoginScreen = ({ onRegisterClick, onLoginSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false) // Added remember me state
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState('')
  const [showToast, setShowToast] = useState(false) // Added toast state
  const [toastMessage, setToastMessage] = useState('') // Added toast message state
  const { signIn, signInWithGoogle } = useAuth()

  // Toast function
  const showToastMessage = (message) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => {
      setShowToast(false)
      setToastMessage('')
    }, 3000)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error, firstLogin } = await signIn(email, password)
      
      if (error) {
        setError(error.message || 'Failed to sign in')
        setLoading(false)
        return
      }
      
      // Show success toast and proceed to dashboard
      showToastMessage('Login successful')
      setTimeout(() => {
        onLoginSuccess()
      }, 1000)
      
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setOauthLoading(true)
    setError('')

    try {
      const { data, error } = await signInWithGoogle()
      
      if (error) {
        setError(error.message || 'Failed to sign in with Google')
        setOauthLoading(false)
        return
      }
      
      // For Google login, we don't need to manually redirect
      // Supabase OAuth will handle the redirect automatically
      // The onAuthStateChange listener in AuthContext will handle
      // updating the user state and redirecting to the dashboard
      
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setOauthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-900 flex items-center justify-center p-4">
      {/* Toast message */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome Back</h2>
            <p className="text-gray-600 dark:text-gray-400">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm border border-red-100 dark:border-red-900/30">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition duration-200"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <a href="#" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition duration-200"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition duration-300 ease-in-out transform hover:-translate-y-0.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" color="white" />
                  <span className="ml-2">Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-xl transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm"
              >
                {oauthLoading ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="sm" color="gray" />
                    <span className="ml-2">Signing in...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Don't have an account?{' '}
              <button
                onClick={onRegisterClick}
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginScreen