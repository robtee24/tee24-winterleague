import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    // Create leagues using upsert (safe to run multiple times)
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

    return NextResponse.json({ 
      success: true, 
      message: 'Leagues seeded successfully',
      leagues: { louisville, clarksville }
    })
  } catch (error: any) {
    console.error('Error seeding leagues:', error)
    return NextResponse.json({ 
      error: 'Failed to seed leagues',
      details: error.message 
    }, { status: 500 })
  }
}


