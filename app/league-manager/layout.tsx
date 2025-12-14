'use client'

import { useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'

const ADMIN_PASSWORD = 'CABenson123$'

export default function LeagueManagerLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isChecking, setIsChecking] = useState(true)

  // Check if already authenticated (stored in sessionStorage)
  useEffect(() => {
    const authStatus = sessionStorage.getItem('leagueManagerAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
    setIsChecking(false)
  }, [])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('leagueManagerAuthenticated', 'true')
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password. Please try again.')
      setPassword('')
    }
  }

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </main>
    )
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-md mx-auto">
          <div className="flex justify-center mb-2">
            <Image
              src="https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png"
              alt="Tee24 Logo"
              width={100}
              height={33}
              className="object-contain opacity-80"
              unoptimized
            />
          </div>
          <button
            onClick={() => router.push('/')}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-black">League Manager</h1>
            <p className="text-gray-600 mb-6 text-center">This area is password protected.</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError('')
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  autoFocus
                />
                {passwordError && (
                  <p className="mt-2 text-sm text-red-600">{passwordError}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  // Show protected content if authenticated
  return <>{children}</>
}


