import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlayerRawHandicaps, calculateAverage } from '@/lib/handicap-calculator'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    
    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const leagueIdNum = parseInt(leagueId, 10)
    if (isNaN(leagueIdNum)) {
      return NextResponse.json({ error: 'Invalid leagueId' }, { status: 400 })
    }

    // Get all players in the league
    const players = await prisma.player.findMany({
      where: { leagueId: leagueIdNum }
    })

    // Get Week 4 and Week 5
    const [week4, week5] = await Promise.all([
      prisma.week.findFirst({
        where: {
          leagueId: leagueIdNum,
          weekNumber: 4,
          isChampionship: false
        }
      }),
      prisma.week.findFirst({
        where: {
          leagueId: leagueIdNum,
          weekNumber: 5,
          isChampionship: false
        }
      })
    ])

    if (!week4) {
      return NextResponse.json({ error: 'Week 4 not found' }, { status: 404 })
    }

    if (!week5) {
      return NextResponse.json({ error: 'Week 5 not found' }, { status: 404 })
    }

    // Check if Week 4 is complete (all players have scores)
    const week4Scores = await prisma.score.findMany({
      where: {
        weekId: week4.id,
        total: { not: null }
      },
      include: { player: true }
    })

    const uniquePlayersWeek4 = new Set(week4Scores.map(s => s.playerId))
    const week4Complete = uniquePlayersWeek4.size === players.length && players.length > 0

    // Get all handicap records for weeks 1-5
    const allHandicaps = await prisma.handicap.findMany({
      where: {
        player: { leagueId: leagueIdNum },
        week: {
          leagueId: leagueIdNum,
          weekNumber: { lte: 5 },
          isChampionship: false
        }
      },
      include: {
        player: true,
        week: true
      },
      orderBy: [
        { player: { id: 'asc' } },
        { week: { weekNumber: 'asc' } }
      ]
    })

    // Build diagnostic data for each player
    const playerDiagnostics = []

    for (const player of players) {
      // Get raw handicaps for weeks 1-4
      const rawHandicapsForWeek5 = await getPlayerRawHandicaps(player.id, leagueIdNum, 4)

      // Get Week 5 handicap record
      const week5Handicap = allHandicaps.find(
        h => h.playerId === player.id && h.weekId === week5.id
      )

      // Get all handicaps for this player (weeks 1-5)
      const playerHandicaps = allHandicaps.filter(h => h.playerId === player.id)

      // Calculate what Week 5 handicap should be
      let expectedWeek5Handicap = null
      let calculationStatus = 'missing_data'
      
      if (rawHandicapsForWeek5.length >= 4) {
        expectedWeek5Handicap = calculateAverage(rawHandicapsForWeek5)
        calculationStatus = 'can_calculate'
      } else if (rawHandicapsForWeek5.length > 0) {
        calculationStatus = `insufficient_raw_handicaps (${rawHandicapsForWeek5.length}/4)`
      } else {
        calculationStatus = 'no_raw_handicaps'
      }

      // Get Week 4 scores for this player
      const playerWeek4Scores = week4Scores.filter(s => s.playerId === player.id)
      const hasWeek4Score = playerWeek4Scores.length > 0

      playerDiagnostics.push({
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        hasWeek4Score,
        week4Complete,
        rawHandicapsWeeks1to4: rawHandicapsForWeek5,
        rawHandicapsCount: rawHandicapsForWeek5.length,
        expectedWeek5Handicap,
        calculationStatus,
        week5HandicapRecord: week5Handicap ? {
          id: week5Handicap.id,
          appliedHandicap: week5Handicap.appliedHandicap,
          handicap: week5Handicap.handicap,
          rawHandicap: week5Handicap.rawHandicap
        } : null,
        allHandicaps: playerHandicaps.map(h => ({
          weekNumber: h.week.weekNumber,
          rawHandicap: h.rawHandicap,
          appliedHandicap: h.appliedHandicap,
          handicap: h.handicap
        }))
      })
    }

    return NextResponse.json({
      leagueId: leagueIdNum,
      week4: {
        id: week4.id,
        weekNumber: week4.weekNumber,
        isComplete: week4Complete,
        playersWithScores: uniquePlayersWeek4.size,
        totalPlayers: players.length
      },
      week5: {
        id: week5.id,
        weekNumber: week5.weekNumber,
        exists: true
      },
      summary: {
        totalPlayers: players.length,
        playersWithWeek4Score: week4Scores.length,
        playersWithExpectedWeek5: playerDiagnostics.filter(p => p.expectedWeek5Handicap !== null).length,
        playersWithWeek5Handicap: playerDiagnostics.filter(p => p.week5HandicapRecord !== null).length,
        playersWithCorrectWeek5: playerDiagnostics.filter(p => 
          p.week5HandicapRecord && 
          p.expectedWeek5Handicap !== null && 
          p.week5HandicapRecord.appliedHandicap === p.expectedWeek5Handicap
        ).length
      },
      players: playerDiagnostics
    })
  } catch (error: any) {
    console.error('[DEBUG Week5 Handicaps] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch diagnostic data',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

