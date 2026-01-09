import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate a round-robin schedule ensuring each team plays exactly once per week
 * For even numbers: all teams play every week (no byes)
 * For odd numbers: one team gets a bye each week, rotated so each team gets exactly one bye
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
  
  // Track bye weeks per team (for odd numbers)
  const byeWeeks = new Map<number, number>()
  shuffledTeams.forEach(team => byeWeeks.set(team, 0))
  
  // For even number of teams, we need exactly n/2 matches per week
  // For odd number of teams, we need (n-1)/2 matches per week (one bye)
  const targetMatchesPerWeek = Math.floor(n / 2)
  
  // Generate schedule for each week
  for (let week = 0; week < numWeeks; week++) {
    // Create a list of all possible pairs with their priority scores
    // Priority ensures we minimize duplicates and balance appearances
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
    
    // For even numbers, we MUST find a perfect matching (n/2 matches using all n teams)
    // Use iterative backtracking with better pruning
    const weekMatches: Array<[number, number]> = []
    const usedThisWeek = new Set<number>()
    
    const findPerfectMatching = (
      pairs: typeof allPairs,
      used: Set<number>,
      matches: Array<[number, number]>,
      startIndex: number = 0,
      depth: number = 0
    ): boolean => {
      // Base case: found perfect matching
      if (matches.length >= targetMatchesPerWeek) {
        // For even numbers, must use all teams
        if (n % 2 === 0) {
          return used.size === n
        }
        return true
      }
      
      // Pruning: check if we can still complete the matching
      const remainingTeams = n - used.size
      const neededMatches = targetMatchesPerWeek - matches.length
      
      // Simple check: need enough teams to form the remaining matches
      if (remainingTeams < neededMatches * 2) {
        return false
      }
      
      // Try pairs in priority order, but skip already used teams
      for (let i = startIndex; i < pairs.length; i++) {
        const { pair } = pairs[i]
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
        if (findPerfectMatching(pairs, used, matches, i + 1, depth + 1)) {
          return true
        }
        
        // Backtrack: remove this pair and try next
        matches.pop()
        used.delete(t1)
        used.delete(t2)
      }
      
      return false
    }
    
    // For even numbers, use greedy approach directly (guaranteed to work)
    // For odd numbers, try backtracking first, then fall back to greedy
    let success = false
    
    if (n % 2 === 0) {
      // Even numbers: use greedy matching (guaranteed to complete)
      // For even numbers, we must match all teams every week
      const unmatched = new Set(shuffledTeams)
      
      // Keep matching until all teams are used (for even numbers, this always works)
      // We need exactly n/2 matches, which means we need exactly n teams matched
      while (unmatched.size >= 2) {
        const unmatchedArray = Array.from(unmatched)
        
        // Must have at least 2 teams to form a pair
        if (unmatchedArray.length < 2) {
          console.error(`Week ${week + 1}: Not enough teams to form a pair. Remaining: ${unmatchedArray.length}`)
          break
        }
        
        // Find the best pair from unmatched teams
        let bestPair: [number, number] | null = null
        let bestPriority = Infinity
        
        for (let i = 0; i < unmatchedArray.length; i++) {
          for (let j = i + 1; j < unmatchedArray.length; j++) {
            const t1 = unmatchedArray[i]
            const t2 = unmatchedArray[j]
            
            const pairKey = getPairKey(t1, t2)
            const pairCount = pairCounts.get(pairKey) || 0
            const t1Count = teamMatchCounts.get(t1) || 0
            const t2Count = teamMatchCounts.get(t2) || 0
            
            // Priority: minimize duplicates and balance appearances
            const priority = pairCount * 10000 + (t1Count + t2Count) * 100 + Math.random() * 10
            
            if (priority < bestPriority) {
              bestPriority = priority
              bestPair = [t1, t2]
            }
          }
        }
        
        // For even numbers, we should always find a pair when unmatched.size >= 2
        if (!bestPair) {
          console.error(`Week ${week + 1}: Failed to find best pair. Unmatched: ${unmatched.size}, Matches: ${weekMatches.length}`)
          console.error(`Unmatched teams: ${unmatchedArray.join(', ')}`)
          throw new Error(`Week ${week + 1}: Cannot find a valid pair. This should never happen for even numbers when ${unmatched.size} teams remain unmatched.`)
        }
        
        const [t1, t2] = bestPair
        weekMatches.push([t1, t2])
        unmatched.delete(t1)
        unmatched.delete(t2)
        usedThisWeek.add(t1)
        usedThisWeek.add(t2)
        success = true
      }
      
      // Verify all teams are matched and we have the right number of matches
      if (unmatched.size > 0 || weekMatches.length !== targetMatchesPerWeek) {
        console.error(`Week ${week + 1}: Greedy matching incomplete. Matches: ${weekMatches.length}/${targetMatchesPerWeek}, Unmatched: ${unmatched.size}`)
        if (unmatched.size > 0) {
          console.error(`Unmatched teams: ${Array.from(unmatched).join(', ')}`)
        }
        throw new Error(`Failed to complete matching for week ${week + 1}. ${unmatched.size} teams remain unmatched, ${weekMatches.length}/${targetMatchesPerWeek} matches created.`)
      }
      
      // Double-check: ensure all teams are in usedThisWeek
      if (usedThisWeek.size !== n) {
        console.error(`Week ${week + 1}: Used set size mismatch. Expected ${n}, got ${usedThisWeek.size}`)
        const missing = shuffledTeams.filter(t => !usedThisWeek.has(t))
        console.error(`Missing from used set: ${missing.join(', ')}`)
        throw new Error(`Week ${week + 1}: Not all teams recorded as used. Expected ${n}, got ${usedThisWeek.size}`)
      }
    } else {
      // Odd numbers: try backtracking first
      success = findPerfectMatching(allPairs, usedThisWeek, weekMatches)
      
      // If backtracking fails, use greedy fallback
      if (!success) {
        weekMatches.length = 0
        usedThisWeek.clear()
        
        const unmatched = new Set(shuffledTeams)
        while (unmatched.size >= 2 && weekMatches.length < targetMatchesPerWeek) {
          // Same greedy logic as above
          let bestPair: [number, number] | null = null
          let bestPriority = Infinity
          
          const unmatchedArray = Array.from(unmatched)
          for (let i = 0; i < unmatchedArray.length; i++) {
            for (let j = i + 1; j < unmatchedArray.length; j++) {
              const t1 = unmatchedArray[i]
              const t2 = unmatchedArray[j]
              const pairKey = getPairKey(t1, t2)
              const pairCount = pairCounts.get(pairKey) || 0
              const t1Count = teamMatchCounts.get(t1) || 0
              const t2Count = teamMatchCounts.get(t2) || 0
              const priority = pairCount * 10000 + (t1Count + t2Count) * 100 + Math.random() * 10
              
              if (priority < bestPriority) {
                bestPriority = priority
                bestPair = [t1, t2]
              }
            }
          }
          
          if (bestPair) {
            const [t1, t2] = bestPair
            weekMatches.push([t1, t2])
            unmatched.delete(t1)
            unmatched.delete(t2)
            usedThisWeek.add(t1)
            usedThisWeek.add(t2)
            success = true
          } else {
            break
          }
        }
      }
    }
    
    // Verify we have a complete matching for even numbers
    if (n % 2 === 0) {
      if (weekMatches.length !== targetMatchesPerWeek) {
        console.error(`Week ${week + 1}: Failed to generate complete schedule. Generated ${weekMatches.length}/${targetMatchesPerWeek} matches for ${n} teams`)
        const unmatched = shuffledTeams.filter(t => !usedThisWeek.has(t))
        console.error(`Unmatched teams (${unmatched.length}): ${unmatched.join(', ')}`)
        
        // If we still don't have a complete matching, throw an error
        // This should never happen for even numbers with proper algorithm
        throw new Error(`Failed to generate perfect matching for week ${week + 1}. This indicates a bug in the algorithm.`)
      }
      
      // Verify all teams are used
      if (usedThisWeek.size !== n) {
        console.error(`Week ${week + 1}: Not all teams matched. Expected ${n}, got ${usedThisWeek.size}`)
        throw new Error(`Incomplete matching for week ${week + 1}`)
      }
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
  
  // Final comprehensive verification: ensure all teams have equal matches
  const finalTeamMatchCounts = new Map<number, number>()
  shuffledTeams.forEach(team => finalTeamMatchCounts.set(team, 0))
  
  for (const weekMatches of weeklySchedule) {
    for (const [t1, t2] of weekMatches) {
      finalTeamMatchCounts.set(t1, (finalTeamMatchCounts.get(t1) || 0) + 1)
      finalTeamMatchCounts.set(t2, (finalTeamMatchCounts.get(t2) || 0) + 1)
    }
  }
  
  const counts = Array.from(finalTeamMatchCounts.values())
  const minCount = Math.min(...counts)
  const maxCount = Math.max(...counts)
  
  if (n % 2 === 0) {
    // For even numbers, all teams must have exactly numWeeks matches (one per week)
    if (minCount !== maxCount || maxCount !== numWeeks) {
      const unequal: Array<{ team: number; count: number }> = []
      finalTeamMatchCounts.forEach((count, team) => {
        if (count !== numWeeks) {
          unequal.push({ team, count })
        }
      })
      console.error(`CRITICAL ERROR: Teams have unequal match counts in generated schedule:`)
      console.error(`Expected: ${numWeeks} matches per team`)
      console.error(`Min: ${minCount}, Max: ${maxCount}`)
      console.error(`Teams with wrong count:`, unequal)
      
      // Log week-by-week breakdown
      for (let w = 0; w < weeklySchedule.length; w++) {
        const weekMatches = weeklySchedule[w]
        const teamsInWeek = new Set<number>()
        for (const [t1, t2] of weekMatches) {
          teamsInWeek.add(t1)
          teamsInWeek.add(t2)
        }
        console.error(`Week ${w + 1}: ${weekMatches.length} matches, ${teamsInWeek.size} teams`)
      }
      
      throw new Error(`Schedule generation failed: Teams have unequal match counts. Expected ${numWeeks} matches per team, but found min: ${minCount}, max: ${maxCount}. ${unequal.length} teams have incorrect counts.`)
    }
  } else {
    // For odd numbers, handle bye weeks - each team should have same number of matches OR one bye
    const uniqueCounts = new Set(counts)
    if (uniqueCounts.size > 2) {
      // More than 2 different counts means uneven distribution
      throw new Error(`Schedule generation failed for odd numbers: Teams have more than 2 different match counts. This indicates uneven bye distribution.`)
    }
  }
  
  console.log(`Schedule generation verified: All ${n} teams have ${maxCount} matches over ${numWeeks} weeks`)
  
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

    // Verify schedule integrity before creating matches
    console.log(`Generated schedule for ${weeks.length} weeks with ${teamIds.length} teams`)
    
    for (let i = 0; i < weeklySchedule.length; i++) {
      const weekMatches = weeklySchedule[i] || []
      const expectedMatches = Math.floor(teamIds.length / 2)
      
      if (weekMatches.length !== expectedMatches) {
        console.error(`Week ${i + 1}: Expected ${expectedMatches} matches, got ${weekMatches.length}`)
      }
      
      // Verify all teams appear exactly once
      const teamsInWeek = new Set<number>()
      for (const [t1, t2] of weekMatches) {
        if (teamsInWeek.has(t1) || teamsInWeek.has(t2)) {
          console.error(`Week ${i + 1}: Duplicate team in matches! Team ${t1} or ${t2} appears multiple times`)
        }
        teamsInWeek.add(t1)
        teamsInWeek.add(t2)
      }
      
      if (teamIds.length % 2 === 0 && teamsInWeek.size !== teamIds.length) {
        console.error(`Week ${i + 1}: Not all teams matched. Expected ${teamIds.length}, got ${teamsInWeek.size}`)
        const missing = teamIds.filter(t => !teamsInWeek.has(t))
        console.error(`Missing teams: ${missing.join(', ')}`)
      }
    }

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

      if (weekMatches.length === 0) {
        console.warn(`Week ${week.weekNumber}: No matches generated`)
        continue
      }

      for (const [team1Id, team2Id] of weekMatches) {
        // Check if either team already has a match this week
        const team1Key = `${team1Id}-${week.id}`
        const team2Key = `${team2Id}-${week.id}`
        
        if (teamWeekMatches.has(team1Key) || teamWeekMatches.has(team2Key)) {
          console.error(`ERROR: Skipping duplicate match in generated schedule: Team ${team1Id} vs Team ${team2Id} in Week ${week.weekNumber}`)
          console.error(`This indicates a bug in the schedule generation algorithm!`)
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

    // Verify expected number of matches
    const expectedTotalMatches = weeks.length * Math.floor(teamIds.length / 2)
    if (matchesToCreate.length !== expectedTotalMatches) {
      console.error(`ERROR: Expected ${expectedTotalMatches} total matches, got ${matchesToCreate.length}`)
      return NextResponse.json({ 
        error: `Schedule generation failed: Expected ${expectedTotalMatches} matches, but only ${matchesToCreate.length} were generated. This indicates some weeks have incomplete matchings.`,
        details: {
          teams: teamIds.length,
          weeks: weeks.length,
          expectedMatches: expectedTotalMatches,
          actualMatches: matchesToCreate.length,
          matchesPerWeek: weeklySchedule.map((week, idx) => ({ week: idx + 1, matches: week.length }))
        }
      }, { status: 500 })
    }

    // Batch create all matches at once for better performance
    if (matchesToCreate.length > 0) {
      try {
        await prisma.match.createMany({
          data: matchesToCreate,
          skipDuplicates: false // Don't skip - we deleted all matches first, so this should never happen
        })
      } catch (error: any) {
        console.error('Error creating matches:', error)
        // If there's a duplicate key error, it means matches already exist (shouldn't happen)
        if (error.code === 'P2002') {
          return NextResponse.json({ 
            error: 'Failed to create matches: Some matches already exist. Please try again after clearing existing matches.',
            details: error
          }, { status: 500 })
        }
        throw error
      }
    } else {
      return NextResponse.json({ 
        error: 'No matches were generated. This should not happen.',
        details: {
          teams: teamIds.length,
          weeks: weeks.length,
          weeklySchedule: weeklySchedule.map((week, idx) => ({ week: idx + 1, matches: week.length }))
        }
      }, { status: 500 })
    }

    // Verify that all teams have equal number of matches (critical for even numbers)
    const teamMatchCounts = new Map<number, number>()
    matchesToCreate.forEach(match => {
      teamMatchCounts.set(match.team1Id, (teamMatchCounts.get(match.team1Id) || 0) + 1)
      teamMatchCounts.set(match.team2Id, (teamMatchCounts.get(match.team2Id) || 0) + 1)
    })

    // Verify all teams exist in the map
    teams.forEach(team => {
      if (!teamMatchCounts.has(team.id)) {
        teamMatchCounts.set(team.id, 0)
      }
    })

    const matchCounts = Array.from(teamMatchCounts.values())
    const minMatches = Math.min(...matchCounts)
    const maxMatches = Math.max(...matchCounts)
    
    if (minMatches !== maxMatches) {
      console.error(`ERROR: Teams have unequal match counts. Min: ${minMatches}, Max: ${maxMatches}`)
      teamMatchCounts.forEach((count, teamId) => {
        if (count !== maxMatches) {
          console.error(`Team ${teamId} has ${count} matches (expected ${maxMatches})`)
        }
      })
      
      // For even numbers, this should never happen - throw error
      if (teams.length % 2 === 0) {
        return NextResponse.json({ 
          error: `Schedule generation failed: Teams have unequal match counts. This should not happen with even number of teams. Min: ${minMatches}, Max: ${maxMatches}`,
          details: {
            teams: teams.length,
            matches: matchesToCreate.length,
            weeks: weeks.length,
            teamMatchCounts: Object.fromEntries(teamMatchCounts)
          }
        }, { status: 500 })
      }
    }

    // For even numbers, verify every team plays every week
    if (teams.length % 2 === 0) {
      const expectedMatchesPerTeam = weeks.length
      if (maxMatches !== expectedMatchesPerTeam) {
        return NextResponse.json({ 
          error: `Schedule generation failed: Each team should have ${expectedMatchesPerTeam} matches (one per week), but found ${maxMatches}`,
          details: {
            teams: teams.length,
            weeks: weeks.length,
            expectedMatchesPerTeam,
            actualMatchesPerTeam: maxMatches
          }
        }, { status: 500 })
      }
    }

    // Final verification: Query database to confirm all matches were created
    const createdMatches = await prisma.match.findMany({
      where: {
        weekId: { in: weekIds }
      },
      select: {
        team1Id: true,
        team2Id: true,
        weekId: true
      }
    })

    // Count matches per team from database
    const dbTeamMatchCounts = new Map<number, number>()
    teams.forEach(team => dbTeamMatchCounts.set(team.id, 0))
    
    createdMatches.forEach(match => {
      if (match.team2Id) {
        dbTeamMatchCounts.set(match.team1Id, (dbTeamMatchCounts.get(match.team1Id) || 0) + 1)
        dbTeamMatchCounts.set(match.team2Id, (dbTeamMatchCounts.get(match.team2Id) || 0) + 1)
      }
    })

    const dbMatchCounts = Array.from(dbTeamMatchCounts.values())
    const dbMinMatches = Math.min(...dbMatchCounts)
    const dbMaxMatches = Math.max(...dbMatchCounts)

    if (dbMinMatches !== dbMaxMatches && teams.length % 2 === 0) {
      console.error(`ERROR: Database verification failed - teams have unequal matches in database. Min: ${dbMinMatches}, Max: ${dbMaxMatches}`)
      const unequalTeams: Array<{ teamId: number; matches: number }> = []
      dbTeamMatchCounts.forEach((count, teamId) => {
        if (count !== dbMaxMatches) {
          unequalTeams.push({ teamId, matches: count })
        }
      })
      
      return NextResponse.json({ 
        error: `Database verification failed: Teams have unequal match counts after creation. Min: ${dbMinMatches}, Max: ${dbMaxMatches}`,
        details: {
          teams: teams.length,
          weeks: weeks.length,
          expectedMatchesPerTeam: weeks.length,
          dbMatchCounts: Object.fromEntries(dbTeamMatchCounts),
          unequalTeams
        }
      }, { status: 500 })
    }

    console.log(`Database verification passed: All teams have ${dbMaxMatches} matches in database`)

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

