import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Ensure prisma is initialized
if (!prisma) {
  console.error('Prisma client is not initialized')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const playerId = searchParams.get('playerId')

    const where: any = {}
    if (leagueId) where.leagueId = parseInt(leagueId)
    if (playerId) {
      where.OR = [
        { player1Id: parseInt(playerId) },
        { player2Id: parseInt(playerId) }
      ]
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        player1: true,
        player2: true,
        league: true
      },
      orderBy: [
        { leagueId: 'asc' },
        { teamNumber: 'asc' }
      ]
    })

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Verify prisma is initialized
    if (!prisma || !prisma.team) {
      console.error('Prisma client or team model not available:', { prisma: !!prisma, team: !!prisma?.team })
      return NextResponse.json({ 
        error: 'Database connection error. Please restart the server.' 
      }, { status: 500 })
    }

    const { leagueId, player1Id, player2Id } = await request.json()

    if (!leagueId || !player1Id || !player2Id) {
      return NextResponse.json({ error: 'leagueId, player1Id, and player2Id are required' }, { status: 400 })
    }

    // Check if players are in the same league
    const player1 = await prisma.player.findUnique({
      where: { id: parseInt(player1Id) }
    })
    const player2 = await prisma.player.findUnique({
      where: { id: parseInt(player2Id) }
    })

    if (!player1 || !player2) {
      return NextResponse.json({ error: 'One or both players not found' }, { status: 404 })
    }

    if (player1.leagueId !== parseInt(leagueId) || player2.leagueId !== parseInt(leagueId)) {
      return NextResponse.json({ error: 'Players must be in the same league' }, { status: 400 })
    }

    if (player1Id === player2Id) {
      return NextResponse.json({ error: 'A player cannot be on a team with themselves' }, { status: 400 })
    }

    // Check if team already exists (check both orderings)
    const existingTeam1 = await prisma.team.findFirst({
      where: {
        leagueId: parseInt(leagueId),
        player1Id: parseInt(player1Id),
        player2Id: parseInt(player2Id)
      }
    })

    const existingTeam2 = await prisma.team.findFirst({
      where: {
        leagueId: parseInt(leagueId),
        player1Id: parseInt(player2Id),
        player2Id: parseInt(player1Id)
      }
    })

    if (existingTeam1 || existingTeam2) {
      return NextResponse.json({ error: 'This team already exists' }, { status: 409 })
    }

    // Get the next team number for this league
    const maxTeam = await prisma.team.findFirst({
      where: { leagueId: parseInt(leagueId) },
      orderBy: { teamNumber: 'desc' }
    })
    const nextTeamNumber = maxTeam ? maxTeam.teamNumber + 1 : 1

    const team = await prisma.team.create({
      data: {
        leagueId: parseInt(leagueId),
        teamNumber: nextTeamNumber,
        player1Id: parseInt(player1Id),
        player2Id: parseInt(player2Id)
      },
      include: {
        player1: true,
        player2: true
      }
    })

    // Auto-generate schedule if we have 2+ teams and weeks 1-12 exist
    const allTeams = await prisma.team.findMany({
      where: { leagueId: parseInt(leagueId) }
    })

    if (allTeams.length >= 2) {
      // Check if schedule needs to be generated (only for weeks 1-12)
      const weeks = await prisma.week.findMany({
        where: {
          leagueId: parseInt(leagueId),
          weekNumber: { lte: 12 },
          isChampionship: false
        },
        orderBy: { weekNumber: 'asc' }
      })

      if (weeks.length > 0) {
        // Check if matches already exist for these weeks
        const weekIds = weeks.map(w => w.id)
        const existingMatches = await prisma.match.count({
          where: {
            weekId: { in: weekIds }
          }
        })

        // Only generate if no matches exist yet
        if (existingMatches === 0) {
          // Generate schedule using optimized round-robin algorithm
          const teamIds = allTeams.map(t => t.id)
          const numWeeks = weeks.length
          
          // Track pair counts for even distribution
          const pairCounts = new Map<string, number>()
          const allPairs: Array<[number, number]> = []
          for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
              allPairs.push([teamIds[i], teamIds[j]])
              const pairKey = `${Math.min(teamIds[i], teamIds[j])}-${Math.max(teamIds[i], teamIds[j])}`
              pairCounts.set(pairKey, 0)
            }
          }
          
          const totalMatches = numWeeks * Math.floor(teamIds.length / 2)
          const idealMatchesPerPair = totalMatches / allPairs.length
          const maxMatchesPerPair = Math.ceil(idealMatchesPerPair)
          
          const weeklySchedule: Array<Array<[number, number]>> = []
          
          for (let week = 0; week < numWeeks; week++) {
            const weekMatches: Array<[number, number]> = []
            const usedThisWeek = new Set<number>()
            
            // Sort pairs by count to prioritize pairs that need more matches
            const availablePairs = allPairs
              .filter(([t1, t2]) => !usedThisWeek.has(t1) && !usedThisWeek.has(t2))
              .map(pair => {
                const [t1, t2] = pair
                const pairKey = `${Math.min(t1, t2)}-${Math.max(t1, t2)}`
                const count = pairCounts.get(pairKey) || 0
                return { pair, count, key: pairKey }
              })
              .sort((a, b) => {
                if (a.count !== b.count) return a.count - b.count
                return Math.random() - 0.5
              })
            
            for (const { pair, key } of availablePairs) {
              const [team1, team2] = pair
              const currentCount = pairCounts.get(key) || 0
              
              if (!usedThisWeek.has(team1) && !usedThisWeek.has(team2) && currentCount < maxMatchesPerPair) {
                weekMatches.push([team1, team2])
                usedThisWeek.add(team1)
                usedThisWeek.add(team2)
                pairCounts.set(key, currentCount + 1)
                
                if (weekMatches.length >= Math.floor(teamIds.length / 2)) {
                  break
                }
              }
            }
            
            weeklySchedule.push(weekMatches)
          }

          // Batch create all matches for better performance
          const matchesToCreate = weeklySchedule.flatMap((weekMatches, weekIndex) => {
            if (weekIndex >= weeks.length) return []
            return weekMatches.map(([team1Id, team2Id]) => ({
              weekId: weeks[weekIndex].id,
              team1Id,
              team2Id,
              isManual: false
            }))
          })
          
          if (matchesToCreate.length > 0) {
            // Create matches in background (don't block response)
            prisma.match.createMany({
              data: matchesToCreate,
              skipDuplicates: true
            }).catch(err => {
              console.error('Error generating schedule:', err)
            })
          }
        }
      }
    }

    return NextResponse.json(team)
  } catch (error: any) {
    console.error('Error creating team:', error)
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    const errorMessage = error?.message || 'Failed to create team'
    return NextResponse.json({ 
      error: errorMessage,
      details: error?.code || error?.meta || 'Unknown error'
    }, { status: 500 })
  }
}

