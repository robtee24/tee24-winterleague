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

async function runStep1(lid: number) {
  const columnExists = await ensureIsDefaultColumn()
  if (columnExists) {
    await backfillDefaultScores(lid)
  }
}

const STEPS: Record<string, { label: string; fn: (lid: number) => Promise<void> }> = {
  '1': { label: 'Verifying database schema', fn: runStep1 },
  '2': { label: 'Calculating raw handicaps', fn: (lid) => calculateRawHandicapsForLeague(lid) },
  '3': { label: 'Calculating progressive handicaps', fn: (lid) => calculateAllProgressiveForLeague(lid) },
  '4': { label: 'Updating weighted scores', fn: (lid) => ensureAllWeightedScores(lid) },
  '5': { label: 'Updating default score totals', fn: (lid) => recalculateDefaultScores(lid) }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')
  const step = searchParams.get('step')

  if (!leagueId) {
    return NextResponse.json({ error: 'League ID required' }, { status: 400 })
  }

  const lid = parseInt(leagueId)

  if (step && STEPS[step]) {
    const s = STEPS[step]
    try {
      console.log(`[recalculate] Step ${step}: ${s.label} for league ${lid}`)
      await s.fn(lid)
      return NextResponse.json({
        step: parseInt(step),
        totalSteps: Object.keys(STEPS).length,
        label: s.label,
        done: step === '5'
      })
    } catch (error: any) {
      console.error(`[recalculate] Step ${step} failed:`, error)
      return NextResponse.json(
        { error: error?.message || `Step ${step} failed`, step: parseInt(step), label: s.label },
        { status: 500 }
      )
    }
  }

  // Legacy: no step param — run all steps in sequence
  try {
    await runStep1(lid)
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
    return NextResponse.json(
      { error: error?.message || 'Failed to recalculate handicaps' },
      { status: 500 }
    )
  }
}
