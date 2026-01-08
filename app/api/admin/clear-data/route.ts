import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete all scores
    const deletedScores = await prisma.score.deleteMany({})
    console.log(`Deleted ${deletedScores.count} scores`)

    // 2. Delete all handicaps
    const deletedHandicaps = await prisma.handicap.deleteMany({})
    console.log(`Deleted ${deletedHandicaps.count} handicaps`)

    // 3. Delete all matches
    const deletedMatches = await prisma.match.deleteMany({})
    console.log(`Deleted ${deletedMatches.count} matches`)

    // 4. Delete all teams
    const deletedTeams = await prisma.team.deleteMany({})
    console.log(`Deleted ${deletedTeams.count} teams`)

    // 5. Delete all players
    const deletedPlayers = await prisma.player.deleteMany({})
    console.log(`Deleted ${deletedPlayers.count} players`)

    return NextResponse.json({
      success: true,
      message: 'Successfully cleared all players and scores',
      summary: {
        scores: deletedScores.count,
        handicaps: deletedHandicaps.count,
        matches: deletedMatches.count,
        teams: deletedTeams.count,
        players: deletedPlayers.count
      }
    })
  } catch (error: any) {
    console.error('Error clearing data:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to clear data' 
      },
      { status: 500 }
    )
  }
}


