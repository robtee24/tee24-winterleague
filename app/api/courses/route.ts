import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    
    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const courses = await prisma.course.findMany({
      where: { leagueId: parseInt(leagueId) },
      orderBy: { week: 'asc' }
    })
    return NextResponse.json(courses)
  } catch (error) {
    console.error('Error fetching courses:', error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, week, leagueId } = await request.json()
    
    if (!name || !week || !leagueId) {
      return NextResponse.json({ error: 'Name, week, and leagueId are required' }, { status: 400 })
    }

    const course = await prisma.course.create({
      data: { 
        name: name.trim(), 
        week: parseInt(week), 
        leagueId: parseInt(leagueId) 
      }
    })
    return NextResponse.json(course)
  } catch (error: any) {
    console.error('Error creating course:', error)
    const errorMessage = error?.message || 'Failed to create course'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

