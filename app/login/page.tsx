'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingRecovery, setSendingRecovery] = useState(false)
  const [sendingMagicLink, setSendingMagicLink] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handlePasswordRecovery() {
    if (!email) {
      setError('Enter your email first so we know where to send the recovery link.')
      return
    }

    setSendingRecovery(true)
    setError('')
    setInfo('')

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (recoveryError) {
      setError(recoveryError.message)
    } else {
      setInfo('Recovery email sent. Open the link in your email, then set your new password.')
    }

    setSendingRecovery(false)
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email first so we can send the magic link.')
      return
    }

    setSendingMagicLink(true)
    setError('')
    setInfo('')

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=/`
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })

    if (magicLinkError) {
      setError(magicLinkError.message)
    } else {
      setInfo('Magic link sent. Open it from your email to sign in without a password.')
    }

    setSendingMagicLink(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">LSP Field Service</h1>
        <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Password"
            />
          </div>

          {info && (
            <p className="text-sm text-green-700">{info}</p>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={handlePasswordRecovery}
            disabled={sendingRecovery}
            className="w-full text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {sendingRecovery ? 'Sending recovery email...' : 'Send password recovery email'}
          </button>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={sendingMagicLink}
            className="w-full text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {sendingMagicLink ? 'Sending magic link...' : 'Send magic link instead'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already opened a recovery link?{' '}
            <Link href="/reset-password" className="text-blue-600 hover:text-blue-700">
              Set a new password here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
