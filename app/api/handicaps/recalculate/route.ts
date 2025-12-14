import { NextResponse } from 'next/server'
import { recalculateAllHandicaps } from '@/lib/handicap-calculator'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    await recalculateAllHandicaps(parseInt(leagueId))

    return NextResponse.json({ 
      message: 'Handicaps recalculated successfully',
      leagueId: parseInt(leagueId)
    })
  } catch (error: any) {
    console.error('Error recalculating handicaps:', error)
    const errorMessage = error?.message || 'Failed to recalculate handicaps'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



