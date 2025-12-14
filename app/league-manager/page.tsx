'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function LeagueManagerPage() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    fetch('/api/leagues')
      .then(res => res.json())
      .then(data => setLeagues(data))
      .catch(err => console.error('Error fetching leagues:', err))
  }, [])

  const handleLeagueSelect = (leagueId: number) => {
    router.push(`/league-manager/setup?leagueId=${leagueId}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <Image
            src="https://tee24.golf/wp-content/uploads/2023/03/Tee24-rv-2-02.png"
            alt="Tee24 Logo"
            width={100}
            height={33}
            className="object-contain opacity-80"
            unoptimized
          />
        </div>
        <h1 className="text-4xl font-bold text-center mb-8 text-black">
          League Manager
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
            Select League
          </h2>
          <div className="space-y-4">
            {leagues.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No leagues available</p>
              </div>
            ) : (
              leagues.map((league) => (
                <button
                  key={league.id}
                  onClick={() => handleLeagueSelect(league.id)}
                  className="w-full py-4 px-6 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                  {league.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
