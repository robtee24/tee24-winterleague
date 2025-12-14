import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAllWeightedScores } from '@/lib/handicap-calculator'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get('playerId')
    const weekId = searchParams.get('weekId')
    const leagueId = searchParams.get('leagueId')

    const where: any = {}
    if (playerId) where.playerId = parseInt(playerId)
    if (weekId) where.weekId = parseInt(weekId)
    if (leagueId) {
      where.player = { leagueId: parseInt(leagueId) }
    }

    const handicaps = await prisma.handicap.findMany({
      where,
      include: {
        player: true,
        week: true
      },
      orderBy: [
        { week: { weekNumber: 'asc' } },
        { player: { firstName: 'asc' } }
      ]
    })

    return NextResponse.json(handicaps)
  } catch (error) {
    console.error('Error fetching handicaps:', error)
    return NextResponse.json({ error: 'Failed to fetch handicaps' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { playerId, weekId, handicap } = await request.json()

    const handicapRecord = await prisma.handicap.upsert({
      where: {
        playerId_weekId: {
          playerId: parseInt(playerId),
          weekId: parseInt(weekId)
        }
      },
      update: {
        handicap: parseFloat(handicap)
      },
      create: {
        playerId: parseInt(playerId),
        weekId: parseInt(weekId),
        handicap: parseFloat(handicap)
      }
    })

    // Recalculate weighted scores for all scores for this player/week
    // Get the week to find all scores with the same weekNumber (handles duplicate weeks)
    const week = await prisma.week.findUnique({
      where: { id: parseInt(weekId) }
    })
    
    if (week) {
      // Find all scores for this player and weekNumber (not just weekId)
      const allPlayerScores = await prisma.score.findMany({
        where: {
          playerId: parseInt(playerId)
        },
        include: {
          week: true
        }
      })
      
      // Filter scores by weekNumber to handle duplicate weeks
      const scoresToUpdate = allPlayerScores.filter(s => 
        s.week.weekNumber === week.weekNumber && 
        s.week.isChampionship === week.isChampionship
      )
      
      for (const score of scoresToUpdate) {
        if (score.total !== null && score.total !== undefined) {
          const weightedScore = Math.round(score.total - parseFloat(handicap))
          await prisma.score.update({
            where: { id: score.id },
            data: { weightedScore }
          })
        }
      }
      
      // Ensure all weighted scores are calculated for the league
      ensureAllWeightedScores(week.leagueId).catch(error => {
        console.error('Error ensuring weighted scores:', error)
      })
    }

    return NextResponse.json(handicapRecord)
  } catch (error) {
    console.error('Error creating/updating handicap:', error)
    return NextResponse.json({ error: 'Failed to create/update handicap' }, { status: 500 })
  }
}

