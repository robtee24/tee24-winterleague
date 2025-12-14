'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface League {
  id: number
  name: string
}

interface Player {
  id: number
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
}

const DIRECTORY_PASSWORD = 'WinterLeague'

export default function DirectoryPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [leagues, setLeagues] = useState<League[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)

  // Check if already authenticated (stored in sessionStorage)
  useEffect(() => {
    const authStatus = sessionStorage.getItem('directoryAuthenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === DIRECTORY_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('directoryAuthenticated', 'true')
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password. Please try again.')
      setPassword('')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return

    fetch('/api/leagues')
      .then(res => res.json())
      .then(data => {
        setLeagues(data)
        if (data.length > 0) {
          setSelectedLeagueId(data[0].id)
        }
      })
      .catch(err => console.error('Error fetching leagues:', err))
  }, [isAuthenticated])

  useEffect(() => {
    if (!selectedLeagueId || !isAuthenticated) return

    setLoading(true)
    fetch(`/api/players?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => {
        // Sort players by last name, then first name
        const sorted = data.sort((a: Player, b: Player) => {
          const aLastName = a.lastName || ''
          const bLastName = b.lastName || ''
          if (aLastName !== bLastName) {
            return aLastName.localeCompare(bLastName)
          }
          return a.firstName.localeCompare(b.firstName)
        })
        setPlayers(sorted)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching players:', err)
        setLoading(false)
      })
  }, [selectedLeagueId, isAuthenticated])

  const formatPhoneNumber = (phone: string | null): string => {
    if (!phone) return 'Not provided'
    // Remove any non-digit characters for tel: link
    return phone.replace(/\D/g, '')
  }

  const displayPhoneNumber = (phone: string | null): string => {
    if (!phone) return 'Not provided'
    return phone
  }

  const getPlayerName = (player: Player): string => {
    if (player.lastName) {
      return `${player.firstName} ${player.lastName}`
    }
    return player.firstName
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
            <h1 className="text-3xl font-bold mb-6 text-center text-black">League Directory</h1>
            <p className="text-gray-600 mb-6 text-center">This page is password protected.</p>
            
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

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
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

        <h1 className="text-3xl font-bold mb-6 text-black">League Directory</h1>

        {/* League Selector */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Select League:
          </label>
          <select
            value={selectedLeagueId || ''}
            onChange={(e) => setSelectedLeagueId(parseInt(e.target.value))}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        {/* Directory Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading...</div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No players found for this league.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-6 py-3 text-left font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="border border-gray-300 px-6 py-3 text-left font-semibold text-gray-700">
                      Phone Number
                    </th>
                    <th className="border border-gray-300 px-6 py-3 text-left font-semibold text-gray-700">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-6 py-4 text-gray-800">
                        {getPlayerName(player)}
                      </td>
                      <td className="border border-gray-300 px-6 py-4">
                        {player.phone ? (
                          <a
                            href={`tel:${formatPhoneNumber(player.phone)}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {displayPhoneNumber(player.phone)}
                          </a>
                        ) : (
                          <span className="text-gray-400">Not provided</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-6 py-4">
                        {player.email ? (
                          <a
                            href={`mailto:${player.email}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {player.email}
                          </a>
                        ) : (
                          <span className="text-gray-400">Not provided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

