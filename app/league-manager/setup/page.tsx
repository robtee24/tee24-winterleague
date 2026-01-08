'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Player {
  id: number
  firstName: string
  lastName: string
}

interface Score {
  id: number
  playerId: number
  weekId: number
  total: number | null
  weightedScore: number | null
  week: {
    weekNumber: number
    isChampionship: boolean
  }
}

// Helper function to get week display name (Week 1-11, Championship for 12)
const getWeekDisplayName = (weekNum: number): string => {
  if (weekNum === 12) return 'Championship'
  return `Week ${weekNum}`
}

// Helper function to get week number for sorting/display (championship = 12)
const getWeekNumberForDisplay = (week: { weekNumber: number; isChampionship: boolean }): number => {
  return week.isChampionship ? 12 : week.weekNumber
}

export default function LeagueSetupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leagueId = searchParams.get('leagueId')

  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [weeks, setWeeks] = useState<{ id: number; weekNumber: number; isChampionship: boolean }[]>([])
  const [activeTab, setActiveTab] = useState<'unweighted' | 'weighted'>('unweighted')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [showBulkCreate, setShowBulkCreate] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ firstName: '', lastName: '', phone: '', email: '' })
  const [bulkNames, setBulkNames] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [teams, setTeams] = useState<Array<{
    id: number
    teamNumber: number
    player1: { id: number; firstName: string; lastName: string }
    player2: { id: number; firstName: string; lastName: string }
  }>>([])
  const [matches, setMatches] = useState<Array<{
    id: number
    weekId: number
    team1Id: number
    team2Id: number | null
    team1Points: number
    team2Points: number
    winnerId: number | null
    team1: { id: number; teamNumber: number; player1: { id: number; firstName: string; lastName: string }; player2: { id: number; firstName: string; lastName: string } }
    team2: { id: number; teamNumber: number; player1: { id: number; firstName: string; lastName: string }; player2: { id: number; firstName: string; lastName: string } } | null
    week: { id: number; weekNumber: number; isChampionship: boolean }
  }>>([])
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<{ id: number; weekNumber: number; isChampionship: boolean } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [selectedOpponent, setSelectedOpponent] = useState<string>('')
  const [recalculating, setRecalculating] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!leagueId) {
      router.push('/league-manager')
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, router])

  const loadData = () => {
    if (!leagueId) return

    fetch(`/api/players?leagueId=${leagueId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setPlayers(data)
        } else {
          console.error('Error fetching players:', data)
          setPlayers([])
        }
      })
      .catch(err => {
        console.error('Error fetching players:', err)
        setPlayers([])
      })

    fetch(`/api/scores?leagueId=${leagueId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setScores(data)
        } else {
          console.error('Error fetching scores:', data)
          setScores([])
        }
      })
      .catch(err => {
        console.error('Error fetching scores:', err)
        setScores([])
      })

    fetch(`/api/weeks?leagueId=${leagueId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        if (Array.isArray(data)) {
          setWeeks(data)
        } else {
          console.error('Error fetching weeks:', data)
          setWeeks([])
        }
      })
      .catch(err => {
        console.error('Error fetching weeks:', err)
        setWeeks([])
      })

    // Fetch teams and matches for schedule
    fetch(`/api/teams?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(err => console.error('Error fetching teams:', err))

    fetch(`/api/matches?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setMatches(data))
      .catch(err => console.error('Error fetching matches:', err))
  }

  const handleAddPlayer = async () => {
    if (!leagueId || !newPlayer.firstName) return

    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newPlayer.firstName,
          lastName: newPlayer.lastName,
          phone: newPlayer.phone || null,
          email: newPlayer.email || null,
          leagueId: parseInt(leagueId)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Error adding player:', data)
        alert(`Failed to add player: ${data.error || 'Unknown error'}`)
        return
      }

      // Success - clear form and refresh
      setNewPlayer({ firstName: '', lastName: '', phone: '', email: '' })
      setShowAddPlayer(false)
      
      // Add a small delay to ensure database is updated
      setTimeout(() => {
        loadData()
      }, 100)
    } catch (error: any) {
      console.error('Error adding player:', error)
      alert(`Failed to add player: ${error?.message || 'Please try again.'}`)
    }
  }

  const parseName = (line: string): { firstName: string; lastName: string; phone: string; email: string } => {
    const trimmed = line.trim()
    if (!trimmed) return { firstName: '', lastName: '', phone: '', email: '' }

    // Split by spaces - format: "First Last Phone Email" or "Last, First Phone Email"
    const parts = trimmed.split(/\s+/).filter(p => p)
    
    // Find email by looking for @ symbol
    let emailIndex = -1
    let email = ''
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes('@')) {
        emailIndex = i
        email = parts.slice(i).join(' ') // Join remaining parts as email (in case email has spaces)
        break
      }
    }
    
    // Remove email parts from consideration
    const nameAndPhoneParts = emailIndex >= 0 ? parts.slice(0, emailIndex) : parts
    
    // Check if it's comma-separated name format: "Last, First Phone Email"
    if (trimmed.includes(',')) {
      const commaIndex = trimmed.indexOf(',')
      const namePart = trimmed.substring(0, commaIndex).trim()
      const restPart = trimmed.substring(commaIndex + 1).trim()
      const restParts = restPart.split(/\s+/).filter(p => p)
      
      // Remove email from restParts if found
      let restWithoutEmail = restParts
      let phone = ''
      if (emailIndex >= 0) {
        // Find where email starts in restParts
        const emailStartInRest = restParts.findIndex(p => p.includes('@'))
        if (emailStartInRest >= 0) {
          restWithoutEmail = restParts.slice(0, emailStartInRest)
        }
      }
      
      // First part after comma is first name, name part is last name
      const firstName = restWithoutEmail[0] || ''
      const lastName = namePart
      
      // If there's a part after first name, it might be phone (check if it looks like a phone)
      if (restWithoutEmail.length > 1) {
        const potentialPhone = restWithoutEmail.slice(1).join(' ')
        // Check if it looks like a phone number (contains digits and common phone formatting)
        // Must have at least 3 consecutive digits (area code) and phone formatting
        if (/[\d\-\(\)\s]/.test(potentialPhone) && /\d{3,}/.test(potentialPhone) && !/[a-zA-Z]/.test(potentialPhone)) {
          phone = potentialPhone
        }
      }
      
      return { firstName, lastName, phone, email }
    }

    // Handle space-separated: "First Last Phone Email" or "First Middle Last Phone Email"
    if (nameAndPhoneParts.length === 1) {
      // Only one name provided
      return { firstName: nameAndPhoneParts[0], lastName: '', phone: '', email }
    } else if (nameAndPhoneParts.length === 2) {
      // Two parts: name only (or name and phone if one looks like phone)
      const part1 = nameAndPhoneParts[0]
      const part2 = nameAndPhoneParts[1]
      
      // Check if part2 looks like a phone number (has digits, phone formatting, no letters)
      if (/[\d\-\(\)\s]/.test(part2) && /\d{3,}/.test(part2) && !/[a-zA-Z]/.test(part2)) {
        return { firstName: part1, lastName: '', phone: part2, email }
      } else {
        return { firstName: part1, lastName: part2, phone: '', email }
      }
    } else {
      // Three or more parts: need to separate name from phone
      // Work backwards from the end to find phone number
      // Phone numbers should be at the end (before email if present)
      let phone = ''
      let nameEndIndex = nameAndPhoneParts.length
      
      // Start from the end and work backwards to find phone
      // Phone should be the last part(s) that contain digits and phone formatting
      for (let i = nameAndPhoneParts.length - 1; i >= 1; i--) {
        const potentialPhone = nameAndPhoneParts.slice(i).join(' ')
        // Check if it looks like a phone number:
        // - Contains digits and phone formatting characters
        // - Has at least 3 consecutive digits (area code)
        // - Does NOT contain letters (to avoid matching names)
        if (/[\d\-\(\)\s]/.test(potentialPhone) && /\d{3,}/.test(potentialPhone) && !/[a-zA-Z]/.test(potentialPhone)) {
          nameEndIndex = i
          phone = potentialPhone
          break
        }
      }
      
      const firstName = nameAndPhoneParts[0]
      const lastName = nameEndIndex > 1 ? nameAndPhoneParts.slice(1, nameEndIndex).join(' ') : ''
      
      return { firstName, lastName, phone, email }
    }
  }

  const handleBulkCreate = async () => {
    if (!leagueId || !bulkNames.trim()) {
      alert('Please enter at least one name')
      return
    }

    setBulkCreating(true)

    try {
      // Parse names from textarea
      const lines = bulkNames.split('\n').filter(line => line.trim())
      const players = lines.map(parseName).filter(p => p.firstName)

      if (players.length === 0) {
        alert('No valid names found. Please enter names, one per line.')
        setBulkCreating(false)
        return
      }

      // Create players sequentially to avoid race conditions
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const player of players) {
        try {
          const response = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: player.firstName,
              lastName: player.lastName,
              phone: player.phone || null,
              email: player.email || null,
              leagueId: parseInt(leagueId)
            })
          })

          const data = await response.json()

          if (!response.ok) {
            errorCount++
            errors.push(`${player.firstName} ${player.lastName}: ${data.error || 'Unknown error'}`)
          } else {
            successCount++
          }
        } catch (error: any) {
          errorCount++
          errors.push(`${player.firstName} ${player.lastName}: ${error?.message || 'Failed to create'}`)
        }
      }

      // Show results
      let message = `Created ${successCount} player(s)`
      if (errorCount > 0) {
        message += `\nFailed to create ${errorCount} player(s):\n${errors.join('\n')}`
      }
      alert(message)

      // Clear form and refresh
      setBulkNames('')
      setShowBulkCreate(false)
      
      // Reload data
      setTimeout(() => {
        loadData()
      }, 100)
    } catch (error: any) {
      console.error('Error in bulk create:', error)
      alert(`Failed to create players: ${error?.message || 'Please try again.'}`)
    } finally {
      setBulkCreating(false)
    }
  }

  const getPlayerScores = (playerId: number) => {
    const playerScores = scores.filter(s => s.playerId === playerId)
    const scoreMap: { [week: number]: number } = {}
    
    playerScores.forEach(score => {
      // Treat championship as week 12
      const displayWeekNumber = getWeekNumberForDisplay(score.week)
      scoreMap[displayWeekNumber] = activeTab === 'weighted' 
        ? (score.weightedScore || 0)
        : (score.total || 0)
    })

    return scoreMap
  }

  const getPlayerTotal = (playerId: number) => {
    const playerScores = scores.filter(s => s.playerId === playerId)
    return playerScores.reduce((sum, score) => {
      const value = activeTab === 'weighted' 
        ? (score.weightedScore || 0)
        : (score.total || 0)
      return sum + value
    }, 0)
  }

  const getTeamRecord = (teamId: number): { wins: number; losses: number; ties: number } => {
    let wins = 0
    let losses = 0
    let ties = 0

    matches.forEach(match => {
      if (!match.team2Id || !match.team2) return // Skip incomplete matches
      
      // First check if this team is actually in the match
      const isTeam1 = match.team1Id === teamId
      const isTeam2 = match.team2Id === teamId
      if (!isTeam1 && !isTeam2) return // Team is not in this match, skip it
      
        const weekNum = match.week.isChampionship ? 12 : match.week.weekNumber
      if (weekNum > 12) return // Only count weeks 1-12 for regular season record

      // Check if match is completed (all 4 players have submitted total scores)
      const weekScores = scores.filter(s => {
        const scoreWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
        return scoreWeekNum === weekNum && s.total !== null && s.total !== undefined
      })

      const playersInMatch = [
        match.team1.player1.id,
        match.team1.player2.id,
        match.team2.player1.id,
        match.team2.player2.id
      ]

      const playersWithScores = new Set(weekScores.map(s => s.playerId))
      const allPlayersSubmitted = playersInMatch.every(playerId => playersWithScores.has(playerId))

      // Only count matches where all players have submitted scores
      if (!allPlayersSubmitted) return

      // Now check if this team won, lost, or tied
      if (match.winnerId === teamId) {
        wins++
      } else if (match.winnerId !== null && match.winnerId !== teamId) {
        losses++
      } else if (match.winnerId === null) {
        // Tie occurs when winnerId is null and all players have submitted
        ties++
      }
    })

    return { wins, losses, ties }
  }

  const exportToCSV = () => {
    if (!Array.isArray(players)) {
      console.error('Cannot export: players is not an array')
      return
    }
    const headers = ['Player', ...Array.from({ length: 12 }, (_, i) => getWeekDisplayName(i + 1)), 'Total']
    const rows = players.map(player => {
      const playerScores = getPlayerScores(player.id)
      const row = [
        `${player.firstName} ${player.lastName}`,
        ...Array.from({ length: 12 }, (_, i) => {
          const weekNumber = i + 1
          return playerScores[weekNumber] || ''
        }),
        getPlayerTotal(player.id)
      ]
      return row.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTab}-scores.csv`
    a.click()
  }

  const handleGenerateSchedule = async () => {
    if (!leagueId) return

    if (!confirm('This will generate the schedule for weeks 1-12. Continue?')) return

    try {
      const response = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: parseInt(leagueId) })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate schedule')
      }

      alert('Schedule generated successfully!')
      
      // Reload matches to show the new schedule
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error generating schedule:', error)
      alert(`Failed to generate schedule: ${error.message || 'Unknown error'}`)
    }
  }

  const handleClearSchedule = async () => {
    if (!leagueId) return

    if (!confirm('Are you sure you want to clear the current schedule? This will delete all matches for weeks 1-12.')) return

    try {
      const response = await fetch('/api/matches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leagueId: parseInt(leagueId)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear schedule')
      }

      alert(`Schedule cleared successfully! Deleted ${data.deletedCount || 0} matches.`)
      
      // Reload matches
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error clearing schedule:', error)
      alert(`Failed to clear schedule: ${error.message || 'Unknown error'}`)
    }
  }

  const handleRecalculateHandicaps = async () => {
    if (!leagueId) return

    if (!confirm('This will recalculate all handicaps for this league. This may take a moment. Continue?')) {
      return
    }

    setRecalculating(true)
    try {
      const response = await fetch(`/api/handicaps/recalculate?leagueId=${leagueId}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to recalculate handicaps')
      }

      alert('Handicaps recalculated successfully! The page will refresh.')
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error recalculating handicaps:', error)
      alert(`Failed to recalculate handicaps: ${error.message || 'Unknown error'}`)
    } finally {
      setRecalculating(false)
    }
  }

  const handleClearAllData = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL players and scores from the database. This action cannot be undone. Are you absolutely sure?')) {
      return
    }

    if (!confirm('This is your last chance. Click OK to permanently delete all players and scores.')) {
      return
    }

    setClearing(true)
    try {
      const response = await fetch('/api/admin/clear-data', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear data')
      }

      alert(`Successfully cleared all data!\n\nDeleted:\n- ${data.summary.players} players\n- ${data.summary.scores} scores\n- ${data.summary.handicaps} handicaps\n- ${data.summary.teams} teams\n- ${data.summary.matches} matches\n\nThe page will refresh.`)
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error clearing data:', error)
      alert(`Failed to clear data: ${error.message || 'Unknown error'}`)
    } finally {
      setClearing(false)
    }
  }

  const handleCreateMatch = async () => {
    if (!leagueId || !selectedWeek || !selectedTeam || !selectedOpponent) return

    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: selectedWeek.id,
          team1Id: selectedTeam,
          team2Id: parseInt(selectedOpponent),
          isManual: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create match')
      }

      setShowMatchModal(false)
      setSelectedWeek(null)
      setSelectedTeam(null)
      setSelectedOpponent('')
      
      // Reload matches
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error creating match:', error)
      alert(`Failed to create match: ${error.message || 'Unknown error'}`)
    }
  }

  const handleDeleteMatch = async (matchId: number) => {
    if (!confirm('Are you sure you want to delete this match?')) return

    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete match')
      }

      loadData()
    } catch (error: any) {
      console.error('Error deleting match:', error)
      alert(`Failed to delete match: ${error.message || 'Unknown error'}`)
    }
  }

  const handleCalculateCompletedMatches = async () => {
    if (!leagueId) return

    if (!confirm('This will calculate all matches for completed rounds. Continue?')) return

    try {
      const response = await fetch('/api/matches/calculate-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: parseInt(leagueId) })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate matches')
      }

      alert(`Successfully calculated ${data.totalCalculated} matches across ${data.weeksProcessed} completed weeks.`)
      
      // Reload matches to show updated results
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error: any) {
      console.error('Error calculating completed matches:', error)
      alert(`Failed to calculate matches: ${error.message || 'Unknown error'}`)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/league-manager')}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-black">League Setup</h1>
          <div className="flex gap-2">
            <button
              onClick={handleRecalculateHandicaps}
              disabled={recalculating || clearing}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                recalculating || clearing
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate Handicaps'}
            </button>
            <button
              onClick={handleClearAllData}
              disabled={recalculating || clearing}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                recalculating || clearing
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {clearing ? 'Clearing...' : 'Clear All Data'}
            </button>
          </div>
        </div>

        {/* Set Roster Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Set Roster</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAddPlayer(!showAddPlayer)
                  setShowBulkCreate(false)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showAddPlayer ? 'Cancel' : 'Add a member'}
              </button>
              <button
                onClick={() => {
                  setShowBulkCreate(!showBulkCreate)
                  setShowAddPlayer(false)
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {showBulkCreate ? 'Cancel' : 'Bulk Create'}
              </button>
            </div>
          </div>

          {showAddPlayer && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={newPlayer.firstName}
                  onChange={(e) => setNewPlayer({ ...newPlayer, firstName: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newPlayer.lastName}
                  onChange={(e) => setNewPlayer({ ...newPlayer, lastName: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newPlayer.phone}
                  onChange={(e) => setNewPlayer({ ...newPlayer, phone: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newPlayer.email}
                  onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button
                onClick={handleAddPlayer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Player
              </button>
            </div>
          )}

          {showBulkCreate && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                Paste names (one per line):
              </label>
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder="John Doe 555-1234 john@example.com&#10;Jane Smith 555-5678 jane@example.com&#10;Bob Johnson&#10;Or:&#10;Doe, John 555-1234 john@example.com"
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <div className="mt-2 text-xs text-gray-600 mb-3">
                <p>Format: &quot;First Last Phone Email&quot; or &quot;Last, First Phone Email&quot; (one per line)</p>
                <p>Phone and Email are optional. Separate each field with a space.</p>
                <p>Empty lines will be ignored</p>
              </div>
              <button
                onClick={handleBulkCreate}
                disabled={bulkCreating || !bulkNames.trim()}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  bulkCreating || !bulkNames.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {bulkCreating ? 'Creating...' : 'Create Players'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {Array.isArray(players) && players.length > 0 ? (
              players.map((player) => (
                <Link
                  key={player.id}
                  href={`/league-manager/player?playerId=${player.id}&leagueId=${leagueId}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {player.firstName} {player.lastName}
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No players added yet</p>
            )}
          </div>
        </div>

        {/* Scores Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('unweighted')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  activeTab === 'unweighted'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Non-Handicapped Scores
              </button>
              <button
                onClick={() => setActiveTab('weighted')}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  activeTab === 'weighted'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Handicapped Scores
              </button>
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Player</th>
                  {Array.from({ length: 12 }, (_, i) => {
                    const weekNumber = i + 1
                    return (
                      <th key={weekNumber} className="border border-gray-300 px-4 py-2">
                        {getWeekDisplayName(weekNumber)}
                      </th>
                    )
                  })}
                  <th className="border border-gray-300 px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(players) && players.map((player) => {
                  const playerScores = getPlayerScores(player.id)
                  return (
                    <tr key={player.id}>
                      <td className="border border-gray-300 px-4 py-2">
                        <Link
                          href={`/league-manager/player?playerId=${player.id}&leagueId=${leagueId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {player.firstName} {player.lastName}
                        </Link>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const weekNumber = i + 1
                        const score = playerScores[weekNumber]
                        return (
                          <td
                            key={weekNumber}
                            className={`border border-gray-300 px-4 py-2 text-center ${
                              score === undefined ? 'bg-red-100' : ''
                            }`}
                          >
                            {score !== undefined ? score : '-'}
                          </td>
                        )
                      })}
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {getPlayerTotal(player.id)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Week Links */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Weeks</h2>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const weekNumber = i + 1
              if (weekNumber === 12) {
                return (
                  <Link
                    key={weekNumber}
                    href={`/league-manager/week?weekNumber=championship&leagueId=${leagueId}`}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Championship
                  </Link>
                )
              }
              return (
                <Link
                  key={weekNumber}
                  href={`/league-manager/week?weekNumber=${weekNumber}&leagueId=${leagueId}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Week {weekNumber}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Team Schedule Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Team Schedule</h2>
            {teams.length >= 2 && (
              <div className="flex gap-2">
                {(() => {
                  // Check if there are any matches for weeks 1-10 (not championship or week 11)
                  const hasSchedule = matches.some(m => {
                    const weekNum = m.week.isChampionship ? 12 : m.week.weekNumber
                    return weekNum <= 12
                  })
                  
                  return hasSchedule ? (
                    <>
                      <button
                        onClick={handleCalculateCompletedMatches}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                      >
                        Calculate All Matches
                      </button>
                      <button
                        onClick={handleClearSchedule}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                      >
                        Clear Schedule
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleGenerateSchedule}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                    >
                      Generate Schedule
                    </button>
                  )
                })()}
              </div>
            )}
          </div>
          
          {teams.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No teams created yet. Assign team members on the player pages.
            </p>
          ) : teams.length < 2 ? (
            <p className="text-gray-500 text-center py-4">
              At least 2 teams are required to generate a schedule. Currently have {teams.length} team(s).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left sticky left-0 bg-gray-100 z-10 min-w-[200px]">Team</th>
                    {Array.from({ length: 12 }, (_, i) => {
                      const weekNum = i + 1
                      const weekDisplay = weekNum === 12 ? 'Championship' : `Week ${weekNum}`
                      return (
                        <th key={weekNum} className="border border-gray-300 px-3 py-2 text-center min-w-[120px]">
                          {weekDisplay}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    return (
                      <tr key={team.id}>
                        <td className="border border-gray-300 px-4 py-2 font-semibold sticky left-0 bg-white z-10 min-w-[200px]">
                          Team {team.teamNumber}
                          <div className="text-xs text-gray-500 font-normal mt-1">
                            {team.player1.firstName} {team.player1.lastName} & {team.player2.firstName} {team.player2.lastName}
                          </div>
                          {(() => {
                            const record = getTeamRecord(team.id)
                            return (
                              <div className="text-xs font-semibold text-gray-700 mt-1">
                                {record.wins}-{record.losses}-{record.ties}
                              </div>
                            )
                          })()}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const weekNum = i + 1
                          // Find the week object for this week number
                          const week = weeks.find(w => 
                            weekNum === 12 ? w.isChampionship : (w.weekNumber === weekNum && !w.isChampionship)
                          )
                          
                          // Find the match for this team and week (only one match per team per week)
                          const match = week ? matches.find(m => 
                            m.weekId === week.id &&
                            (m.team1Id === team.id || m.team2Id === team.id)
                          ) : null
                          
                          let cellContent: string | JSX.Element = '-'
                          const isPlayoffWeek = weekNum === 11 || weekNum === 12
                          
                          if (match) {
                            if (!match.team2Id || !match.team2) {
                              cellContent = (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-gray-400">TBD</span>
                                  {isPlayoffWeek && (
                                    <button
                                      onClick={() => handleDeleteMatch(match.id)}
                                      className="text-xs text-red-600 hover:text-red-700 underline"
                                      title="Delete match"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )
                            } else {
                              // Check if match is completed (all 4 players have submitted total scores)
                              const weekScores = scores.filter(s => {
                                const scoreWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
                                return scoreWeekNum === weekNum && s.total !== null && s.total !== undefined
                              })

                              const playersInMatch = [
                                match.team1.player1.id,
                                match.team1.player2.id,
                                match.team2.player1.id,
                                match.team2.player2.id
                              ]

                              const playersWithScores = new Set(weekScores.map(s => s.playerId))
                              const allPlayersSubmitted = playersInMatch.every(playerId => playersWithScores.has(playerId))

                              const opponent = match.team1Id === team.id ? match.team2 : match.team1
                              const score = match.team1Points === 0 && match.team2Points === 0 
                                ? '-' 
                                : `${match.team1Id === team.id ? match.team1Points : match.team2Points}-${match.team1Id === team.id ? match.team2Points : match.team1Points}`
                              
                              // Only show W/L if match is completed
                              let result = '-'
                              let isWin = false
                              let isLoss = false
                              
                              if (allPlayersSubmitted && match.winnerId !== null) {
                                if (match.winnerId === team.id) {
                                  result = 'W'
                                  isWin = true
                                } else {
                                  result = 'L'
                                  isLoss = true
                                }
                              }
                              
                              cellContent = (
                                <div className="flex flex-col items-center gap-1">
                                  <Link
                                    href={`/match?matchId=${match.id}&leagueId=${leagueId}`}
                                    className={`hover:underline ${
                                      isWin ? 'text-green-600 font-semibold' : 
                                      isLoss ? 'text-red-600 font-semibold' : 
                                      'text-blue-600'
                                    }`}
                                  >
                                    <div>vs Team {opponent?.teamNumber}</div>
                                    <div className="text-xs">{result} {score}</div>
                                  </Link>
                                  {isPlayoffWeek && (
                                    <button
                                      onClick={() => handleDeleteMatch(match.id)}
                                      className="text-xs text-red-600 hover:text-red-700 underline"
                                      title="Delete match"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )
                            }
                          } else if (isPlayoffWeek && week) {
                            // For weeks 11 and 12, make cell clickable to create match
                            cellContent = (
                              <button
                                onClick={() => {
                                  setSelectedWeek(week)
                                  setSelectedTeam(team.id)
                                  setSelectedOpponent('')
                                  setShowMatchModal(true)
                                }}
                                className="w-full h-full px-2 py-2 text-blue-600 hover:bg-blue-50 rounded cursor-pointer text-sm"
                              >
                                + Create Match
                              </button>
                            )
                          }
                          
                          return (
                            <td key={weekNum} className="border border-gray-300 px-3 py-2 text-center">
                              {cellContent}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Match Creation Modal for Weeks 11 and 12 */}
      {showMatchModal && selectedWeek && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              Create Match - {selectedWeek.isChampionship ? 'Championship' : `Week ${selectedWeek.weekNumber}`}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Team:</label>
              <div className="p-2 bg-gray-50 rounded">
                Team {teams.find(t => t.id === selectedTeam)?.teamNumber}
                <div className="text-xs text-gray-600 mt-1">
                  {teams.find(t => t.id === selectedTeam)?.player1.firstName} {teams.find(t => t.id === selectedTeam)?.player1.lastName} & {teams.find(t => t.id === selectedTeam)?.player2.firstName} {teams.find(t => t.id === selectedTeam)?.player2.lastName}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Opponent:</label>
              <select
                value={selectedOpponent}
                onChange={(e) => setSelectedOpponent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select opponent team...</option>
                {teams
                  .filter(t => t.id !== selectedTeam)
                  .map(team => (
                    <option key={team.id} value={team.id.toString()}>
                      Team {team.teamNumber} - {team.player1.firstName} {team.player1.lastName} & {team.player2.firstName} {team.player2.lastName}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowMatchModal(false)
                  setSelectedWeek(null)
                  setSelectedTeam(null)
                  setSelectedOpponent('')
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMatch}
                disabled={!selectedOpponent}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  selectedOpponent
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Create Match
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

