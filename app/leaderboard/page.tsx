'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Player {
  id: number
  firstName: string
  lastName: string
  handicap: number
}

interface Score {
  id: number
  playerId: number
  total: number | null
  weightedScore: number | null
  week: {
    weekNumber: number
    isChampionship: boolean
  }
}

interface Team {
  id: number
  teamNumber: number
  player1: { id: number; firstName: string; lastName: string }
  player2: { id: number; firstName: string; lastName: string }
}

interface Match {
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

export default function LeaderboardPage() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<{ id: number; name: string }[]>([])
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [weeks, setWeeks] = useState<{ id: number; weekNumber: number; isChampionship: boolean }[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [activeTab, setActiveTab] = useState<'weighted' | 'unweighted'>('weighted')

  useEffect(() => {
    fetch('/api/leagues')
      .then(res => res.json())
      .then(data => {
        setLeagues(data)
        if (data.length > 0) {
          setSelectedLeagueId(data[0].id)
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedLeagueId) return

    fetch(`/api/players?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setPlayers(data))

    fetch(`/api/scores?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setScores(data))

    fetch(`/api/weeks?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setWeeks(data))

    fetch(`/api/teams?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(err => console.error('Error fetching teams:', err))

    fetch(`/api/matches?leagueId=${selectedLeagueId}`)
      .then(res => res.json())
      .then(data => setMatches(data))
      .catch(err => console.error('Error fetching matches:', err))
  }, [selectedLeagueId])

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

  // Find the last week that has been played (highest week number with at least one score)
  const getLastPlayedWeek = (): number | null => {
    if (scores.length === 0) return null
    
    let maxWeek = 0
    scores.forEach(score => {
      const weekNum = getWeekNumberForDisplay(score.week)
      if (weekNum > maxWeek) {
        maxWeek = weekNum
      }
    })
    
    return maxWeek > 0 ? maxWeek : null
  }

  // Get a player's score for a specific week
  const getPlayerScoreForWeek = (playerId: number, weekNum: number): number | null => {
    const playerScores = scores.filter(s => {
      const scoreWeekNum = getWeekNumberForDisplay(s.week)
      return s.playerId === playerId && scoreWeekNum === weekNum
    })
    
    if (playerScores.length === 0) return null
    
    // Get the most recent score for this week (in case of duplicates)
    const score = playerScores[playerScores.length - 1]
    return activeTab === 'weighted' 
      ? (score.weightedScore ?? score.total ?? null)
      : (score.total ?? null)
  }

  // Get the lowest (winning) handicapped score for a specific week
  const getWinningScoreForWeek = (weekNum: number): number | null => {
    if (activeTab !== 'weighted') return null
    
    const weekScores = scores.filter(s => {
      const scoreWeekNum = getWeekNumberForDisplay(s.week)
      return scoreWeekNum === weekNum && s.weightedScore !== null && s.weightedScore !== undefined
    })
    
    if (weekScores.length === 0) return null
    
    // Get the most recent score per player (in case of duplicates)
    const playerScoreMap = new Map<number, number>()
    weekScores.forEach(score => {
      const existing = playerScoreMap.get(score.playerId)
      if (existing === undefined || score.weightedScore! < existing) {
        playerScoreMap.set(score.playerId, score.weightedScore!)
      }
    })
    
    const allScores = Array.from(playerScoreMap.values())
    if (allScores.length === 0) return null
    
    return Math.min(...allScores)
  }

  // Check if a player won a specific week (has the lowest handicapped score)
  const isWeekWinner = (playerId: number, weekNum: number): boolean => {
    if (activeTab !== 'weighted') return false
    
    const winningScore = getWinningScoreForWeek(weekNum)
    if (winningScore === null) return false
    
    const playerScore = getPlayerScoreForWeek(playerId, weekNum)
    return playerScore !== null && playerScore === winningScore
  }

  // Check if all players have submitted scores for a specific week
  const allPlayersSubmittedForWeek = (weekNum: number): boolean => {
    if (players.length === 0) return false
    
    const weekScores = scores.filter(s => {
      const scoreWeekNum = getWeekNumberForDisplay(s.week)
      return scoreWeekNum === weekNum && s.total !== null && s.total !== undefined
    })
    
    const playersWithScores = new Set(weekScores.map(s => s.playerId))
    return playersWithScores.size === players.length
  }

  // Sort players by score in the last played week
  const lastPlayedWeek = getLastPlayedWeek()
  const sortedPlayers = [...players].sort((a, b) => {
    if (!lastPlayedWeek) {
      // If no week has been played, sort by total
      const totalA = getPlayerTotal(a.id)
      const totalB = getPlayerTotal(b.id)
      return totalA - totalB
    }

    const scoreA = getPlayerScoreForWeek(a.id, lastPlayedWeek)
    const scoreB = getPlayerScoreForWeek(b.id, lastPlayedWeek)

    // Check if players have any scores at all
    const hasAnyScoresA = scores.some(s => s.playerId === a.id)
    const hasAnyScoresB = scores.some(s => s.playerId === b.id)

    // Players without any scores go to the very bottom
    if (!hasAnyScoresA && !hasAnyScoresB) return 0
    if (!hasAnyScoresA) return 1 // a goes to bottom
    if (!hasAnyScoresB) return -1 // b goes to bottom

    // Players without a score for the last week go below those with scores
    if (scoreA === null && scoreB === null) return 0
    if (scoreA === null) return 1 // a goes to bottom
    if (scoreB === null) return -1 // b goes to bottom

    // Sort by score (lowest = best)
    return scoreA - scoreB
  })

  const getTeamRecord = (teamId: number): { wins: number; losses: number } => {
    let wins = 0
    let losses = 0

    matches.forEach(match => {
      if (!match.team2Id || !match.team2) return // Skip incomplete matches
      
      // First check if this team is actually in the match
      const isTeam1 = match.team1Id === teamId
      const isTeam2 = match.team2Id === teamId
      if (!isTeam1 && !isTeam2) return // Team is not in this match, skip it
      
        const weekNum = match.week.isChampionship ? 12 : match.week.weekNumber
      if (weekNum > 10) return // Only count weeks 1-10 for regular season record

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

      // Now check if this team won or lost
      if (match.winnerId === teamId) {
        wins++
      } else if (match.winnerId !== null && match.winnerId !== teamId) {
        losses++
      }
    })

    return { wins, losses }
  }

  // Sort teams by wins (highest to lowest), then by losses (lowest to highest)
  const sortedTeams = [...teams].sort((a, b) => {
    const recordA = getTeamRecord(a.id)
    const recordB = getTeamRecord(b.id)
    if (recordA.wins !== recordB.wins) {
      return recordB.wins - recordA.wins
    }
    return recordA.losses - recordB.losses
  })

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
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
        <h1 className="text-4xl font-bold mb-8 text-center text-black">Leaderboard</h1>

        {/* League Selection */}
        {leagues.length > 1 && (
          <div className="mb-6 bg-white rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold mb-2">Select League:</label>
            <select
              value={selectedLeagueId || ''}
              onChange={(e) => setSelectedLeagueId(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Individual Leaderboard */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-black">Individual Leaderboard</h2>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('weighted')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                activeTab === 'weighted'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Handicapped Scores
            </button>
            <button
              onClick={() => setActiveTab('unweighted')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                activeTab === 'unweighted'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Non-Handicapped Scores
            </button>
          </div>

          {/* Scores Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Rank</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Player</th>
                  {Array.from({ length: 12 }, (_, i) => {
                    const weekNumber = i + 1
                    // For Handicapped Scores tab, grey out header if not all players submitted
                    if (activeTab === 'weighted') {
                      const allSubmitted = allPlayersSubmittedForWeek(weekNumber)
                      return (
                        <th 
                          key={weekNumber} 
                          className={`border border-gray-300 px-4 py-2 ${
                            !allSubmitted ? 'bg-gray-300' : ''
                          }`}
                        >
                          {getWeekDisplayName(weekNumber)}
                        </th>
                      )
                    }
                    // For Non-Handicapped Scores tab, show normally
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
                {sortedPlayers.map((player, index) => {
                  const playerScores = getPlayerScores(player.id)
                  // Only highlight first place if they have a score for the last week
                  const hasScoreForLastWeek = lastPlayedWeek ? getPlayerScoreForWeek(player.id, lastPlayedWeek) !== null : false
                  const isFirstPlace = index === 0 && hasScoreForLastWeek
                  return (
                    <tr key={player.id} className={isFirstPlace ? 'bg-yellow-50' : ''}>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <Link
                          href={`/player?playerId=${player.id}&leagueId=${selectedLeagueId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {player.firstName} {player.lastName}
                        </Link>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const weekNumber = i + 1
                        const score = playerScores[weekNumber]
                        const isWinner = isWeekWinner(player.id, weekNumber)
                        
                        // For Handicapped Scores tab, check if all players submitted
                        if (activeTab === 'weighted') {
                          const allSubmitted = allPlayersSubmittedForWeek(weekNumber)
                          // Calculate the middle row index for showing "Awaiting Scores..."
                          // Use higher row when there's a tie (e.g., for 4 players, use index 1 instead of 2)
                          const middleRowIndex = Math.floor((sortedPlayers.length - 1) / 2)
                          const isMiddleRow = index === middleRowIndex
                          
                          return (
                            <td
                              key={weekNumber}
                              className={`border border-gray-300 px-4 py-2 text-center ${
                                !allSubmitted ? 'bg-gray-300' : 
                                isWinner ? 'bg-orange-50' : ''
                              }`}
                            >
                              {allSubmitted ? (
                                score !== undefined ? score : '-'
                              ) : (
                                isMiddleRow ? (
                                  <span className="text-gray-600 text-xs leading-none">No Winner, Awaiting Scores</span>
                                ) : (
                                  '-'
                                )
                              )}
                            </td>
                          )
                        }
                        
                        // For Non-Handicapped Scores tab, show normally
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

        {/* Team Leaderboard */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-black">Team Leaderboard</h2>
          {teams.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p>No teams have been created for this league yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left min-w-[200px]">Team</th>
                    {Array.from({ length: 12 }, (_, i) => {
                      const weekNum = i + 1
                      return (
                        <th key={weekNum} className="border border-gray-300 px-3 py-2 text-center">
                          {getWeekDisplayName(weekNum)}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.map((team, index) => {
                    const record = getTeamRecord(team.id)
                    const isFirstPlace = index === 0
                    return (
                      <tr key={team.id} className={isFirstPlace ? 'bg-yellow-50' : ''}>
                        <td className={`border border-gray-300 px-4 py-2 sticky left-0 z-10 min-w-[200px] ${isFirstPlace ? 'bg-yellow-50' : 'bg-white'}`}>
                          <div className="font-semibold">
                            Team {team.teamNumber}
                          </div>
                          <div className="text-xs text-gray-600">
                            {team.player1.firstName} {team.player1.lastName} & {team.player2.firstName} {team.player2.lastName}
                          </div>
                          <div className="text-xs font-semibold text-gray-700 mt-1">
                            {record.wins}-{record.losses}
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const weekNum = i + 1
                          // Find the week object for this week number
                          const week = weeks.find(w => 
                            weekNum === 12 ? w.isChampionship : (w.weekNumber === weekNum && !w.isChampionship)
                          )
                          
                          // Find the match for this team and week
                          const match = week ? matches.find(m => 
                            m.weekId === week.id &&
                            (m.team1Id === team.id || m.team2Id === team.id)
                          ) : null
                          
                          let cellContent: string | JSX.Element = '-'
                          
                          if (match) {
                            if (!match.team2Id || !match.team2) {
                              cellContent = <span className="text-gray-400">TBD</span>
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
                                <Link
                                  href={`/league-manager/match?matchId=${match.id}&leagueId=${selectedLeagueId}`}
                                  className={`text-sm hover:underline ${
                                    isWin ? 'text-green-600 font-semibold' : 
                                    isLoss ? 'text-red-600 font-semibold' : 
                                    'text-blue-600'
                                  }`}
                                >
                                  <div>vs Team {opponent?.teamNumber}</div>
                                  <div className="text-xs">{result}</div>
                                </Link>
                              )
                            }
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
    </main>
  )
}

