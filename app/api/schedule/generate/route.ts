import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate a round-robin schedule ensuring each team plays exactly once per week
 * Uses a greedy matching algorithm with backtracking to ensure all teams are matched
 * Returns matches organized by week
 */
function generateRoundRobinSchedule(teams: number[], numWeeks: number): Array<Array<[number, number]>> {
  const n = teams.length
  const weeklySchedule: Array<Array<[number, number]>> = []
  
  if (n < 2) return weeklySchedule
  
  // Randomize team order to ensure randomness in schedule
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)
  
  // Track how many times each pair has played
  const pairCounts = new Map<string, number>()
  
  // Helper to get pair key (always ordered)
  const getPairKey = (t1: number, t2: number): string => {
    return `${Math.min(t1, t2)}-${Math.max(t1, t2)}`
  }
  
  // Initialize pair counts
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairCounts.set(getPairKey(shuffledTeams[i], shuffledTeams[j]), 0)
    }
  }
  
  // Track how many times each team has played
  const teamMatchCounts = new Map<number, number>()
  shuffledTeams.forEach(team => teamMatchCounts.set(team, 0))
  
  // Generate schedule for each week
  for (let week = 0; week < numWeeks; week++) {
    // For even number of teams, we need n/2 matches per week
    // For odd number, we need (n-1)/2 matches per week (one team gets a bye)
    const targetMatchesPerWeek = Math.floor(n / 2)
    
    // Create a list of all possible pairs with their priority scores
    const allPairs: Array<{
      pair: [number, number]
      pairKey: string
      pairCount: number
      t1Count: number
      t2Count: number
      priority: number
    }> = []
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const t1 = shuffledTeams[i]
        const t2 = shuffledTeams[j]
        const pairKey = getPairKey(t1, t2)
        const pairCount = pairCounts.get(pairKey) || 0
        const t1Count = teamMatchCounts.get(t1) || 0
        const t2Count = teamMatchCounts.get(t2) || 0
        
        // Priority: lower is better
        // 1. Minimize pair duplicate matches (multiply by large factor)
        // 2. Balance team appearances (sum of match counts)
        // 3. Add small random factor for randomization
        const priority = pairCount * 10000 + (t1Count + t2Count) * 100 + Math.random() * 10
        
        allPairs.push({
          pair: [t1, t2],
          pairKey,
          pairCount,
          t1Count,
          t2Count,
          priority
        })
      }
    }
    
    // Sort pairs by priority (lower is better)
    allPairs.sort((a, b) => a.priority - b.priority)
    
    // Use backtracking to find a perfect matching for this week
    const findPerfectMatching = (
      pairs: typeof allPairs,
      used: Set<number>,
      matches: Array<[number, number]>,
      startIndex: number = 0
    ): boolean => {
      if (matches.length >= targetMatchesPerWeek) {
        return true // Found perfect matching
      }
      
      // If not enough teams left, impossible
      const remainingTeams = n - used.size
      if (remainingTeams < 2) {
        return false
      }
      
      // If we need more matches than possible pairs, impossible
      const neededMatches = targetMatchesPerWeek - matches.length
      if (neededMatches * 2 > remainingTeams) {
        return false
      }
      
      // Try each remaining pair in order
      for (let i = startIndex; i < pairs.length; i++) {
        const { pair, pairKey } = pairs[i]
        const [t1, t2] = pair
        
        // Skip if either team is already used
        if (used.has(t1) || used.has(t2)) {
          continue
        }
        
        // Try adding this pair
        matches.push([t1, t2])
        used.add(t1)
        used.add(t2)
        
        // Recursively try to complete the matching
        if (findPerfectMatching(pairs, used, matches, i + 1)) {
          return true
        }
        
        // Backtrack: remove this pair and try next
        matches.pop()
        used.delete(t1)
        used.delete(t2)
      }
      
      return false
    }
    
    // Find perfect matching for this week
    const weekMatches: Array<[number, number]> = []
    const usedThisWeek = new Set<number>()
    
    if (!findPerfectMatching(allPairs, usedThisWeek, weekMatches)) {
      // Fallback: greedy approach if backtracking fails
      console.warn(`Week ${week + 1}: Backtracking failed, using greedy approach`)
      for (const { pair, pairKey } of allPairs) {
        const [t1, t2] = pair
        if (!usedThisWeek.has(t1) && !usedThisWeek.has(t2) && weekMatches.length < targetMatchesPerWeek) {
          weekMatches.push([t1, t2])
          usedThisWeek.add(t1)
          usedThisWeek.add(t2)
        }
      }
    }
    
    // Verify we have the correct number of matches
    if (weekMatches.length < targetMatchesPerWeek && n % 2 === 0) {
      console.error(`Week ${week + 1}: Failed to generate complete schedule. Generated ${weekMatches.length}/${targetMatchesPerWeek} matches`)
      const unmatched = shuffledTeams.filter(t => !usedThisWeek.has(t))
      console.error(`Unmatched teams: ${unmatched.join(', ')}`)
    }
    
    // Update counts
    for (const [t1, t2] of weekMatches) {
      const pairKey = getPairKey(t1, t2)
      pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1)
      teamMatchCounts.set(t1, (teamMatchCounts.get(t1) || 0) + 1)
      teamMatchCounts.set(t2, (teamMatchCounts.get(t2) || 0) + 1)
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

    // Verify that all teams have equal number of matches
    const teamMatchCounts = new Map<number, number>()
    matchesToCreate.forEach(match => {
      teamMatchCounts.set(match.team1Id, (teamMatchCounts.get(match.team1Id) || 0) + 1)
      teamMatchCounts.set(match.team2Id, (teamMatchCounts.get(match.team2Id) || 0) + 1)
    })

    const matchCounts = Array.from(teamMatchCounts.values())
    const minMatches = Math.min(...matchCounts)
    const maxMatches = Math.max(...matchCounts)
    
    if (minMatches !== maxMatches) {
      console.warn(`Warning: Teams have unequal match counts. Min: ${minMatches}, Max: ${maxMatches}`)
      teamMatchCounts.forEach((count, teamId) => {
        if (count !== maxMatches) {
          console.warn(`Team ${teamId} has ${count} matches (expected ${maxMatches})`)
        }
      })
    }

    console.log(`Schedule generation complete: ${matchesToCreate.length} matches across ${weeks.length} weeks. All teams have ${maxMatches} matches.`)

    return NextResponse.json({
      message: `Generated ${matchesToCreate.length} matches across ${weeks.length} weeks. All teams have ${maxMatches} matches.`,
      matches: matchesToCreate.length,
      weeks: weeks.length,
      matchesPerTeam: maxMatches
    })
  } catch (error: any) {
    console.error('Error generating schedule:', error)
    const errorMessage = error?.message || 'Failed to generate schedule'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

