'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Team {
  id: number
  teamNumber: number
  player1: {
    id: number
    firstName: string
    lastName: string
  }
  player2: {
    id: number
    firstName: string
    lastName: string
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
  team1: Team
  team2: Team | null
  week: {
    id: number
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
  total: number | null
  week: {
    id: number
    weekNumber: number
    isChampionship: boolean
  }
}

export default function MatchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const leagueId = searchParams.get('leagueId')

  const [match, setMatch] = useState<Match | null>(null)
  const [team1Scores, setTeam1Scores] = useState<{ player1: Score | null; player2: Score | null }>({ player1: null, player2: null })
  const [team2Scores, setTeam2Scores] = useState<{ player1: Score | null; player2: Score | null }>({ player1: null, player2: null })
  const [holeWinners, setHoleWinners] = useState<Array<'team1' | 'team2' | 'tie'>>([])

  useEffect(() => {
    if (!matchId || !leagueId) {
      router.push('/league-manager')
      return
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, leagueId, router])

  const loadData = () => {
    if (!matchId || !leagueId) return

    fetch(`/api/matches/${matchId}`)
      .then(res => res.json())
      .then(data => {
        setMatch(data)
        return data
      })
      .then(async (matchData: Match) => {
        if (!matchData.team2Id || !matchData.team2) return

        // TypeScript guard: we know team2 exists after the check above
        const team2 = matchData.team2

        // Fetch all scores for each player and filter by weekNumber (handles duplicate weeks)
        const weekNumber = matchData.week.isChampionship ? 12 : matchData.week.weekNumber
        const isChampionship = matchData.week.isChampionship

        // Fetch scores for team 1
        const team1Player1Scores = await fetch(`/api/scores?playerId=${matchData.team1.player1.id}`)
          .then(res => res.json())
        const team1Player1Score = team1Player1Scores.find((s: any) => {
          const sWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
          return sWeekNum === weekNumber && s.week.isChampionship === isChampionship
        })
        
        const team1Player2Scores = await fetch(`/api/scores?playerId=${matchData.team1.player2.id}`)
          .then(res => res.json())
        const team1Player2Score = team1Player2Scores.find((s: any) => {
          const sWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
          return sWeekNum === weekNumber && s.week.isChampionship === isChampionship
        })

        // Fetch scores for team 2
        const team2Player1Scores = await fetch(`/api/scores?playerId=${team2.player1.id}`)
          .then(res => res.json())
        const team2Player1Score = team2Player1Scores.find((s: any) => {
          const sWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
          return sWeekNum === weekNumber && s.week.isChampionship === isChampionship
        })
        
        const team2Player2Scores = await fetch(`/api/scores?playerId=${team2.player2.id}`)
          .then(res => res.json())
        const team2Player2Score = team2Player2Scores.find((s: any) => {
          const sWeekNum = s.week.isChampionship ? 12 : s.week.weekNumber
          return sWeekNum === weekNumber && s.week.isChampionship === isChampionship
        })

        setTeam1Scores({
          player1: team1Player1Score || null,
          player2: team1Player2Score || null
        })

        setTeam2Scores({
          player1: team2Player1Score || null,
          player2: team2Player2Score || null
        })

        // Calculate hole winners - handle cases where players only have total scores
        const getHoleScore = (score: any, hole: number): number | null => {
          if (!score) return null
          const holeValue = score[`hole${hole}` as keyof typeof score]
          return holeValue !== null && holeValue !== undefined && holeValue > 0 ? holeValue : null
        }

        const getTeamLowForHole = (player1Score: any, player2Score: any, hole: number): number | null => {
          const p1Score = getHoleScore(player1Score, hole)
          const p2Score = getHoleScore(player2Score, hole)
          
          if (p1Score === null && p2Score === null) return null
          if (p1Score === null) return p2Score
          if (p2Score === null) return p1Score
          return Math.min(p1Score, p2Score)
        }

        const winners: Array<'team1' | 'team2' | 'tie'> = []
        for (let hole = 1; hole <= 18; hole++) {
          const team1Low = getTeamLowForHole(team1Player1Score, team1Player2Score, hole)
          const team2Low = getTeamLowForHole(team2Player1Score, team2Player2Score, hole)

          if (team1Low === null || team2Low === null) {
            winners.push('tie') // No winner if either team has no score for this hole
          } else if (team1Low < team2Low) {
            winners.push('team1')
          } else if (team2Low < team1Low) {
            winners.push('team2')
          } else {
            winners.push('tie')
          }
        }
        setHoleWinners(winners)
      })
      .catch(err => console.error('Error loading match data:', err))
  }

  const getHoleScore = (score: Score | null, hole: number): number | null => {
    if (!score) return null
    return score[`hole${hole}` as keyof Score] as number | null
  }

  const getTeamLowForHole = (teamScores: { player1: Score | null; player2: Score | null }, hole: number): number | null => {
    const player1Score = getHoleScore(teamScores.player1, hole)
    const player2Score = getHoleScore(teamScores.player2, hole)
    
    if (player1Score === null && player2Score === null) return null
    if (player1Score === null) return player2Score
    if (player2Score === null) return player1Score
    return Math.min(player1Score, player2Score)
  }

  if (!match) return <div>Loading...</div>

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back
        </button>
        
        <h1 className="text-3xl font-bold mb-8 text-black">
          Match Details - {match.week.isChampionship ? 'Championship' : `Week ${match.week.weekNumber}`}
        </h1>

        {!match.team2Id ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <p className="text-gray-600">No opponent assigned for this match.</p>
          </div>
        ) : (
          <>
            {/* Match Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Team {match.team1.teamNumber}
                    {match.winnerId === match.team1Id && match.team2 && (
                      <span className="ml-2 text-green-600 font-bold">W</span>
                    )}
                    {match.winnerId !== null && match.winnerId !== match.team1Id && match.team2 && (
                      <span className="ml-2 text-red-600 font-bold">L</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {match.team1.player1.firstName} {match.team1.player1.lastName} & {match.team1.player2.firstName} {match.team1.player2.lastName}
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {match.team1Points !== null && match.team1Points !== undefined ? match.team1Points : '-'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Match Points</p>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-gray-400">vs</span>
                </div>
                <div>
                  {match.team2 ? (
                    <>
                      <h3 className="font-semibold text-lg mb-2">
                        Team {match.team2.teamNumber}
                        {match.winnerId === match.team2.id && (
                          <span className="ml-2 text-green-600 font-bold">W</span>
                        )}
                        {match.winnerId !== null && match.winnerId !== match.team2.id && (
                          <span className="ml-2 text-red-600 font-bold">L</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {match.team2.player1.firstName} {match.team2.player1.lastName} & {match.team2.player2.firstName} {match.team2.player2.lastName}
                      </p>
                      <p className="text-2xl font-bold mt-2">
                        {match.team2Points !== null && match.team2Points !== undefined ? match.team2Points : '-'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Match Points</p>
                    </>
                  ) : (
                    <p className="text-gray-400">TBD</p>
                  )}
                </div>
              </div>
              {match.winnerId && match.team2 && (
                <div className="mt-4 text-center">
                  <p className="text-lg font-semibold">
                    Winner: Team {match.winnerId === match.team1Id ? match.team1.teamNumber : match.team2.teamNumber}
                  </p>
                </div>
              )}
            </div>

            {/* Hole-by-Hole Scores */}
            {match.team2 && (
              <div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">Hole-by-Hole Scores</h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-2">Hole</th>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 bg-blue-50">
                        Team {match.team1.teamNumber}
                      </th>
                      <th className="border border-gray-300 px-2 py-2">Team Low</th>
                      <th className="border border-gray-300 px-2 py-2">Team Low</th>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 bg-green-50">
                        Team {match.team2.teamNumber}
                      </th>
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-2 py-1"></th>
                      <th className="border border-gray-300 px-2 py-1 text-sm">
                        {match.team1.player1.firstName}
                      </th>
                      <th className="border border-gray-300 px-2 py-1 text-sm">
                        {match.team1.player2.firstName}
                      </th>
                      <th className="border border-gray-300 px-2 py-1"></th>
                      <th className="border border-gray-300 px-2 py-1"></th>
                      <th className="border border-gray-300 px-2 py-1 text-sm">
                        {match.team2.player1.firstName}
                      </th>
                      <th className="border border-gray-300 px-2 py-1 text-sm">
                        {match.team2.player2.firstName}
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {Array.from({ length: 18 }, (_, i) => {
                    const hole = i + 1
                    const team1Low = getTeamLowForHole(team1Scores, hole)
                    const team2Low = getTeamLowForHole(team2Scores, hole)
                    const winner = holeWinners[hole - 1]
                    const team1Won = winner === 'team1'
                    const team2Won = winner === 'team2'

                    return (
                      <tr key={hole}>
                        <td className="border border-gray-300 px-2 py-2 text-center font-semibold">
                          {hole}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center ${team1Won ? 'bg-blue-200' : ''}`}>
                          {getHoleScore(team1Scores.player1, hole) || '-'}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center ${team1Won ? 'bg-blue-200' : ''}`}>
                          {getHoleScore(team1Scores.player2, hole) || '-'}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center font-semibold ${team1Won ? 'bg-blue-200' : ''}`}>
                          {team1Low !== null ? team1Low : '-'}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center font-semibold ${team2Won ? 'bg-green-200' : ''}`}>
                          {team2Low !== null ? team2Low : '-'}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center ${team2Won ? 'bg-green-200' : ''}`}>
                          {getHoleScore(team2Scores.player1, hole) || '-'}
                        </td>
                        <td className={`border border-gray-300 px-2 py-2 text-center ${team2Won ? 'bg-green-200' : ''}`}>
                          {getHoleScore(team2Scores.player2, hole) || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

