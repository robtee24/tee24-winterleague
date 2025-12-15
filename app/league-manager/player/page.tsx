'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Player {
  id: number
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
}

interface Handicap {
  id: number
  weekId: number
  handicap: number
  rawHandicap: number | null
  appliedHandicap: number | null
  isBaseline: boolean
  week: {
    weekNumber: number
  }
}

interface Score {
  id: number
  playerId: number
  weekId: number
  hole1: number | null
  hole2: number | null
  hole3: number | null
  hole4: number | null
  hole5: number | null
  hole6: number | null
  hole7: number | null
  hole8: number | null
  hole9: number | null
  hole10: number | null
  hole11: number | null
  hole12: number | null
  hole13: number | null
  hole14: number | null
  hole15: number | null
  hole16: number | null
  hole17: number | null
  hole18: number | null
  front9: number | null
  back9: number | null
  total: number | null
  weightedScore: number | null
  scorecardImage: string | null
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

export default function PlayerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = searchParams.get('playerId')
  const leagueId = searchParams.get('leagueId')

  const [player, setPlayer] = useState<Player | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [allLeagueScores, setAllLeagueScores] = useState<Score[]>([]) // All scores in league for round low calculation
  const [allPlayers, setAllPlayers] = useState<Player[]>([]) // All players in league
  const [handicaps, setHandicaps] = useState<Handicap[]>([])
  const [weeks, setWeeks] = useState<{ id: number; weekNumber: number; isChampionship: boolean }[]>([])
  const [editingScore, setEditingScore] = useState<Score | null>(null)
  const [editingHandicaps, setEditingHandicaps] = useState<{ [weekId: number]: number }>({})
  const [editingHandicapWeekId, setEditingHandicapWeekId] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [contactInfo, setContactInfo] = useState({ phone: '', email: '' })
  const [editingName, setEditingName] = useState(false)
  const [nameInfo, setNameInfo] = useState({ firstName: '', lastName: '' })
  const [teams, setTeams] = useState<Array<{
    id: number
    teamNumber: number
    player1: Player
    player2: Player
  }>>([])
  const [showAddTeamMember, setShowAddTeamMember] = useState(false)
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('')

  useEffect(() => {
    if (!playerId || !leagueId) {
      router.push('/league-manager')
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, leagueId, router])

  const loadData = () => {
    if (!playerId || !leagueId) return

    fetch(`/api/players?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(players => {
        setAllPlayers(players)
        const found = players.find((p: Player) => p.id === parseInt(playerId))
        if (found) {
          setPlayer(found)
          setContactInfo({
            phone: found.phone || '',
            email: found.email || ''
          })
          setNameInfo({
            firstName: found.firstName || '',
            lastName: found.lastName || ''
          })
        }
      })

    fetch(`/api/scores?playerId=${playerId}`)
      .then(res => res.json())
      .then(data => setScores(data))

    // Fetch all scores for the league to calculate round lows
    fetch(`/api/scores?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setAllLeagueScores(data))

    fetch(`/api/handicaps?playerId=${playerId}`)
      .then(res => res.json())
      .then(data => {
        setHandicaps(data)
        const handicapMap: { [weekId: number]: number } = {}
        data.forEach((h: Handicap) => {
          handicapMap[h.weekId] = h.handicap
        })
        setEditingHandicaps(handicapMap)
      })

    fetch(`/api/weeks?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setWeeks(data))

    // Fetch teams for this player
    fetch(`/api/teams?playerId=${playerId}`)
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(err => console.error('Error fetching teams:', err))
  }

  const handleHandicapSave = async (weekId: number) => {
    if (!playerId) return

    const handicap = editingHandicaps[weekId] || 0

    try {
      const response = await fetch('/api/handicaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: parseInt(playerId),
          weekId,
          handicap
        })
      })

      if (response.ok) {
        setEditingHandicapWeekId(null)
        
        // Recalculate weighted scores for ALL scores for this player/week
        // The API already does this, but we'll reload to ensure UI is updated
        // Find the week to get weekNumber for finding all related scores
        const week = weeks.find(w => w.id === weekId)
        if (week) {
          // Find all scores for this weekNumber (handles duplicate weeks)
          const weekScores = scores.filter(s => s.week.weekNumber === week.weekNumber)
          for (const weekScore of weekScores) {
            if (weekScore.total !== null && weekScore.total !== undefined) {
              const newWeightedScore = Math.round(weekScore.total - handicap)
              await fetch(`/api/scores/${weekScore.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  weightedScore: newWeightedScore
                })
              })
            }
          }
        }
        
        loadData()
      } else {
        const error = await response.json()
        console.error('Error saving handicap:', error)
        alert(`Failed to save handicap: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving handicap:', error)
      alert('Failed to save handicap. Please try again.')
    }
  }

  const handleScoreUpdate = async (scoreId: number, field: string, value: number) => {
    await fetch(`/api/scores/${scoreId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    })

    loadData()
  }

  const getHandicapForWeek = (weekId: number, preferApplied: boolean = false) => {
    // Find all handicaps for this weekId
    const weekHandicaps = handicaps.filter(h => h.weekId === weekId)
    
    if (weekHandicaps.length === 0) return 0
    
    // If preferApplied is true, look for appliedHandicap first
    if (preferApplied) {
      const withApplied = weekHandicaps.find(h => 
        h.appliedHandicap !== null && h.appliedHandicap !== undefined && h.appliedHandicap !== 0
      )
      if (withApplied) return withApplied.appliedHandicap!
    }
    
    // Prefer appliedHandicap if available, otherwise use handicap
    const withApplied = weekHandicaps.find(h => 
      h.appliedHandicap !== null && h.appliedHandicap !== undefined
    )
    if (withApplied) {
      return withApplied.appliedHandicap ?? withApplied.handicap ?? 0
    }
    
    // Fall back to handicap field
    const nonZero = weekHandicaps.find(h => h.handicap !== 0)
    if (nonZero) return nonZero.handicap
    
    // Otherwise return the first one (or 0 if all are 0)
    return weekHandicaps[0]?.handicap || 0
  }

  if (!player) return <div>Loading...</div>

  const handleUpdateName = async () => {
    if (!playerId || !leagueId || !player) return

    if (!nameInfo.firstName.trim()) {
      alert('First name is required')
      return
    }

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: nameInfo.firstName.trim(),
          lastName: nameInfo.lastName.trim() || null,
          // Preserve existing phone and email
          phone: player.phone || null,
          email: player.email || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update name')
      }

      setPlayer(data)
      setEditingName(false)
      loadData() // Reload to ensure all data is fresh
    } catch (error: any) {
      console.error('Error updating name:', error)
      alert(`Failed to update name: ${error.message || 'Unknown error'}`)
    }
  }

  const handleUpdateContact = async () => {
    if (!playerId || !leagueId || !player) return

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Preserve existing name
          firstName: player.firstName,
          lastName: player.lastName || null,
          // Update contact info
          phone: contactInfo.phone.trim() || null,
          email: contactInfo.email.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update contact information')
      }

      setPlayer(data)
      setEditingContact(false)
      loadData()
    } catch (error: any) {
      console.error('Error updating contact:', error)
      alert(`Failed to update contact information: ${error?.message || 'Please try again.'}`)
    }
  }

  const handleAddTeamMember = async () => {
    if (!playerId || !leagueId || !selectedTeamMember) {
      alert('Please select a team member')
      return
    }

    try {
      console.log('Creating team with:', {
        leagueId: parseInt(leagueId),
        player1Id: parseInt(playerId),
        player2Id: parseInt(selectedTeamMember)
      })

      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: parseInt(leagueId),
          player1Id: parseInt(playerId),
          player2Id: parseInt(selectedTeamMember)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('API Error Response:', data)
        throw new Error(data.error || `Failed to create team: ${response.status} ${response.statusText}`)
      }

      console.log('Team created successfully:', data)
      setSelectedTeamMember('')
      setShowAddTeamMember(false)
      loadData() // Reload to show new team
    } catch (error: any) {
      console.error('Error creating team:', error)
      alert(`Failed to create team: ${error.message || 'Unknown error'}`)
    }
  }

  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm('Are you sure you want to remove this team assignment?')) return

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete team')
      }

      loadData() // Reload to update teams list
    } catch (error: any) {
      console.error('Error deleting team:', error)
      alert(`Failed to delete team: ${error.message || 'Unknown error'}`)
    }
  }

  const handleDelete = async () => {
    if (!playerId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete player')
      }

      // Redirect back to league setup page
      router.push(`/league-manager/setup?leagueId=${leagueId}`)
    } catch (error: any) {
      console.error('Error deleting player:', error)
      alert(`Failed to delete player: ${error.message || 'Unknown error'}`)
      setDeleting(false)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete Member
          </button>
        </div>
        <div className="flex items-center gap-3 mb-8">
          {editingName ? (
            <div className="flex items-center gap-3 flex-1">
              <input
                type="text"
                value={nameInfo.firstName}
                onChange={(e) => setNameInfo({ ...nameInfo, firstName: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-3xl font-bold"
                placeholder="First Name"
                autoFocus
              />
              <input
                type="text"
                value={nameInfo.lastName}
                onChange={(e) => setNameInfo({ ...nameInfo, lastName: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-3xl font-bold"
                placeholder="Last Name"
              />
              <button
                onClick={handleUpdateName}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingName(false)
                  setNameInfo({
                    firstName: player.firstName || '',
                    lastName: player.lastName || ''
                  })
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-black">
                {player.firstName} {player.lastName}
              </h1>
              <button
                onClick={() => setEditingName(true)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit name"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Contact Information Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <button
              onClick={() => {
                if (editingContact) {
                  // Save changes
                  handleUpdateContact()
                } else {
                  // Start editing
                  setEditingContact(true)
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingContact ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingContact ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={contactInfo.phone}
                  onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
                <input
                  type="email"
                  value={contactInfo.email}
                  onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="Email address"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button
                  onClick={() => {
                    setEditingContact(false)
                    setContactInfo({
                      phone: player.phone || '',
                      email: player.email || ''
                    })
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Phone</h3>
                <p className="text-gray-800">{player.phone || 'Not provided'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Email</h3>
                <p className="text-gray-800">{player.email || 'Not provided'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Team Assignments Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Team Assignments</h2>
            <button
              onClick={() => setShowAddTeamMember(!showAddTeamMember)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={teams.length >= 2}
            >
              {teams.length === 0 ? 'Assign Team Member' : teams.length === 1 ? 'Add to Additional Team' : 'Max Teams (2)'}
            </button>
          </div>

          {showAddTeamMember && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-semibold mb-2">Select Team Member:</label>
              <select
                value={selectedTeamMember}
                onChange={(e) => setSelectedTeamMember(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              >
                <option value="">Select a player...</option>
                {allPlayers
                  .filter(p => p.id !== parseInt(playerId || '0'))
                  .map(p => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddTeamMember}
                  disabled={!selectedTeamMember}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    selectedTeamMember
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Create Team
                </button>
                <button
                  onClick={() => {
                    setShowAddTeamMember(false)
                    setSelectedTeamMember('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {teams.length > 0 ? (
            <div className="space-y-2">
              {teams.map((team) => {
                const partner = team.player1.id === parseInt(playerId || '0')
                  ? team.player2
                  : team.player1
                return (
                  <div key={team.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="font-semibold">Team {team.teamNumber}: </span>
                      <span className="text-blue-600">
                        {partner.firstName} {partner.lastName}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No team assignments yet</p>
          )}
        </div>

        {/* Handicap Progress & Strokes Back Table */}
        {(() => {
          const tableData: Array<{
            week: number
            strokesBack: number | null
            progressiveHandicap: number | null
          }> = []

          // Get all scores for this league to find round lows
          // Use display week number (championship = 12)
          const allScoresByWeek = new Map<number, Score[]>()
          allLeagueScores.forEach(score => {
            const displayWeekNum = getWeekNumberForDisplay(score.week)
            if (!allScoresByWeek.has(displayWeekNum)) {
              allScoresByWeek.set(displayWeekNum, [])
            }
            allScoresByWeek.get(displayWeekNum)!.push(score)
          })

          for (let weekNum = 1; weekNum <= 12; weekNum++) {
            // For championship (week 12), find by isChampionship flag
            const playerScore = weekNum === 12
              ? scores.find(s => s.week.isChampionship)
              : scores.find(s => s.week.weekNumber === weekNum && !s.week.isChampionship)
            const weekScores = allScoresByWeek.get(weekNum) || []
            
            let strokesBack: number | null = null
            if (playerScore?.total && weekScores.length > 0) {
              const roundLow = Math.min(...weekScores.map(s => s.total || Infinity).filter(t => t !== Infinity))
              if (roundLow !== Infinity) {
                strokesBack = playerScore.total - roundLow
              }
            }

            // Get progressive handicap (applied handicap for this week)
            // Only show if prior week is complete (all players submitted)
            const matchingWeeks = weekNum === 12
              ? weeks.filter(w => w.isChampionship)
              : weeks.filter(w => w.weekNumber === weekNum && !w.isChampionship)
            let progressiveHandicap: number | null = null
            
            // Check if prior week is complete (for weeks 2+)
            let priorWeekComplete = true
            if (weekNum > 1) {
              const priorWeekScores = allScoresByWeek.get(weekNum - 1) || []
              const uniquePlayersInPriorWeek = new Set(priorWeekScores.map(s => s.playerId))
              // Compare to total number of players in league
              priorWeekComplete = uniquePlayersInPriorWeek.size === allPlayers.length && allPlayers.length > 0
            }
            
            // Only show handicap if prior week is complete (or it's week 1)
            // Championship doesn't use progressive handicap
            if (weekNum !== 12 && priorWeekComplete && matchingWeeks.length > 0) {
              // Prefer appliedHandicap when available
              const allHandicaps = matchingWeeks
                .map(w => getHandicapForWeek(w.id, true))
                .filter(h => h !== 0)
              progressiveHandicap = allHandicaps.length > 0 ? allHandicaps[0] : getHandicapForWeek(matchingWeeks[0].id, true)
            }

            tableData.push({
              week: weekNum,
              strokesBack,
              progressiveHandicap
            })
          }

          return (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Handicap Progress & Strokes Back</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">Week</th>
                      <th className="border border-gray-300 px-4 py-2">Strokes Back from Lead</th>
                      <th className="border border-gray-300 px-4 py-2">Progressive Handicap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((data) => (
                      <tr key={data.week}>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {getWeekDisplayName(data.week)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {data.strokesBack !== null ? data.strokesBack : '-'}
                        </td>
                        <td className="border border-gray-300 px-4 py-2 text-center">
                          {data.progressiveHandicap !== null ? data.progressiveHandicap : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* Scores Table */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Scores by Week</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2">Week</th>
                  <th className="border border-gray-300 px-4 py-2">18 Hole Non-Handicapped</th>
                  <th className="border border-gray-300 px-4 py-2">Handicap</th>
                  <th className="border border-gray-300 px-4 py-2">Handicapped Score</th>
                  <th className="border border-gray-300 px-4 py-2">Scorecard</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => {
                  const weekNumber = i + 1
                  // For championship (week 12), find by isChampionship flag
                  const weekScores = weekNumber === 12
                    ? scores.filter(s => s.week.isChampionship)
                    : scores.filter(s => s.week.weekNumber === weekNumber && !s.week.isChampionship)
                  const score = weekScores.length > 0
                    ? (weekScores.find(s => s.scorecardImage) || weekScores.sort((a, b) => b.id - a.id)[0])
                    : undefined
                  // Find all weeks with this weekNumber (or championship for week 12)
                  const matchingWeeks = weekNumber === 12
                    ? weeks.filter(w => w.isChampionship)
                    : weeks.filter(w => w.weekNumber === weekNumber && !w.isChampionship)
                  
                  // Check if prior week is complete (for weeks 2+)
                  let priorWeekComplete = true
                  if (weekNumber > 1) {
                    const priorWeekScores = allLeagueScores.filter(s => s.week.weekNumber === weekNumber - 1)
                    const uniquePlayersInPriorWeek = new Set(priorWeekScores.map(s => s.playerId))
                    // Compare to total number of players in league
                    priorWeekComplete = uniquePlayersInPriorWeek.size === allPlayers.length && allPlayers.length > 0
                  }
                  
                  // Find handicap for any of the matching weeks (prefer non-zero)
                  // Only show handicap if prior week is complete (or it's week 1)
                  let handicap: number | null = null
                  if (priorWeekComplete && matchingWeeks.length > 0) {
                    const allHandicaps = matchingWeeks
                      .map(w => getHandicapForWeek(w.id))
                      .filter(h => h !== 0)
                    handicap = allHandicaps.length > 0 ? allHandicaps[0] : getHandicapForWeek(matchingWeeks[0].id)
                  }
                  const week = matchingWeeks[0] // Use first week for editing
                  return (
                    <tr key={weekNumber}>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {getWeekDisplayName(weekNumber)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <button
                          onClick={() => {
                            if (score) {
                              setEditingScore(score)
                            } else if (week) {
                              // Create a new score object for editing
                              setEditingScore({
                                id: 0, // Will be created on save
                                weekId: week.id,
                                playerId: parseInt(playerId || '0'),
                                hole1: null,
                                hole2: null,
                                hole3: null,
                                hole4: null,
                                hole5: null,
                                hole6: null,
                                hole7: null,
                                hole8: null,
                                hole9: null,
                                hole10: null,
                                hole11: null,
                                hole12: null,
                                hole13: null,
                                hole14: null,
                                hole15: null,
                                hole16: null,
                                hole17: null,
                                hole18: null,
                                front9: null,
                                back9: null,
                                total: null,
                                weightedScore: null,
                                scorecardImage: null,
                                week: {
                                  weekNumber: week.weekNumber
                                }
                              } as Score)
                            }
                          }}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          {score?.total || '-'}
                        </button>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {editingHandicapWeekId === week?.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              step="1"
                              value={editingHandicaps[week.id] !== undefined ? editingHandicaps[week.id] : (handicap ?? 0)}
                              onChange={(e) => {
                                setEditingHandicaps({
                                  ...editingHandicaps,
                                  [week.id]: parseInt(e.target.value) || 0
                                })
                              }}
                              onBlur={() => {
                                if (week) {
                                  handleHandicapSave(week.id)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (week) {
                                    handleHandicapSave(week.id)
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingHandicapWeekId(null)
                                  loadData()
                                }
                              }}
                              autoFocus
                              className="w-20 px-2 py-1 border border-blue-500 rounded text-center"
                            />
                          </div>
                        ) : (
                          handicap !== null ? (
                            <button
                              onClick={() => {
                                if (week) {
                                  setEditingHandicapWeekId(week.id)
                                  // Initialize with current handicap value if not already set
                                  if (editingHandicaps[week.id] === undefined) {
                                    setEditingHandicaps({
                                      ...editingHandicaps,
                                      [week.id]: handicap
                                    })
                                  }
                                }
                              }}
                              className="text-blue-600 hover:underline cursor-pointer"
                            >
                              {handicap}
                            </button>
                          ) : (
                            '-'
                          )
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {score?.weightedScore !== null && score?.weightedScore !== undefined ? Math.round(score.weightedScore) : '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {score?.scorecardImage ? (
                          <a
                            href={score.scorecardImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault()
                              window.open(score.scorecardImage!, '_blank', 'noopener,noreferrer')
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                            title="Click to view scorecard image in new window"
                          >
                            📷 View Image
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Score Modal */}
        {editingScore && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <h2 className="text-2xl font-bold mb-4">
                Edit Scores - Week {editingScore.week.weekNumber}
              </h2>
              <div className="grid grid-cols-9 gap-2 mb-4">
                {Array.from({ length: 18 }, (_, i) => {
                  const holeNum = i + 1
                  const field = `hole${holeNum}` as keyof Score
                  const value = editingScore[field] as number | null
                  return (
                    <div key={i} className="text-center">
                      <label className="block text-xs mb-1">H{i + 1}</label>
                      <input
                        type="number"
                        value={value || ''}
                          onChange={(e) => {
                            const newScore = { ...editingScore }
                            const value = parseInt(e.target.value) || null
                            ;(newScore as any)[field] = value
                          
                          // Auto-calculate front 9, back 9, and total
                          const front9 = Array.from({ length: 9 }, (_, i) => 
                            newScore[`hole${i + 1}` as keyof Score] as number || 0
                          ).reduce((a, b) => a + b, 0)
                          
                          const back9 = Array.from({ length: 9 }, (_, i) => 
                            newScore[`hole${i + 10}` as keyof Score] as number || 0
                          ).reduce((a, b) => a + b, 0)
                          
                          newScore.front9 = front9
                          newScore.back9 = back9
                          newScore.total = front9 + back9
                          
                          setEditingScore(newScore as Score)
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1">Front 9</label>
                  <input
                    type="number"
                    value={editingScore.front9 || ''}
                    onChange={(e) => {
                      setEditingScore({ ...editingScore, front9: parseInt(e.target.value) || null })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Back 9</label>
                  <input
                    type="number"
                    value={editingScore.back9 || ''}
                    onChange={(e) => {
                      setEditingScore({ ...editingScore, back9: parseInt(e.target.value) || null })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Total</label>
                  <input
                    type="number"
                    value={editingScore.total || ''}
                    onChange={(e) => {
                      setEditingScore({ ...editingScore, total: parseInt(e.target.value) || null })
                    }}
                    className="px-2 py-1 border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={async () => {
                    // Calculate totals
                    const front9 = Array.from({ length: 9 }, (_, i) => 
                      editingScore[`hole${i + 1}` as keyof Score] as number || 0
                    ).reduce((a, b) => a + b, 0)
                    const back9 = Array.from({ length: 9 }, (_, i) => 
                      editingScore[`hole${i + 10}` as keyof Score] as number || 0
                    ).reduce((a, b) => a + b, 0)
                    const total = front9 + back9
                    
                    // Get handicap for this week
                    const week = weeks.find(w => w.weekNumber === editingScore.week.weekNumber)
                    const handicap = week ? getHandicapForWeek(week.id) : 0
                    const weightedScore = Math.round(total - handicap)

                    // Collect all hole scores - ensure we have 18 values
                    const scores = Array.from({ length: 18 }, (_, i) => {
                      const holeNum = i + 1
                      const field = `hole${holeNum}` as keyof Score
                      const value = editingScore[field] as number | null
                      return value !== null && value !== undefined ? value : 0
                    })

                    // Validate that we have at least some scores entered
                    const hasScores = scores.some(score => score > 0)
                    if (!hasScores && total === 0) {
                      alert('Please enter at least one hole score before saving.')
                      return
                    }

                    // Validate that we have a valid weekId
                    if (!editingScore.weekId) {
                      alert('Error: Week ID is missing. Please try refreshing the page.')
                      return
                    }

                    try {
                      if (editingScore.id === 0) {
                        // Create new score
                        console.log('Creating score with:', { playerId: editingScore.playerId, weekId: editingScore.weekId, scores })
                        const createRes = await fetch('/api/scores', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playerId: editingScore.playerId,
                            weekId: editingScore.weekId,
                            scores,
                            scorecardImage: editingScore.scorecardImage || null
                          })
                        })
                        
                        if (!createRes.ok) {
                          const error = await createRes.json()
                          console.error('Error response:', error)
                          throw new Error(error.error || 'Failed to create score')
                        }
                      } else {
                        // Update existing score - send only the fields that can be updated
                        const updateData: any = {
                          hole1: editingScore.hole1,
                          hole2: editingScore.hole2,
                          hole3: editingScore.hole3,
                          hole4: editingScore.hole4,
                          hole5: editingScore.hole5,
                          hole6: editingScore.hole6,
                          hole7: editingScore.hole7,
                          hole8: editingScore.hole8,
                          hole9: editingScore.hole9,
                          hole10: editingScore.hole10,
                          hole11: editingScore.hole11,
                          hole12: editingScore.hole12,
                          hole13: editingScore.hole13,
                          hole14: editingScore.hole14,
                          hole15: editingScore.hole15,
                          hole16: editingScore.hole16,
                          hole17: editingScore.hole17,
                          hole18: editingScore.hole18,
                          front9,
                          back9,
                          total
                        }
                        
                        const updateRes = await fetch(`/api/scores/${editingScore.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(updateData)
                        })
                        
                        if (!updateRes.ok) {
                          const error = await updateRes.json()
                          throw new Error(error.error || 'Failed to update score')
                        }
                      }
                      setEditingScore(null)
                      loadData()
                    } catch (error: any) {
                      console.error('Error saving score:', error)
                      alert(`Failed to save score: ${error.message || 'Unknown error'}`)
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                {editingScore.id === 0 && (
                  <button
                    onClick={async () => {
                      if (!editingScore || !leagueId) return

                      try {
                        // Calculate default score: roundLow + player's progressive handicap
                        // Get all scores for this week to find round low
                        const weekScores = allLeagueScores.filter(s => 
                          s.week.weekNumber === editingScore.week.weekNumber &&
                          s.total !== null && 
                          s.total !== undefined
                        )
                        
                        if (weekScores.length === 0) {
                          alert('No scores posted for this week yet. Cannot calculate default score.')
                          return
                        }

                        const roundLow = Math.min(...weekScores.map(s => s.total!))
                        const week = weeks.find(w => w.weekNumber === editingScore.week.weekNumber)
                        const playerHandicap = week ? getHandicapForWeek(week.id) : 0
                        const defaultTotal = roundLow + playerHandicap

                        // Distribute the total across 18 holes (roughly equal)
                        const avgPerHole = Math.round(defaultTotal / 18)
                        const defaultScores = Array.from({ length: 18 }, () => avgPerHole)
                        
                        // Adjust to make total exact
                        const currentTotal = defaultScores.reduce((a, b) => a + b, 0)
                        const difference = defaultTotal - currentTotal
                        if (difference !== 0) {
                          defaultScores[17] += difference
                        }

                        // Create score with default values
                        const createRes = await fetch('/api/scores', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            playerId: editingScore.playerId,
                            weekId: editingScore.weekId,
                            scores: defaultScores,
                            scorecardImage: null
                          })
                        })
                        
                        if (!createRes.ok) {
                          const error = await createRes.json()
                          throw new Error(error.error || 'Failed to create default score')
                        }

                        setEditingScore(null)
                        loadData()
                        alert(`Default score submitted: ${defaultTotal} (Round Low: ${roundLow} + Handicap: ${playerHandicap})`)
                      } catch (error: any) {
                        console.error('Error submitting default score:', error)
                        alert(`Failed to submit default score: ${error.message || 'Unknown error'}`)
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Submit Default Score
                  </button>
                )}
                <button
                  onClick={() => setEditingScore(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                Delete Member
              </h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <strong>{player?.firstName} {player?.lastName}</strong>? This will permanently delete the member and all their scores. This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-lg transition-colors ${
                    deleting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-lg font-semibold text-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
