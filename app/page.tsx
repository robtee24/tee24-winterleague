'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<{ id: number; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  const fetchLeagues = async (retry = 0) => {
    try {
      setLoading(true)
      setError(null)
      
      const res = await fetch('/api/leagues', {
        cache: 'no-store', // Always fetch fresh data
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      console.log('Leagues API response status:', res.status)
      
      const data = await res.json()
      
      if (!res.ok || data.error) {
        throw new Error(data.message || data.error || `HTTP error! status: ${res.status}`)
      }
      
      if (Array.isArray(data)) {
        setLeagues(data)
        setError(null)
      } else {
        throw new Error('Received unexpected data format from server.')
      }
    } catch (err: any) {
      console.error('Error fetching leagues:', err)
      setError(`Unable to load leagues: ${err.message}`)
      
      // Auto-retry up to 3 times
      if (retry < 3) {
        setTimeout(() => {
          setRetryCount(retry + 1)
          fetchLeagues(retry + 1)
        }, 1000 * (retry + 1)) // Exponential backoff
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeagues()
  }, [])

  const handleLeagueSelect = (leagueId: number) => {
    try {
      router.push(`/submit?leagueId=${leagueId}`)
    } catch (error) {
      console.error('Error navigating to submit page:', error)
      alert('Error navigating to submission page. Please try again.')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 pt-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-2">
          <Image
            src="https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png"
            alt="Tee24 Logo"
            width={120}
            height={40}
            className="object-contain"
            unoptimized
          />
        </div>
        <h1 className="text-4xl font-bold text-center mb-4 text-black">
          Tee24 Winter League
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
            Submit A Scorecard
          </h2>
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading leagues...</p>
              </div>
            )}
            {error && !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm mb-2">{error}</p>
                <button
                  onClick={() => fetchLeagues(0)}
                  className="text-yellow-800 underline text-sm hover:text-yellow-900"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !error && leagues.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No leagues available</p>
                <button
                  onClick={() => fetchLeagues(0)}
                  className="text-blue-600 underline text-sm hover:text-blue-700"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !error && leagues.length > 0 && (
              leagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => handleLeagueSelect(league.id)}
                  className="w-full py-4 px-6 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors shadow-md"
                >
                  {league.name}
                </button>
              ))
            )}
          </div>
          <div className="mt-6">
            <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
              League Links
            </h2>
            <div className="space-y-4">
              <button
                onClick={() => {
                  try {
                    router.push('/leaderboard')
                  } catch (error) {
                    console.error('Navigation error:', error)
                    window.location.href = '/leaderboard'
                  }
                }}
                className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                See Leaderboard
              </button>
              <button
                onClick={() => {
                  try {
                    router.push('/directory')
                  } catch (error) {
                    console.error('Navigation error:', error)
                    window.location.href = '/directory'
                  }
                }}
                className="w-full py-4 px-6 bg-purple-600 text-white rounded-lg font-semibold text-lg hover:bg-purple-700 transition-colors shadow-md"
              >
                League Directory
              </button>
              <button
                onClick={() => {
                  try {
                    router.push('/schedule')
                  } catch (error) {
                    console.error('Navigation error:', error)
                    window.location.href = '/schedule'
                  }
                }}
                className="w-full py-4 px-6 bg-orange-600 text-white rounded-lg font-semibold text-lg hover:bg-orange-700 transition-colors shadow-md"
              >
                League Schedule
              </button>
              <button
                onClick={() => {
                  try {
                    router.push('/rules')
                  } catch (error) {
                    console.error('Navigation error:', error)
                    window.location.href = '/rules'
                  }
                }}
                className="w-full py-4 px-6 bg-indigo-600 text-white rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-md"
              >
                League Rules
              </button>
              <button
                onClick={() => {
                  try {
                    window.open('https://troubleshoot.tee24.golf/', '_blank')
                  } catch (error) {
                    console.error('Error opening link:', error)
                  }
                }}
                className="w-full py-4 px-6 bg-red-600 text-white rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors shadow-md"
              >
                Troubleshooting
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

