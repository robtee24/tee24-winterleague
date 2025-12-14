import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    
    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const players = await prisma.player.findMany({
      where: { leagueId: parseInt(leagueId) },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    })
    return NextResponse.json(players)
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
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

