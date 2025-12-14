'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'

interface Player {
  id: number
  firstName: string
  lastName: string
}

interface Course {
  id: number
  name: string
  week: number
}

interface Week {
  id: number
  weekNumber: number
  isChampionship: boolean
}

function SubmitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leagueId = searchParams.get('leagueId')

  const [players, setPlayers] = useState<Player[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | string | null>(null)
  const [playerSearch, setPlayerSearch] = useState<string[]>([''])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[][]>([[]])
  const [showDropdown, setShowDropdown] = useState<boolean[]>([])

  useEffect(() => {
    if (!leagueId) {
      router.push('/')
      return
    }

    fetch(`/api/players?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setPlayers(data))
      .catch(err => console.error('Error fetching players:', err))

    fetch(`/api/courses?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(err => console.error('Error fetching courses:', err))

    fetch(`/api/weeks?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setWeeks(data))
      .catch(err => console.error('Error fetching weeks:', err))
  }, [leagueId, router])

  useEffect(() => {
    const filtered = playerSearch.map((search, index) => {
      if (!search.trim()) {
        // Show all players except those already selected (except current index)
        return players.filter(p => 
          !selectedPlayers.includes(p.id) || selectedPlayers[index] === p.id
        )
      }
      const searchLower = search.toLowerCase()
      return players.filter(p => 
        p.firstName.toLowerCase().includes(searchLower) &&
        (!selectedPlayers.includes(p.id) || selectedPlayers[index] === p.id)
      )
    })
    setFilteredPlayers(filtered)
  }, [playerSearch, players, selectedPlayers])

  const handlePlayerSearch = (index: number, value: string) => {
    const newSearch = [...playerSearch]
    newSearch[index] = value
    setPlayerSearch(newSearch)
    
    const newShow = [...showDropdown]
    newShow[index] = true
    setShowDropdown(newShow)
  }

  const handlePlayerSelect = (index: number, player: Player) => {
    const newSelected = [...selectedPlayers]
    const oldPlayerId = newSelected[index]
    newSelected[index] = player.id
    setSelectedPlayers(newSelected)

    const newSearch = [...playerSearch]
    newSearch[index] = player.firstName
    setPlayerSearch(newSearch)

    const newShow = [...showDropdown]
    newShow[index] = false
    setShowDropdown(newShow)
  }

  const addPlayer = () => {
    if (selectedPlayers.length < 4) {
      setSelectedPlayers([...selectedPlayers, 0])
      setPlayerSearch([...playerSearch, ''])
      setShowDropdown([...showDropdown, false])
    }
  }

  const removePlayer = (index: number) => {
    if (index === 0) return // Can't remove first player
    const newSelected = selectedPlayers.filter((_, i) => i !== index)
    const newSearch = playerSearch.filter((_, i) => i !== index)
    const newShow = showDropdown.filter((_, i) => i !== index)
    setSelectedPlayers(newSelected)
    setPlayerSearch(newSearch)
    setShowDropdown(newShow)
  }

  const handleNext = async () => {
    if (!selectedPlayers[0] || !selectedWeek) return

    try {
      // Find or create the week
      let week: Week | undefined
      let weekNumber: number

      // Check if selectedWeek is a week ID or a week number string
      if (typeof selectedWeek === 'string' && selectedWeek.startsWith('week-')) {
        weekNumber = parseInt(selectedWeek.replace('week-', ''))
        week = weeks.find(w => w.weekNumber === weekNumber)
      } else {
        const weekId = typeof selectedWeek === 'string' ? parseInt(selectedWeek) : selectedWeek
        week = weeks.find(w => w.id === weekId)
        weekNumber = week?.weekNumber || 0
      }
      
      // If week doesn't exist, create it (API will check for duplicates)
      if (!week && weekNumber > 0) {
        const createRes = await fetch('/api/weeks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weekNumber: weekNumber,
            leagueId: parseInt(leagueId || '0'),
            isChampionship: false
          })
        })
        
        if (!createRes.ok) {
          const error = await createRes.json()
          throw new Error(error.error || 'Failed to create week')
        }
        
        week = await createRes.json()
      }

      if (!week) {
        alert('Invalid week selection')
        return
      }

      // Store submission data in sessionStorage
      sessionStorage.setItem('submissionData', JSON.stringify({
        leagueId,
        players: selectedPlayers,
        weekId: week.id,
        weekNumber: week.weekNumber
      }))

      // Start with first player
      router.push(`/submit/front9?playerIndex=0`)
    } catch (error: any) {
      console.error('Error in handleNext:', error)
      alert(`Failed to proceed: ${error.message || 'Unknown error'}`)
    }
  }

  const getWeekDisplayName = (weekNumber: number) => {
    const course = courses.find(c => c.week === weekNumber)
    if (course && course.name) {
      return `Week ${weekNumber} - ${course.name}`
    }
    return `Week ${weekNumber}`
  }

  // Create weeks if they don't exist
  useEffect(() => {
    if (!leagueId || weeks.length > 0) return

    // Create weeks 1-11 if they don't exist
    const createWeeks = async () => {
      for (let i = 1; i <= 11; i++) {
        try {
          await fetch('/api/weeks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              weekNumber: i,
              leagueId: parseInt(leagueId)
            })
          })
        } catch (err) {
          // Week might already exist, ignore
        }
      }
      // Reload weeks
      fetch(`/api/weeks?leagueId=${leagueId}`)
        .then(res => res.json())
        .then(data => setWeeks(data))
    }
    createWeeks()
  }, [leagueId, weeks.length])

  const canProceed = selectedPlayers[0] !== undefined && selectedPlayers[0] > 0 && selectedWeek !== null && selectedWeek !== '' && selectedWeek !== 0

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
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
        <h1 className="text-3xl font-bold mb-2 text-black">Scorecard Submission</h1>
        <p className="text-gray-600 mb-8">All scores must be on the same scorecard image. If you did not play together, submit separately</p>

        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          {/* Player Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Player <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={playerSearch[0]}
                onChange={(e) => handlePlayerSearch(0, e.target.value)}
                onFocus={() => {
                  const newShow = [...showDropdown]
                  newShow[0] = true
                  setShowDropdown(newShow)
                }}
                placeholder="Type first name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              {showDropdown[0] && filteredPlayers[0].length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredPlayers[0].map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => handlePlayerSelect(0, player)}
                      className="w-full text-left px-4 py-2 hover:bg-green-50"
                    >
                      {player.firstName} {player.lastName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Additional Players */}
          {selectedPlayers.slice(1).map((playerId, index) => {
            const actualIndex = index + 1
            return (
              <div key={actualIndex}>
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  Player {actualIndex + 1} (Optional)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={playerSearch[actualIndex]}
                      onChange={(e) => handlePlayerSearch(actualIndex, e.target.value)}
                      onFocus={() => {
                        const newShow = [...showDropdown]
                        newShow[actualIndex] = true
                        setShowDropdown(newShow)
                      }}
                      placeholder="Type first name..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    {showDropdown[actualIndex] && filteredPlayers[actualIndex]?.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredPlayers[actualIndex].map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => handlePlayerSelect(actualIndex, player)}
                            className="w-full text-left px-4 py-2 hover:bg-green-50"
                          >
                            {player.firstName} {player.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlayer(actualIndex)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add Player Button */}
          {selectedPlayers.length < 4 && (
            <button
              type="button"
              onClick={addPlayer}
              className="text-green-600 hover:text-green-700 font-semibold"
            >
              + Add Player
            </button>
          )}

          {/* Week/Course Selection */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Select Week
            </label>
            <select
              value={selectedWeek?.toString() || ''}
              onChange={(e) => {
                const value = e.target.value
                setSelectedWeek(value)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select a week...</option>
              {Array.from({ length: 11 }, (_, i) => {
                const weekNumber = i + 1
                const week = weeks.find(w => w.weekNumber === weekNumber && !w.isChampionship)
                // Use week ID if exists, otherwise use week number with prefix
                const value = week ? week.id.toString() : `week-${weekNumber}`
                return (
                  <option key={week?.id || weekNumber} value={value}>
                    {getWeekDisplayName(weekNumber)}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Next Button */}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-lg transition-colors ${
              canProceed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {selectedPlayers[0] ? `${players.find(p => p.id === selectedPlayers[0])?.firstName || 'Player'}'s Front 9` : 'Next'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    }>
      <SubmitPageContent />
    </Suspense>
  )
}

