import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const leagues = await prisma.league.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(leagues)
  } catch (error) {
    console.error('Error fetching leagues:', error)
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    const league = await prisma.league.create({
      data: { name }
    })
    return NextResponse.json(league)
  } catch (error) {
    console.error('Error creating league:', error)
    return NextResponse.json({ error: 'Failed to create league' }, { status: 500 })
  }
}



