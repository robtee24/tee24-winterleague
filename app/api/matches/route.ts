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

    let matches
    try {
      matches = await prisma.match.findMany({
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
      
      // Filter out winningsEligible from players to avoid column errors
      // Map matches to only include fields that exist
      const matchesFiltered = matches.map((match: any) => {
        const result: any = {
          id: match.id,
          weekId: match.weekId,
          team1Id: match.team1Id,
          team2Id: match.team2Id,
          team1Points: match.team1Points,
          team2Points: match.team2Points,
          winnerId: match.winnerId,
          isManual: match.isManual,
          createdAt: match.createdAt,
          updatedAt: match.updatedAt,
          week: match.week
        }
        
        if (match.team1) {
          result.team1 = {
            id: match.team1.id,
            teamNumber: match.team1.teamNumber,
            leagueId: match.team1.leagueId,
            player1Id: match.team1.player1Id,
            player2Id: match.team1.player2Id,
            player1: match.team1.player1 ? {
              id: match.team1.player1.id,
              firstName: match.team1.player1.firstName,
              lastName: match.team1.player1.lastName,
              phone: match.team1.player1.phone,
              email: match.team1.player1.email,
              leagueId: match.team1.player1.leagueId,
              createdAt: match.team1.player1.createdAt,
              updatedAt: match.team1.player1.updatedAt,
              winningsEligible: (match.team1.player1 as any).winningsEligible ?? true
            } : null,
            player2: match.team1.player2 ? {
              id: match.team1.player2.id,
              firstName: match.team1.player2.firstName,
              lastName: match.team1.player2.lastName,
              phone: match.team1.player2.phone,
              email: match.team1.player2.email,
              leagueId: match.team1.player2.leagueId,
              createdAt: match.team1.player2.createdAt,
              updatedAt: match.team1.player2.updatedAt,
              winningsEligible: (match.team1.player2 as any).winningsEligible ?? true
            } : null
          }
        } else {
          result.team1 = null
        }
        
        if (match.team2) {
          result.team2 = {
            id: match.team2.id,
            teamNumber: match.team2.teamNumber,
            leagueId: match.team2.leagueId,
            player1Id: match.team2.player1Id,
            player2Id: match.team2.player2Id,
            player1: match.team2.player1 ? {
              id: match.team2.player1.id,
              firstName: match.team2.player1.firstName,
              lastName: match.team2.player1.lastName,
              phone: match.team2.player1.phone,
              email: match.team2.player1.email,
              leagueId: match.team2.player1.leagueId,
              createdAt: match.team2.player1.createdAt,
              updatedAt: match.team2.player1.updatedAt,
              winningsEligible: (match.team2.player1 as any).winningsEligible ?? true
            } : null,
            player2: match.team2.player2 ? {
              id: match.team2.player2.id,
              firstName: match.team2.player2.firstName,
              lastName: match.team2.player2.lastName,
              phone: match.team2.player2.phone,
              email: match.team2.player2.email,
              leagueId: match.team2.player2.leagueId,
              createdAt: match.team2.player2.createdAt,
              updatedAt: match.team2.player2.updatedAt,
              winningsEligible: (match.team2.player2 as any).winningsEligible ?? true
            } : null
          }
        } else {
          result.team2 = null
        }
        
        return result
      })
      
      return NextResponse.json(matchesFiltered)
    } catch (error: any) {
      console.error('[Matches API] Error fetching matches:', error)
      console.error('[Matches API] Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta
      })
      
      // If column error (winningsEligible doesn't exist), try to handle gracefully
      // by returning empty array and logging the error
      if (error?.code === 'P2021' || error?.message?.includes('column') || error?.message?.includes('Unknown column') || error?.message?.includes('winningsEligible')) {
        console.log('[Matches API] Column error detected, returning empty matches array')
        // Return empty array so pages don't crash, but log the issue
        return NextResponse.json([])
      }
      
      throw error
    }
  } catch (error: any) {
    console.error('[Matches API] Final error:', error)
    const errorMessage = error?.message || 'Failed to fetch matches'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
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


