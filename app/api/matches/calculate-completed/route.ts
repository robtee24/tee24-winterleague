import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Calculate all matches for completed rounds in a league
 * A round is considered completed if at least one player has submitted a score
 */
export async function POST(request: Request) {
  try {
    const { leagueId } = await request.json()

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    // Get all weeks for this league, grouped by weekNumber and isChampionship
    const weeks = await prisma.week.findMany({
      where: {
        leagueId: parseInt(leagueId)
      },
      include: {
        scores: {
          select: {
            id: true
          }
        },
        league: true
      },
      orderBy: {
        weekNumber: 'asc'
      }
    })

    // Group weeks by weekNumber and isChampionship to handle duplicates
    // Use the week with the most scores as the "primary" week for score lookup
    const weekGroups = new Map<string, typeof weeks>()
    for (const week of weeks) {
      const key = `${week.weekNumber}-${week.isChampionship}`
      if (!weekGroups.has(key)) {
        weekGroups.set(key, [])
      }
      weekGroups.get(key)!.push(week)
    }

    // Filter to only week groups that have at least one score (completed rounds)
    const completedWeekGroups = Array.from(weekGroups.entries())
      .filter(([_, weekList]) => weekList.some(w => w.scores.length > 0))
      .map(([_, weekList]) => {
        // Use the week with the most scores as the primary week for score lookup
        return weekList.reduce((prev, curr) => 
          curr.scores.length > prev.scores.length ? curr : prev
        )
      })

    let totalCalculated = 0
    let totalSkipped = 0
    const results: Array<{ weekNumber: number; calculated: number; skipped: number }> = []

    // Process all matches for each week group (handles duplicate week records)
    for (const week of completedWeekGroups) {
      // Get ALL matches for this weekNumber/isChampionship combination, not just one weekId
      const allWeekIds = weekGroups.get(`${week.weekNumber}-${week.isChampionship}`)!.map(w => w.id)
      const matches = await prisma.match.findMany({
        where: { 
          weekId: { in: allWeekIds }
        },
        include: {
          team1: {
            include: {
              player1: true,
              player2: true
            }
          },
          team2: {
            include: {
              player1: true,
              player2: true
            }
          }
        }
      })

      let weekCalculated = 0
      let weekSkipped = 0

      for (const match of matches) {
        if (!match.team2Id || !match.team2) {
          weekSkipped++
          continue
        }

        const team2 = match.team2

        // Get scores for all players - use weekNumber to handle duplicate weeks
        const team1Player1Score = await prisma.score.findFirst({
          where: {
            playerId: match.team1.player1Id,
            week: {
              leagueId: week.leagueId,
              weekNumber: week.weekNumber,
              isChampionship: week.isChampionship
            }
          },
          include: {
            week: true
          },
          orderBy: { id: 'desc' }
        })

        const team1Player2Score = await prisma.score.findFirst({
          where: {
            playerId: match.team1.player2Id,
            week: {
              leagueId: week.leagueId,
              weekNumber: week.weekNumber,
              isChampionship: week.isChampionship
            }
          },
          include: {
            week: true
          },
          orderBy: { id: 'desc' }
        })

        const team2Player1Score = await prisma.score.findFirst({
          where: {
            playerId: team2.player1Id,
            week: {
              leagueId: week.leagueId,
              weekNumber: week.weekNumber,
              isChampionship: week.isChampionship
            }
          },
          include: {
            week: true
          },
          orderBy: { id: 'desc' }
        })

        const team2Player2Score = await prisma.score.findFirst({
          where: {
            playerId: team2.player2Id,
            week: {
              leagueId: week.leagueId,
              weekNumber: week.weekNumber,
              isChampionship: week.isChampionship
            }
          },
          include: {
            week: true
          },
          orderBy: { id: 'desc' }
        })

        // Check if at least one player from each team has a score
        if (!team1Player1Score && !team1Player2Score) {
          weekSkipped++
          continue
        }

        if (!team2Player1Score && !team2Player2Score) {
          weekSkipped++
          continue
        }

        // Check if scores have hole-by-hole data
        function hasHoleScores(score: any): boolean {
          if (!score) return false
          for (let i = 1; i <= 18; i++) {
            const holeKey = `hole${i}` as keyof typeof score
            if (score[holeKey] !== null && score[holeKey] !== undefined) {
              return true
            }
          }
          return false
        }

        function extractHoleScores(score: any): number[] {
          return [
            score.hole1 ?? 0, score.hole2 ?? 0, score.hole3 ?? 0,
            score.hole4 ?? 0, score.hole5 ?? 0, score.hole6 ?? 0,
            score.hole7 ?? 0, score.hole8 ?? 0, score.hole9 ?? 0,
            score.hole10 ?? 0, score.hole11 ?? 0, score.hole12 ?? 0,
            score.hole13 ?? 0, score.hole14 ?? 0, score.hole15 ?? 0,
            score.hole16 ?? 0, score.hole17 ?? 0, score.hole18 ?? 0
          ]
        }

        function getTeamScores(player1Score: any, player2Score: any): number[][] {
          const player1HasHoles = hasHoleScores(player1Score)
          const player2HasHoles = hasHoleScores(player2Score)

          if (player1HasHoles && player2HasHoles) {
            return [
              extractHoleScores(player1Score),
              extractHoleScores(player2Score)
            ]
          }

          if (player1HasHoles && !player2HasHoles) {
            const player1Scores = extractHoleScores(player1Score)
            return [player1Scores, player1Scores]
          }

          if (!player1HasHoles && player2HasHoles) {
            const player2Scores = extractHoleScores(player2Score)
            return [player2Scores, player2Scores]
          }

          return [[], []]
        }

        const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
        const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

        if (team1Scores.length === 0 || team1Scores[0].length === 0 || team1Scores.every(s => s.every(h => h === 0))) {
          weekSkipped++
          continue
        }

        if (team2Scores.length === 0 || team2Scores[0].length === 0 || team2Scores.every(s => s.every(h => h === 0))) {
          weekSkipped++
          continue
        }

        // Calculate match play
        function calculateMatchPlay(team1Scores: number[][], team2Scores: number[][]): { team1Points: number; team2Points: number } {
          let team1Points = 0
          let team2Points = 0

          for (let hole = 0; hole < 18; hole++) {
            const team1HoleScores = team1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
            const team2HoleScores = team2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)

            if (team1HoleScores.length === 0 || team2HoleScores.length === 0) {
              continue
            }

            const team1Low = Math.min(...team1HoleScores)
            const team2Low = Math.min(...team2HoleScores)

            if (team1Low < team2Low) {
              team1Points++
            } else if (team2Low < team1Low) {
              team2Points++
            }
          }

          return { team1Points, team2Points }
        }

        const { team1Points, team2Points } = calculateMatchPlay(team1Scores, team2Scores)

        let winnerId: number | null = null
        if (team1Points > team2Points) {
          winnerId = match.team1Id
        } else if (team2Points > team1Points) {
          winnerId = team2.id
        }

        await prisma.match.update({
          where: { id: match.id },
          data: {
            team1Points,
            team2Points,
            winnerId
          }
        })

        weekCalculated++
      }

      totalCalculated += weekCalculated
      totalSkipped += weekSkipped
      results.push({
        weekNumber: week.isChampionship ? 12 : week.weekNumber,
        calculated: weekCalculated,
        skipped: weekSkipped
      })
    }

    return NextResponse.json({
      message: `Calculated ${totalCalculated} matches across ${completedWeekGroups.length} completed weeks`,
      totalCalculated,
      totalSkipped,
      weeksProcessed: completedWeekGroups.length,
      results
    })
  } catch (error: any) {
    console.error('Error calculating completed matches:', error)
    const errorMessage = error?.message || 'Failed to calculate completed matches'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

