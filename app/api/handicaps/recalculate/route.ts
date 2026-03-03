import { NextResponse } from 'next/server'
import {
  ensureIsDefaultColumn,
  backfillDefaultScores,
  recalculateAllHandicaps,
  recalculateDefaultScores
} from '@/lib/handicap-calculator'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const lid = parseInt(leagueId)

    // Step 1: Ensure the isDefault column exists (self-healing migration)
    await ensureIsDefaultColumn()

    // Step 2: Backfill old default scores that predate the isDefault column
    await backfillDefaultScores(lid)

    // Step 3: Recalculate all handicaps (now that defaults are properly marked)
    await recalculateAllHandicaps(lid)

    // Step 4: Recalculate default score totals with updated handicaps
    await recalculateDefaultScores(lid)

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




