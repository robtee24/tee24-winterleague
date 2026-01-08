import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Check if a score has hole-by-hole data
 */
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
 */
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

/**
 * Calculate Best Ball Match Play score
 */
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const match = await prisma.match.findUnique({
      where: { id },
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
        week: {
          include: {
            league: true
          }
        }
      }
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    if (!match.team2Id || !match.team2) {
      return NextResponse.json({ error: 'Match has no opponent' }, { status: 400 })
    }

    const team2 = match.team2
    const week = match.week

    // Get scores for all players - try weekId first, then weekNumber
    let team1Player1Score = await prisma.score.findFirst({
      where: {
        playerId: match.team1.player1Id,
        weekId: week.id
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })

    if (!team1Player1Score) {
      team1Player1Score = await prisma.score.findFirst({
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
    }

    let team1Player2Score = await prisma.score.findFirst({
      where: {
        playerId: match.team1.player2Id,
        weekId: week.id
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })

    if (!team1Player2Score) {
      team1Player2Score = await prisma.score.findFirst({
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
    }

    let team2Player1Score = await prisma.score.findFirst({
      where: {
        playerId: team2.player1Id,
        weekId: week.id
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })

    if (!team2Player1Score) {
      team2Player1Score = await prisma.score.findFirst({
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
    }

    let team2Player2Score = await prisma.score.findFirst({
      where: {
        playerId: team2.player2Id,
        weekId: week.id
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })

    if (!team2Player2Score) {
      team2Player2Score = await prisma.score.findFirst({
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
    }

    // Check if at least one player from each team has a score
    if (!team1Player1Score && !team1Player2Score) {
      return NextResponse.json({ error: 'Team 1 has no scores' }, { status: 400 })
    }

    if (!team2Player1Score && !team2Player2Score) {
      return NextResponse.json({ error: 'Team 2 has no scores' }, { status: 400 })
    }

    // Get team scores
    const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
    const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

    if (team1Scores.length === 0 || team1Scores[0].length === 0 || team1Scores.every(s => s.every(h => h === 0))) {
      return NextResponse.json({ error: 'Team 1 has no valid hole-by-hole scores' }, { status: 400 })
    }

    if (team2Scores.length === 0 || team2Scores[0].length === 0 || team2Scores.every(s => s.every(h => h === 0))) {
      return NextResponse.json({ error: 'Team 2 has no valid hole-by-hole scores' }, { status: 400 })
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
    const updatedMatch = await prisma.match.update({
      where: { id: match.id },
      data: {
        team1Points,
        team2Points,
        winnerId
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

    return NextResponse.json({
      message: 'Match recalculated successfully',
      match: updatedMatch,
      points: { team1Points, team2Points, winnerId }
    })
  } catch (error: any) {
    console.error('Error recalculating match:', error)
    const errorMessage = error?.message || 'Failed to recalculate match'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



