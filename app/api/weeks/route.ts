import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    
    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const weeks = await prisma.week.findMany({
      where: { leagueId: parseInt(leagueId) },
      orderBy: { weekNumber: 'asc' }
    })
    return NextResponse.json(weeks)
  } catch (error) {
    console.error('Error fetching weeks:', error)
    return NextResponse.json({ error: 'Failed to fetch weeks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { weekNumber, leagueId, isChampionship } = await request.json()
    const parsedWeekNumber = parseInt(weekNumber)
    const parsedLeagueId = parseInt(leagueId)
    
    // Check if week already exists for this league and weekNumber
    const existingWeek = await prisma.week.findFirst({
      where: {
        leagueId: parsedLeagueId,
        weekNumber: parsedWeekNumber,
        isChampionship: isChampionship || false
      }
    })
    
    if (existingWeek) {
      console.log(`Week ${parsedWeekNumber} already exists for league ${parsedLeagueId}, returning existing week`)
      return NextResponse.json(existingWeek)
    }
    
    // Create new week only if it doesn't exist
    const week = await prisma.week.create({
      data: { 
        weekNumber: parsedWeekNumber, 
        leagueId: parsedLeagueId,
        isChampionship: isChampionship || false
      }
    })
    return NextResponse.json(week)
  } catch (error) {
    console.error('Error creating week:', error)
    return NextResponse.json({ error: 'Failed to create week' }, { status: 500 })
  }
}

