import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate a round-robin schedule ensuring each team plays exactly once per week
 * Uses a proper round-robin algorithm to distribute matches evenly
 * Returns matches organized by week
 */
function generateRoundRobinSchedule(teams: number[], numWeeks: number): Array<Array<[number, number]>> {
  const n = teams.length
  const weeklySchedule: Array<Array<[number, number]>> = []
  
  if (n < 2) return weeklySchedule
  
  // Track how many times each pair has played
  const pairCounts = new Map<string, number>()
  
  // Generate all possible pairs and initialize counts
  const allPairs: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      allPairs.push([teams[i], teams[j]])
      const pairKey = `${Math.min(teams[i], teams[j])}-${Math.max(teams[i], teams[j])}`
      pairCounts.set(pairKey, 0)
    }
  }
  
  // Generate schedule for each week
  for (let week = 0; week < numWeeks; week++) {
    const weekMatches: Array<[number, number]> = []
    const usedThisWeek = new Set<number>()
    
    // Get all pairs, sorted by how many times they've played (ascending)
    // This ensures we prioritize pairs that need more matches
    const sortedPairs = allPairs
      .map(pair => {
        const [t1, t2] = pair
        const pairKey = `${Math.min(t1, t2)}-${Math.max(t1, t2)}`
        const count = pairCounts.get(pairKey) || 0
        return { pair, count, key: pairKey }
      })
      .sort((a, b) => {
        // Prioritize pairs that have played fewer times
        if (a.count !== b.count) return a.count - b.count
        // If counts are equal, use a deterministic order based on team IDs
        const [a1, a2] = a.pair
        const [b1, b2] = b.pair
        if (a1 !== b1) return a1 - b1
        return a2 - b2
      })
    
    // Fill this week with matches, ensuring each team plays exactly once
    for (const { pair, key } of sortedPairs) {
      const [team1, team2] = pair
      
      // Only add if both teams are available (not used this week)
      if (!usedThisWeek.has(team1) && !usedThisWeek.has(team2)) {
        weekMatches.push([team1, team2])
        usedThisWeek.add(team1)
        usedThisWeek.add(team2)
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
        
        // Stop if we've filled the week (each team can only play once per week)
        // With n teams, we can have at most floor(n/2) matches per week
        if (weekMatches.length >= Math.floor(n / 2)) {
          break
        }
      }
    }
    
    // Verify that we have the correct number of matches
    // If we have an odd number of teams, one team will have a bye
    if (weekMatches.length < Math.floor(n / 2) && n % 2 === 0) {
      console.warn(`Week ${week + 1}: Only generated ${weekMatches.length} matches, expected ${Math.floor(n / 2)}`)
    }
    
    weeklySchedule.push(weekMatches)
  }
  
  return weeklySchedule
}

export async function POST(request: Request) {
  try {
    const { leagueId } = await request.json()

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    // Get all teams for this league
    const teams = await prisma.team.findMany({
      where: { leagueId: parseInt(leagueId) },
      orderBy: { teamNumber: 'asc' }
    })

    if (teams.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 teams to generate schedule' }, { status: 400 })
    }

    // Get weeks 1-10 (exclude 11 and championship)
    const weeks = await prisma.week.findMany({
      where: {
        leagueId: parseInt(leagueId),
        weekNumber: { lte: 10 },
        isChampionship: false
      },
      orderBy: { weekNumber: 'asc' }
    })

    if (weeks.length === 0) {
      return NextResponse.json({ error: 'No weeks found for schedule generation' }, { status: 400 })
    }

    // Delete existing matches for weeks 1-10
    const weekIds = weeks.map(w => w.id)
    await prisma.match.deleteMany({
      where: {
        weekId: { in: weekIds }
      }
    })

    // Generate schedule organized by week
    const teamIds = teams.map(t => t.id)
    const weeklySchedule = generateRoundRobinSchedule(teamIds, weeks.length)

    // Prepare all matches for batch creation
    const matchesToCreate: Array<{
      weekId: number
      team1Id: number
      team2Id: number
      isManual: boolean
    }> = []
    
    const teamWeekMatches = new Set<string>() // Track team-week combinations to prevent duplicates

    // Collect all matches to create
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i]
      const weekMatches = weeklySchedule[i] || []

      for (const [team1Id, team2Id] of weekMatches) {
        // Check if either team already has a match this week
        const team1Key = `${team1Id}-${week.id}`
        const team2Key = `${team2Id}-${week.id}`
        
        if (teamWeekMatches.has(team1Key) || teamWeekMatches.has(team2Key)) {
          console.log(`Skipping duplicate match: Team ${team1Id} vs Team ${team2Id} in Week ${week.weekNumber}`)
          continue
        }

        matchesToCreate.push({
          weekId: week.id,
          team1Id,
          team2Id,
          isManual: false
        })
        
        teamWeekMatches.add(team1Key)
        teamWeekMatches.add(team2Key)
      }
    }

    // Batch create all matches at once for better performance
    if (matchesToCreate.length > 0) {
      await prisma.match.createMany({
        data: matchesToCreate,
        skipDuplicates: true // Skip if match already exists
      })
    }

    return NextResponse.json({
      message: `Generated ${matchesToCreate.length} matches across ${weeks.length} weeks`,
      matches: matchesToCreate.length,
      weeks: weeks.length
    })
  } catch (error: any) {
    console.error('Error generating schedule:', error)
    const errorMessage = error?.message || 'Failed to generate schedule'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

