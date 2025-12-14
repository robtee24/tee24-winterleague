import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const weekId = searchParams.get('weekId')
    const teamId = searchParams.get('teamId')

    const where: any = {}
    if (weekId) where.weekId = parseInt(weekId)
    if (teamId) {
      where.OR = [
        { team1Id: parseInt(teamId) },
        { team2Id: parseInt(teamId) }
      ]
    }
    if (leagueId) {
      where.week = { leagueId: parseInt(leagueId) }
    }

    const matches = await prisma.match.findMany({
      where,
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
      },
      orderBy: [
        { week: { weekNumber: 'asc' } },
        { team1: { teamNumber: 'asc' } }
      ]
    })

    return NextResponse.json(matches)
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { weekId, team1Id, team2Id, isManual } = await request.json()

    if (!weekId || !team1Id) {
      return NextResponse.json({ error: 'weekId and team1Id are required' }, { status: 400 })
    }

    // Check if match already exists
    if (team2Id) {
      const existingMatch = await prisma.match.findFirst({
        where: {
          weekId: parseInt(weekId),
          OR: [
            { team1Id: parseInt(team1Id), team2Id: parseInt(team2Id) },
            { team1Id: parseInt(team2Id), team2Id: parseInt(team1Id) }
          ]
        }
      })

      if (existingMatch) {
        return NextResponse.json({ error: 'This match already exists' }, { status: 409 })
      }
    }

    const match = await prisma.match.create({
      data: {
        weekId: parseInt(weekId),
        team1Id: parseInt(team1Id),
        team2Id: team2Id ? parseInt(team2Id) : null,
        isManual: isManual || false
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

    return NextResponse.json(match)
  } catch (error: any) {
    console.error('Error creating match:', error)
    const errorMessage = error?.message || 'Failed to create match'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { leagueId, weekIds } = await request.json()

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    // If weekIds are provided, delete matches for those weeks only
    // Otherwise, delete all matches for weeks 1-12
    let whereClause: any = {
      week: {
        leagueId: parseInt(leagueId),
        weekNumber: { lte: 12 },
        isChampionship: false
      }
    }

    if (weekIds && Array.isArray(weekIds) && weekIds.length > 0) {
      whereClause = {
        weekId: { in: weekIds.map((id: number) => parseInt(id.toString())) }
      }
    }

    const result = await prisma.match.deleteMany({
      where: whereClause
    })

    return NextResponse.json({
      message: `Deleted ${result.count} matches`,
      deletedCount: result.count
    })
  } catch (error: any) {
    console.error('Error deleting matches:', error)
    const errorMessage = error?.message || 'Failed to delete matches'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


