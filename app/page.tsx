'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function Home() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<{ id: number; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Add a small delay to ensure page renders first
    const timer = setTimeout(() => {
      fetch('/api/leagues')
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
          }
          return res.json()
        })
        .then(data => {
          if (data.error) {
            console.error('API error:', data.error)
            setError('Unable to load leagues. Please check your database connection.')
            return
          }
          setLeagues(data)
        })
        .catch(err => {
          console.error('Error fetching leagues:', err)
          setError('Unable to load leagues. The page will still work, but you may need to configure your database.')
          // Page will still render, just without leagues
        })
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const handleLeagueSelect = (leagueId: number) => {
    router.push(`/submit?leagueId=${leagueId}`)
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
            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800 text-sm">{error}</p>
              </div>
            )}
            {leagues.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No leagues available</p>
                <button
                  onClick={() => router.push('/league-manager')}
                  className="text-green-600 hover:text-green-700 underline"
                >
                  Go to Admin Portal
                </button>
              </div>
            ) : (
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
                onClick={() => router.push('/leaderboard')}
                className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
              >
                See Leaderboard
              </button>
              <button
                onClick={() => router.push('/directory')}
                className="w-full py-4 px-6 bg-purple-600 text-white rounded-lg font-semibold text-lg hover:bg-purple-700 transition-colors shadow-md"
              >
                League Directory
              </button>
              <button
                onClick={() => router.push('/schedule')}
                className="w-full py-4 px-6 bg-orange-600 text-white rounded-lg font-semibold text-lg hover:bg-orange-700 transition-colors shadow-md"
              >
                League Schedule
              </button>
              <button
                onClick={() => router.push('/rules')}
                className="w-full py-4 px-6 bg-indigo-600 text-white rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-md"
              >
                League Rules
              </button>
              <button
                onClick={() => window.open('https://troubleshoot.tee24.golf/', '_blank')}
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

