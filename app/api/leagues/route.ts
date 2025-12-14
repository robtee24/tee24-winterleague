import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Fetching leagues from database...')
    let leagues = await prisma.league.findMany({
      orderBy: { name: 'asc' }
    })
    
    console.log(`Found ${leagues.length} leagues in database`)
    
    // If no leagues exist, create them automatically
    if (leagues.length === 0) {
      console.log('No leagues found, creating Louisville and Clarksville...')
      try {
        const louisville = await prisma.league.upsert({
          where: { name: 'Louisville' },
          update: {},
          create: {
            name: 'Louisville',
          },
        })

        const clarksville = await prisma.league.upsert({
          where: { name: 'Clarksville' },
          update: {},
          create: {
            name: 'Clarksville',
          },
        })

        leagues = [louisville, clarksville]
        console.log('Leagues created successfully:', leagues.map(l => ({ id: l.id, name: l.name })))
      } catch (createError: any) {
        console.error('Error creating leagues:', createError)
        throw createError
      }
    } else {
      console.log('Leagues found:', leagues.map(l => ({ id: l.id, name: l.name })))
    }
    
    return NextResponse.json(leagues)
  } catch (error: any) {
    console.error('Error in GET /api/leagues:', error)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    // Return empty array instead of error to prevent page crash
    // This allows the page to load even if database isn't configured
    return NextResponse.json([], { status: 200 })
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



