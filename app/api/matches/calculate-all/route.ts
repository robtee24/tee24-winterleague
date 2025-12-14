import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Check if a score has hole-by-hole data
 */
function hasHoleScores(score: any): boolean {
  if (!score) return false
  // Check if at least one hole has a value
  for (let i = 1; i <= 18; i++) {
    const holeKey = `hole${i}` as keyof typeof score
    if (score[holeKey] !== null && score[holeKey] !== undefined) {
      return true
    }
  }
  return false
}

/**
 * Extract hole scores from a score record
 */
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

/**
 * Get team scores, handling cases where a player only has total score
 * If one player has no hole scores, use the teammate's scores
 */
function getTeamScores(player1Score: any, player2Score: any): number[][] {
  const player1HasHoles = hasHoleScores(player1Score)
  const player2HasHoles = hasHoleScores(player2Score)

  // If both have hole scores, use both
  if (player1HasHoles && player2HasHoles) {
    return [
      extractHoleScores(player1Score),
      extractHoleScores(player2Score)
    ]
  }

  // If only player1 has hole scores, use player1's scores for both
  if (player1HasHoles && !player2HasHoles) {
    const player1Scores = extractHoleScores(player1Score)
    return [player1Scores, player1Scores]
  }

  // If only player2 has hole scores, use player2's scores for both
  if (!player1HasHoles && player2HasHoles) {
    const player2Scores = extractHoleScores(player2Score)
    return [player2Scores, player2Scores]
  }

  // If neither has hole scores, return empty arrays (will be skipped)
  return [[], []]
}

/**
 * Calculate Best Ball Match Play score
 * For each hole, compare lowest score from each team
 * Lower score gets 1 point, ties get 0 points
 */
function calculateMatchPlay(team1Scores: number[][], team2Scores: number[][]): { team1Points: number; team2Points: number } {
  let team1Points = 0
  let team2Points = 0

  for (let hole = 0; hole < 18; hole++) {
    // Get lowest score for each team on this hole
    const team1HoleScores = team1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
    const team2HoleScores = team2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)

    if (team1HoleScores.length === 0 || team2HoleScores.length === 0) {
      continue // Skip holes where no scores are available
    }

    const team1Low = Math.min(...team1HoleScores)
    const team2Low = Math.min(...team2HoleScores)

    if (team1Low < team2Low) {
      team1Points++
    } else if (team2Low < team1Low) {
      team2Points++
    }
    // If tied, no points awarded
  }

  return { team1Points, team2Points }
}

export async function POST(request: Request) {
  try {
    const { leagueId } = await request.json()

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    // Get all matches for this league
    const matches = await prisma.match.findMany({
      where: {
        week: {
          leagueId: parseInt(leagueId)
        }
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
        },
        week: true
      }
    })

    let calculatedCount = 0
    let skippedCount = 0

    for (const match of matches) {
      if (!match.team2Id || !match.team2) {
        skippedCount++
        continue // Skip matches without opponents
      }

      // TypeScript guard: we know team2 exists after the check above
      const team2 = match.team2

      // Get scores for team 1 players
      const team1Player1Score = await prisma.score.findFirst({
        where: {
          playerId: match.team1.player1Id,
          weekId: match.weekId
        },
        orderBy: { id: 'desc' }
      })

      const team1Player2Score = await prisma.score.findFirst({
        where: {
          playerId: match.team1.player2Id,
          weekId: match.weekId
        },
        orderBy: { id: 'desc' }
      })

      // Get scores for team 2 players
      const team2Player1Score = await prisma.score.findFirst({
        where: {
          playerId: team2.player1Id,
          weekId: match.weekId
        },
        orderBy: { id: 'desc' }
      })

      const team2Player2Score = await prisma.score.findFirst({
        where: {
          playerId: team2.player2Id,
          weekId: match.weekId
        },
        orderBy: { id: 'desc' }
      })

      // Check if at least one player from each team has a score
      if (!team1Player1Score && !team1Player2Score) {
        skippedCount++
        continue // Skip if team 1 has no scores
      }

      if (!team2Player1Score && !team2Player2Score) {
        skippedCount++
        continue // Skip if team 2 has no scores
      }

      // Get team scores (handling cases where players only have total scores)
      const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
      const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

      // Check if we have valid scores for both teams
      if (team1Scores.length === 0 || team1Scores[0].length === 0 || team1Scores.every(s => s.every(h => h === 0))) {
        skippedCount++
        continue // Skip if team 1 has no hole-by-hole scores
      }

      if (team2Scores.length === 0 || team2Scores[0].length === 0 || team2Scores.every(s => s.every(h => h === 0))) {
        skippedCount++
        continue // Skip if team 2 has no hole-by-hole scores
      }

      // Calculate match play points
      const { team1Points, team2Points } = calculateMatchPlay(team1Scores, team2Scores)

      // Determine winner
      let winnerId: number | null = null
      if (team1Points > team2Points) {
        winnerId = match.team1Id
      } else if (team2Points > team1Points) {
        winnerId = team2.id
      }

      // Update match
      await prisma.match.update({
        where: { id: match.id },
        data: {
          team1Points,
          team2Points,
          winnerId
        }
      })

      calculatedCount++
    }

    return NextResponse.json({
      message: `Calculated ${calculatedCount} matches, skipped ${skippedCount} matches`,
      calculatedCount,
      skippedCount
    })
  } catch (error: any) {
    console.error('Error calculating all matches:', error)
    const errorMessage = error?.message || 'Failed to calculate matches'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
