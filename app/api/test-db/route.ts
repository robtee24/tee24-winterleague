import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const leagues = await prisma.league.findMany({
      orderBy: { name: 'asc' }
    })
    
    const weeks = await prisma.week.findMany({
      include: { league: true }
    })
    
    const courses = await prisma.course.findMany({
      include: { league: true }
    })
    
    return NextResponse.json({
      success: true,
      database: 'connected',
      leagues: {
        count: leagues.length,
        data: leagues.map(l => ({ id: l.id, name: l.name }))
      },
      weeks: {
        count: weeks.length,
        byLeague: {
          louisville: weeks.filter(w => w.league.name === 'Louisville').length,
          clarksville: weeks.filter(w => w.league.name === 'Clarksville').length
        }
      },
      courses: {
        count: courses.length,
        byLeague: {
          louisville: courses.filter(c => c.league.name === 'Louisville').length,
          clarksville: courses.filter(c => c.league.name === 'Clarksville').length
        }
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

