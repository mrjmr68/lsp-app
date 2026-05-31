'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (data.session) {
        setReady(true)
        setMessage('Choose a new password for your account.')
        return
      }

      setError('Open the recovery link from your email, then set your new password here.')
    }

    checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
        setError('')
        setMessage('Choose a new password for your account.')
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setMessage('Password updated. Redirecting to sign in...')
    setPassword('')
    setConfirmPassword('')
    setLoading(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset your password</h1>
        <p className="text-sm text-gray-500 mb-8">
          Finish your recovery flow here and choose a new password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New password"
              disabled={!ready || loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Confirm new password"
              disabled={!ready || loading}
            />
          </div>

          {message && (
            <p className="text-sm text-green-700">{message}</p>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!ready || loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Set new password'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          Need another link?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700">
            Go back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
