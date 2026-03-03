import { NextResponse } from 'next/server'
import {
  ensureIsDefaultColumn,
  backfillDefaultScores,
  calculateRawHandicapsForLeague,
  calculateAllProgressiveForLeague,
  ensureAllWeightedScores,
  recalculateDefaultScores
} from '@/lib/handicap-calculator'

export const maxDuration = 60

const STEPS: Record<string, { label: string; fn: (lid: number) => Promise<void> }> = {
  '1': {
    label: 'Verifying database schema',
    fn: async (lid) => {
      await ensureIsDefaultColumn()
      await backfillDefaultScores(lid)
    }
  },
  '2': {
    label: 'Calculating raw handicaps',
    fn: async (lid) => { await calculateRawHandicapsForLeague(lid) }
  },
  '3': {
    label: 'Calculating progressive handicaps',
    fn: async (lid) => { await calculateAllProgressiveForLeague(lid) }
  },
  '4': {
    label: 'Updating weighted scores',
    fn: async (lid) => { await ensureAllWeightedScores(lid) }
  },
  '5': {
    label: 'Updating default score totals',
    fn: async (lid) => { await recalculateDefaultScores(lid) }
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')
    const step = searchParams.get('step')

    if (!leagueId) {
      return NextResponse.json({ error: 'League ID required' }, { status: 400 })
    }

    const lid = parseInt(leagueId)

    if (step && STEPS[step]) {
      const s = STEPS[step]
      console.log(`[recalculate] Step ${step}: ${s.label} for league ${lid}`)
      await s.fn(lid)
      return NextResponse.json({
        step: parseInt(step),
        totalSteps: Object.keys(STEPS).length,
        label: s.label,
        done: step === '5'
      })
    }

    // Legacy: no step param — run all steps in sequence
    await ensureIsDefaultColumn()
    await backfillDefaultScores(lid)
    await calculateRawHandicapsForLeague(lid)
    await calculateAllProgressiveForLeague(lid)
    await ensureAllWeightedScores(lid)
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
