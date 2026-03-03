import { NextResponse } from 'next/server'
import { recalculateAllHandicaps, recalculateDefaultScores } from '@/lib/handicap-calculator'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const lid = parseInt(leagueId)
    await recalculateAllHandicaps(lid)

    // Recalculate default score totals now that handicaps are updated
    try {
      await recalculateDefaultScores(lid)
    } catch (defaultErr: any) {
      console.warn('Could not recalculate default scores (column may not exist yet):', defaultErr?.message)
    }

    return NextResponse.json({ 
      message: 'Handicaps and default scores recalculated successfully',
      leagueId: lid
    })
  } catch (error: any) {
    console.error('Error recalculating handicaps:', error)
    const errorMessage = error?.message || 'Failed to recalculate handicaps'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}




