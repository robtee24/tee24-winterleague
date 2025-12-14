import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function fetchLeaguesWithRetry(retries = 3): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      let leagues = await prisma.league.findMany({
        orderBy: { name: 'asc' }
      })
      
      // If no leagues exist, create them automatically
      if (leagues.length === 0) {
        console.log('No leagues found, creating Louisville and Clarksville...')
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
        console.log('Leagues created successfully')
      }
      
      return leagues
    } catch (error: any) {
      console.error(`Attempt ${i + 1} failed:`, error?.message)
      if (i === retries - 1) throw error
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)))
    }
  }
  return []
}

export async function GET() {
  try {
    console.log('=== /api/leagues GET request ===')
    
    const leagues = await fetchLeaguesWithRetry()
    console.log(`Returning ${leagues.length} leagues`)
    
    return NextResponse.json(leagues)
  } catch (error: any) {
    console.error('=== ERROR in GET /api/leagues ===')
    console.error('Error message:', error?.message)
    console.error('Error code:', error?.code)
    
    // Always return an error response, don't return empty array
    return NextResponse.json(
      { 
        error: 'Failed to fetch leagues',
        message: error?.message || 'Database connection error',
        retry: true
      },
      { status: 500 }
    )
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



