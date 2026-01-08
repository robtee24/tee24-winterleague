'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Player {
  id: number
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
}

interface Team {
  id: number
  teamNumber: number
  player1: { id: number; firstName: string; lastName: string }
  player2: { id: number; firstName: string; lastName: string }
}

interface Handicap {
  id: number
  weekId: number
  handicap: number
  week: {
    weekNumber: number
    isChampionship: boolean
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

function PlayerPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = searchParams.get('playerId')
  const leagueId = searchParams.get('leagueId')

  const [player, setPlayer] = useState<Player | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [handicaps, setHandicaps] = useState<Handicap[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [weeks, setWeeks] = useState<{ id: number; weekNumber: number; isChampionship: boolean }[]>([])
  const [allLeagueScores, setAllLeagueScores] = useState<Score[]>([])
  const [allLeaguePlayers, setAllLeaguePlayers] = useState<Player[]>([])
  const [activeTab, setActiveTab] = useState<'unweighted' | 'weighted'>('unweighted')
  const [selectedScore, setSelectedScore] = useState<Score | null>(null)
  const [showScoreModal, setShowScoreModal] = useState(false)

  useEffect(() => {
    if (!playerId || !leagueId) {
      router.push('/leaderboard')
      return
    }

    loadData()
  }, [playerId, leagueId, router])

  const loadData = () => {
    if (!playerId || !leagueId) return

    fetch(`/api/players/${playerId}`)
      .then(res => res.json())
      .then(data => setPlayer(data))
      .catch(err => console.error('Error fetching player:', err))

    fetch(`/api/scores?playerId=${playerId}&leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setScores(data))
      .catch(err => console.error('Error fetching scores:', err))

    fetch(`/api/handicaps?playerId=${playerId}`)
      .then(res => res.json())
      .then(data => setHandicaps(data))
      .catch(err => console.error('Error fetching handicaps:', err))

    fetch(`/api/teams?playerId=${playerId}&leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setTeams(data))
      .catch(err => console.error('Error fetching teams:', err))

    fetch(`/api/weeks?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setWeeks(data))
      .catch(err => console.error('Error fetching weeks:', err))

    fetch(`/api/matches?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setMatches(data))
      .catch(err => console.error('Error fetching matches:', err))

    fetch(`/api/scores?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setAllLeagueScores(data))
      .catch(err => console.error('Error fetching all league scores:', err))

    fetch(`/api/players?leagueId=${leagueId}`)
      .then(res => res.json())
      .then(data => setAllLeaguePlayers(data))
      .catch(err => console.error('Error fetching all league players:', err))
  }

  const getCurrentHandicap = (): number => {
    if (handicaps.length === 0) return 0
    
    // Get the most recent non-zero handicap
    const sortedHandicaps = [...handicaps].sort((a, b) => {
      const weekA = getWeekNumberForDisplay(a.week)
      const weekB = getWeekNumberForDisplay(b.week)
      return weekB - weekA
    })
    
    const nonZero = sortedHandicaps.find(h => h.handicap !== 0)
    return nonZero?.handicap || sortedHandicaps[0]?.handicap || 0
  }

  const getScoreForWeek = (weekNumber: number): Score | null => {
    return scores.find(s => {
      const displayWeek = getWeekNumberForDisplay(s.week)
      return displayWeek === weekNumber
    }) || null
  }

  const getHandicapForWeek = (weekNumber: number): number => {
    const week = weeks.find(w => 
            weekNumber === 12 ? w.isChampionship : (w.weekNumber === weekNumber && !w.isChampionship)
    )
    if (!week) return 0
    
    const handicap = handicaps.find(h => h.weekId === week.id)
    return handicap?.handicap || 0
  }

  const getPlayerTeams = (): Team[] => {
    if (!playerId) return []
    return teams.filter(team => 
      team.player1.id === parseInt(playerId) || team.player2.id === parseInt(playerId)
    )
  }

  const getTeamMatches = (teamId: number): Match[] => {
    return matches.filter(match => 
      (match.team1Id === teamId || match.team2Id === teamId) && match.team2Id !== null
    )
  }

  // Calculate week wins and total winnings (weeks where player had the lowest handicapped score)
  // If tied, all winners count it as a win and split the $50 prize
  const calculateWeekWinsAndWinnings = (): { wins: number; winnings: number } => {
    if (!playerId || allLeagueScores.length === 0) return { wins: 0, winnings: 0 }
    
    let wins = 0
    let totalWinnings = 0
    
    // Check each week (1-12)
    for (let weekNum = 1; weekNum <= 12; weekNum++) {
      // Get all scores for this week
      const weekScores = allLeagueScores.filter(s => {
        const displayWeek = getWeekNumberForDisplay(s.week)
        return displayWeek === weekNum && s.weightedScore !== null && s.weightedScore !== undefined
      })
      
      if (weekScores.length === 0) continue
      
      // Get the most recent score per player (in case of duplicates)
      const playerScoreMap = new Map<number, number>()
      weekScores.forEach(score => {
        const existing = playerScoreMap.get(score.playerId)
        if (existing === undefined || score.weightedScore! < existing) {
          playerScoreMap.set(score.playerId, score.weightedScore!)
        }
      })
      
      const allScores = Array.from(playerScoreMap.values())
      if (allScores.length === 0) continue
      
      // Find the lowest handicapped score for this week
      const lowestScore = Math.min(...allScores)
      
      // Check if this player has the lowest score
      const playerScore = playerScoreMap.get(parseInt(playerId))
      if (playerScore === undefined || playerScore !== lowestScore) continue
      
      // Count all players with the lowest score (winners)
      const winners = Array.from(playerScoreMap.entries()).filter(([_, score]) => score === lowestScore)
      const numberOfWinners = winners.length
      
      // Count as a win (even if tied)
      wins++
      
      // Calculate winnings: $50 split among all winners
      const weekWinnings = 50 / numberOfWinners
      totalWinnings += weekWinnings
    }
    
    return { wins, winnings: totalWinnings }
  }

  // Calculate team record (wins, losses, and ties)
  const getTeamRecord = (): { wins: number; losses: number; ties: number } => {
    if (!playerId) return { wins: 0, losses: 0, ties: 0 }
    
    let wins = 0
    let losses = 0
    let ties = 0
    
    playerTeams.forEach(team => {
      const teamMatches = getTeamMatches(team.id)
      
      teamMatches.forEach(match => {
        if (!match.team2Id || !match.team2) return
        
        const weekNum = getWeekNumberForDisplay(match.week)
        if (weekNum > 10) return // Only count weeks 1-10 for regular season record
        
        // Check if match is completed (all 4 players have submitted total scores)
        const weekScores = allLeagueScores.filter(s => {
          const scoreWeekNum = getWeekNumberForDisplay(s.week)
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

        // Check if this team won, lost, or tied
        if (match.winnerId === team.id) {
          wins++
        } else if (match.winnerId !== null && match.winnerId !== team.id) {
          losses++
        } else if (match.winnerId === null) {
          // Tie occurs when winnerId is null and all players have submitted
          ties++
        }
      })
    })
    
    return { wins, losses, ties }
  }

  const handleScoreClick = (score: Score) => {
    setSelectedScore(score)
    setShowScoreModal(true)
  }

  if (!player) return <div className="min-h-screen p-8 bg-gray-50">Loading...</div>

  const playerTeams = getPlayerTeams()
  const currentHandicap = getCurrentHandicap()

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
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-8 text-black">
          {player.firstName} {player.lastName}
        </h1>

        {/* Player Info Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-row gap-6">
            {/* Left Column - Individual */}
            <div className="w-1/2 border-r pr-6 border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Individual</h2>
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Current Handicap</h3>
                  <p className="text-2xl font-bold text-gray-800">{currentHandicap}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Week Wins</h3>
                  <p className="text-2xl font-bold text-gray-800">{(() => {
                    const { wins } = calculateWeekWinsAndWinnings()
                    return wins
                  })()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Winnings</h3>
                  <p className="text-2xl font-bold text-gray-800">${(() => {
                    const { winnings } = calculateWeekWinsAndWinnings()
                    return Math.round(winnings * 100) / 100 // Round to 2 decimal places
                  })().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            
            {/* Right Column - Team */}
            <div className="w-1/2 flex flex-col gap-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Team</h2>
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Team Assignments</h3>
                {playerTeams.length > 0 ? (
                  <div className="space-y-2">
                    {playerTeams.map(team => {
                      const partner = team.player1.id === player.id ? team.player2 : team.player1
                      return (
                        <div key={team.id} className="text-gray-800">
                          <span className="font-semibold">Team {team.teamNumber}</span>
                          <span className="text-gray-600"> - {partner.firstName} {partner.lastName}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600">No team assignments</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Team Record</h3>
                <p className="text-2xl font-bold text-gray-800">{(() => {
                  const record = getTeamRecord()
                  return `${record.wins}-${record.losses}-${record.ties}`
                })()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scores Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Scores</h2>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
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

          {/* Scores Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">Week</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Handicap</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Score</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Scorecard</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => {
                  const weekNum = i + 1
                  const score = getScoreForWeek(weekNum)
                  const handicap = getHandicapForWeek(weekNum)
                  const displayValue = score 
                    ? (activeTab === 'weighted' ? (score.weightedScore || '-') : (score.total || '-'))
                    : '-'
                  
                  return (
                    <tr key={weekNum}>
                      <td className="border border-gray-300 px-4 py-2">
                        {getWeekDisplayName(weekNum)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {handicap}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {score && (score.total !== null || score.weightedScore !== null) ? (
                          <button
                            onClick={() => handleScoreClick(score)}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            {displayValue}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {score && score.scorecardImage ? (
                          <a
                            href={score.scorecardImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Matches Section */}
        {playerTeams.length > 0 && (() => {
          const allTeamMatches = playerTeams.flatMap(team => {
            const teamMatches = getTeamMatches(team.id)
              .sort((a, b) => {
                const weekA = getWeekNumberForDisplay(a.week)
                const weekB = getWeekNumberForDisplay(b.week)
                return weekA - weekB
              })
            return teamMatches.map(match => ({ match, team }))
          }).sort((a, b) => {
            const weekA = getWeekNumberForDisplay(a.match.week)
            const weekB = getWeekNumberForDisplay(b.match.week)
            return weekA - weekB
          })

          return (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Team Matches</h2>
              {allTeamMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <p>No team matches scheduled yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Week</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Team</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Opponent</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTeamMatches.map(({ match, team }) => {
                        const isTeam1 = match.team1Id === team.id
                        const opponent = isTeam1 ? match.team2 : match.team1
                        const weekNum = getWeekNumberForDisplay(match.week)
                        const isWin = match.winnerId === team.id
                        const isLoss = match.winnerId !== null && match.winnerId !== team.id
                        const teamPoints = isTeam1 ? match.team1Points : match.team2Points
                        const opponentPoints = isTeam1 ? match.team2Points : match.team1Points
                        const matchScore = (teamPoints > 0 || opponentPoints > 0) 
                          ? `${teamPoints}-${opponentPoints}` 
                          : '-'
                        
                        return (
                          <tr key={match.id}>
                            <td className="border border-gray-300 px-4 py-2">
                              {getWeekDisplayName(weekNum)}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              Team {team.teamNumber}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              {opponent ? `Team ${opponent.teamNumber}` : 'TBD'}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {opponent ? (
                                <Link
                                  href={`/match?matchId=${match.id}&leagueId=${leagueId}`}
                                  className={`font-semibold hover:underline ${
                                    isWin ? 'text-green-600' : 
                                    isLoss ? 'text-red-600' : 
                                    'text-gray-600'
                                  }`}
                                >
                                  <div>{isWin ? 'W' : isLoss ? 'L' : '-'}</div>
                                  <div className="text-xs font-normal">{matchScore}</div>
                                </Link>
                              ) : (
                                <span className="text-gray-400">TBD</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

        {/* Score Detail Modal */}
        {showScoreModal && selectedScore && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  {getWeekDisplayName(getWeekNumberForDisplay(selectedScore.week))} - Hole by Hole
                </h3>
                <button
                  onClick={() => {
                    setShowScoreModal(false)
                    setSelectedScore(null)
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2">Hole</th>
                      {Array.from({ length: 18 }, (_, i) => (
                        <th key={i + 1} className="border border-gray-300 px-2 py-2 text-center">
                          {i + 1}
                        </th>
                      ))}
                      <th className="border border-gray-300 px-4 py-2 text-center">Front 9</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Back 9</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 font-semibold">Score</td>
                      {Array.from({ length: 18 }, (_, i) => {
                        const holeNum = i + 1
                        const holeKey = `hole${holeNum}` as keyof Score
                        const value = selectedScore[holeKey] as number | null
                        return (
                          <td key={holeNum} className="border border-gray-300 px-2 py-2 text-center">
                            {value !== null && value !== undefined ? value : '-'}
                          </td>
                        )
                      })}
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold bg-green-50">
                        {selectedScore.front9 || '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold bg-green-50">
                        {selectedScore.back9 || '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-semibold bg-blue-50">
                        {selectedScore.total || '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </main>
    }>
      <PlayerPageContent />
    </Suspense>
  )
}
