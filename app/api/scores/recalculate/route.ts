import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const playerId = searchParams.get('playerId')
    const weekId = searchParams.get('weekId')

    // Build where clause
    const where: any = {}
    if (leagueId) {
      where.player = { leagueId: parseInt(leagueId) }
    }
    if (playerId) {
      where.playerId = parseInt(playerId)
    }
    if (weekId) {
      where.weekId = parseInt(weekId)
    }

    // Fetch all scores that match the criteria
    const scores = await prisma.score.findMany({
      where,
      include: {
        player: true,
        week: true
      }
    })

    let updatedCount = 0

    // Recalculate weighted scores for each score
    for (const score of scores) {
      if (!score.total) {
        continue
      }

      // Get week-specific handicap
      const handicapRecord = await prisma.handicap.findUnique({
        where: {
          playerId_weekId: {
            playerId: score.playerId,
            weekId: score.weekId
          }
        }
      })

      const handicap = handicapRecord?.handicap || 0
      const weightedScore = Math.round(score.total - handicap)

      await prisma.score.update({
        where: { id: score.id },
        data: { weightedScore }
      })

      updatedCount++
    }

    return NextResponse.json({ 
      message: `Recalculated weighted scores for ${updatedCount} score(s)`,
      updatedCount 
    })
  } catch (error: any) {
    console.error('Error recalculating weighted scores:', error)
    const errorMessage = error?.message || 'Failed to recalculate weighted scores'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

