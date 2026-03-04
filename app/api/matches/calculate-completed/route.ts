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

        function getTeamScores(p1Score: any, p2Score: any): number[][] {
          const p1Def = !p1Score || p1Score.isDefault
          const p2Def = !p2Score || p2Score.isDefault
          const p1Has = !p1Def && hasHoleScores(p1Score)
          const p2Has = !p2Def && hasHoleScores(p2Score)
          if (p1Has && p2Has) return [extractHoleScores(p1Score), extractHoleScores(p2Score)]
          if (p1Has) return [extractHoleScores(p1Score)]
          if (p2Has) return [extractHoleScores(p2Score)]
          return [[], []]
        }

        function isTeamForfeit(p1Score: any, p2Score: any): boolean {
          const p1Def = !p1Score || p1Score.isDefault || !hasHoleScores(p1Score)
          const p2Def = !p2Score || p2Score.isDefault || !hasHoleScores(p2Score)
          return p1Def && p2Def
        }

        function calculateMatchPlay(t1Scores: number[][], t2Scores: number[][]): { team1Points: number; team2Points: number } {
          let team1Points = 0
          let team2Points = 0
          for (let hole = 0; hole < 18; hole++) {
            const t1Hole = t1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
            const t2Hole = t2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
            if (t1Hole.length === 0 || t2Hole.length === 0) continue
            const t1Low = Math.min(...t1Hole)
            const t2Low = Math.min(...t2Hole)
            if (t1Low < t2Low) team1Points++
            else if (t2Low < t1Low) team2Points++
          }
          return { team1Points, team2Points }
        }

        const team1Forfeits = isTeamForfeit(team1Player1Score, team1Player2Score)
        const team2Forfeits = isTeamForfeit(team2Player1Score, team2Player2Score)

        let team1Points: number
        let team2Points: number
        let winnerId: number | null = null

        if (team1Forfeits && team2Forfeits) {
          team1Points = 0
          team2Points = 0
        } else if (team1Forfeits) {
          team1Points = 0
          team2Points = 18
          winnerId = team2.id
        } else if (team2Forfeits) {
          team1Points = 18
          team2Points = 0
          winnerId = match.team1Id
        } else {
          const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
          const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

          if (team1Scores.length === 0 || team1Scores[0].length === 0) {
            weekSkipped++
            continue
          }
          if (team2Scores.length === 0 || team2Scores[0].length === 0) {
            weekSkipped++
            continue
          }

          const result = calculateMatchPlay(team1Scores, team2Scores)
          team1Points = result.team1Points
          team2Points = result.team2Points
          if (team1Points > team2Points) winnerId = match.team1Id
          else if (team2Points > team1Points) winnerId = team2.id
        }

        await prisma.match.update({
          where: { id: match.id },
          data: { team1Points, team2Points, winnerId }
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

