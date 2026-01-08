import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    
    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    // Try to fetch with winningsEligible field
    try {
      const players = await prisma.player.findMany({
        where: { leagueId: parseInt(leagueId) },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
      })
      
      // Ensure all players have winningsEligible field (defaults to true if missing)
      const playersWithDefaults = players.map(player => ({
        ...player,
        winningsEligible: player.winningsEligible ?? true
      }))
      
      return NextResponse.json(playersWithDefaults)
    } catch (schemaError: any) {
      // If column doesn't exist, try using select to exclude it
      if (schemaError?.code === 'P2021' || schemaError?.message?.includes('column') || schemaError?.message?.includes('Unknown column')) {
        console.log('[Players API] winningsEligible column may not exist, using fallback query...')
        const players = await prisma.$queryRawUnsafe(`
          SELECT id, "firstName", "lastName", phone, email, "leagueId", "createdAt", "updatedAt"
          FROM "Player"
          WHERE "leagueId" = $1
          ORDER BY "firstName" ASC, "lastName" ASC
        `, parseInt(leagueId)) as Array<{
          id: number
          firstName: string
          lastName: string | null
          phone: string | null
          email: string | null
          leagueId: number
          createdAt: Date
          updatedAt: Date
        }>
        
        const playersWithDefaults = players.map(player => ({
          ...player,
          winningsEligible: true // Default to true if column doesn't exist
        }))
        
        return NextResponse.json(playersWithDefaults)
      }
      throw schemaError // Re-throw if it's not a column error
    }
  } catch (error: any) {
    console.error('[Players API] Error fetching players:', error)
    console.error('[Players API] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    const errorMessage = error?.message || 'Failed to fetch players'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { firstName, lastName, phone, email, leagueId } = await request.json()
    
    if (!firstName || !leagueId) {
      return NextResponse.json({ error: 'First name and league ID are required' }, { status: 400 })
    }

    const player = await prisma.player.create({
      data: { 
        firstName: firstName.trim(), 
        lastName: lastName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        leagueId: parseInt(leagueId) 
      }
    })
    return NextResponse.json(player)
  } catch (error: any) {
    console.error('Error creating player:', error)
    // Return more detailed error message
    const errorMessage = error?.message || 'Failed to create player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

