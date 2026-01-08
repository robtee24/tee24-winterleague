import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check if DATABASE_URL is set and show first/last chars (for security)
    const dbUrl = process.env.DATABASE_URL
    const dbUrlInfo = dbUrl 
      ? {
          exists: true,
          length: dbUrl.length,
          startsWith: dbUrl.substring(0, 20),
          hasPassword: dbUrl.includes('@'),
          // Show if it has % encoding
          hasEncoding: dbUrl.includes('%')
        }
      : { exists: false }
    
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
      dbUrlInfo,
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
      errorCode: error.code,
      errorName: error.name,
      dbUrlInfo: process.env.DATABASE_URL ? {
        exists: true,
        length: process.env.DATABASE_URL.length,
        startsWith: process.env.DATABASE_URL.substring(0, 20),
        hasPassword: process.env.DATABASE_URL.includes('@'),
        hasEncoding: process.env.DATABASE_URL.includes('%')
      } : { exists: false },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

