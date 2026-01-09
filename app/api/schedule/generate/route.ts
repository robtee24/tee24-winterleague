import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate a round-robin schedule ensuring each team plays exactly once per week
 * CRITICAL: All teams must have exactly the same number of matches
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
  
  // Track how many times each pair has played (to minimize duplicates)
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
  
  // Track how many times each team has played (to balance appearances)
  const teamMatchCounts = new Map<number, number>()
  shuffledTeams.forEach(team => teamMatchCounts.set(team, 0))
  
  // For even number of teams, we need exactly n/2 matches per week
  // For odd number of teams, we need (n-1)/2 matches per week (one bye)
  const targetMatchesPerWeek = Math.floor(n / 2)
  
  // Generate schedule for each week
  // CRITICAL: Each week must have ALL teams matched exactly once (for even numbers)
  for (let week = 0; week < numWeeks; week++) {
    const weekMatches: Array<[number, number]> = []
    const usedThisWeek = new Set<number>()
    
    if (n % 2 === 0) {
      // EVEN NUMBERS: Simple greedy algorithm that's guaranteed to work
      // Start with all teams unmatched
      const unmatched = new Set(shuffledTeams)
      
      // Create exactly n/2 matches, using all n teams
      // CRITICAL: Use a for loop that runs exactly targetMatchesPerWeek times
      // This guarantees we create exactly the right number of matches
      for (let matchNum = 0; matchNum < targetMatchesPerWeek; matchNum++) {
        // At each iteration, we should have exactly (n - 2*matchNum) teams unmatched
        const expectedUnmatched = n - (matchNum * 2)
        
        if (unmatched.size !== expectedUnmatched) {
          throw new Error(`Week ${week + 1}, Match ${matchNum + 1}: State error. Expected ${expectedUnmatched} unmatched teams, got ${unmatched.size}`)
        }
        
        if (unmatched.size < 2) {
          throw new Error(`Week ${week + 1}, Match ${matchNum + 1}: Not enough teams. Unmatched: ${unmatched.size}, Expected: ${expectedUnmatched}`)
        }
        
        const unmatchedArray = Array.from(unmatched)
        
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
        
        if (!bestPair) {
          console.error(`Week ${week + 1}: Failed to find pair. Unmatched: ${unmatchedArray.length}, Matches: ${weekMatches.length}/${targetMatchesPerWeek}`)
          throw new Error(`Week ${week + 1}: Failed to find pair. Unmatched: ${unmatchedArray.length} teams. This should never happen for even numbers.`)
        }
        
        const [t1, t2] = bestPair
        
        // Verify teams are actually in unmatched set
        if (!unmatched.has(t1) || !unmatched.has(t2)) {
          throw new Error(`Week ${week + 1}, Match ${matchNum + 1}: Teams ${t1} or ${t2} not in unmatched set!`)
        }
        
        // Add match
        weekMatches.push([t1, t2])
        
        // Remove from unmatched
        unmatched.delete(t1)
        unmatched.delete(t2)
        
        // Add to used
        usedThisWeek.add(t1)
        usedThisWeek.add(t2)
      }
      
      // After the for loop, we MUST have exactly targetMatchesPerWeek matches and 0 unmatched teams
      if (unmatched.size !== 0) {
        const missing = Array.from(unmatched)
        throw new Error(`Week ${week + 1}: After creating ${weekMatches.length} matches, ${unmatched.size} teams remain unmatched: ${missing.join(', ')}`)
      }
      
      // Verify no team appears twice in matches
      const teamsInMatches = new Set<number>()
      for (const [t1, t2] of weekMatches) {
        if (teamsInMatches.has(t1) || teamsInMatches.has(t2)) {
          throw new Error(`Week ${week + 1}: Duplicate team in matches! Team ${teamsInMatches.has(t1) ? t1 : t2} appears multiple times`)
        }
        teamsInMatches.add(t1)
        teamsInMatches.add(t2)
      }
      
      if (teamsInMatches.size !== n) {
        const missing = shuffledTeams.filter(t => !teamsInMatches.has(t))
        throw new Error(`Week ${week + 1}: Only ${teamsInMatches.size}/${n} teams in matches. Missing: ${missing.join(', ')}`)
      }
      
      // CRITICAL VERIFICATION: All teams must be matched
      if (unmatched.size !== 0) {
        throw new Error(`Week ${week + 1}: ${unmatched.size} teams remain unmatched: ${Array.from(unmatched).join(', ')}`)
      }
      
      if (usedThisWeek.size !== n) {
        throw new Error(`Week ${week + 1}: Only ${usedThisWeek.size}/${n} teams matched`)
      }
      
      if (weekMatches.length !== targetMatchesPerWeek) {
        throw new Error(`Week ${week + 1}: Expected ${targetMatchesPerWeek} matches, got ${weekMatches.length}`)
      }
    } else {
      // ODD NUMBERS: One team gets a bye each week
      const unmatched = new Set(shuffledTeams)
      
      // Create (n-1)/2 matches, leaving one team with a bye
      for (let matchNum = 0; matchNum < targetMatchesPerWeek; matchNum++) {
        const unmatchedArray = Array.from(unmatched)
        
        if (unmatchedArray.length < 2) break
        
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
        }
      }
    }
    
    // CRITICAL: Verify week is complete BEFORE adding to schedule
    if (n % 2 === 0) {
      // For even numbers, must have exactly targetMatchesPerWeek matches and all n teams
      if (weekMatches.length !== targetMatchesPerWeek) {
        throw new Error(`Week ${week + 1}: Cannot add incomplete week. Expected ${targetMatchesPerWeek} matches, got ${weekMatches.length}`)
      }
      
      // Verify all teams are in this week
      const teamsInWeek = new Set<number>()
      for (const [t1, t2] of weekMatches) {
        teamsInWeek.add(t1)
        teamsInWeek.add(t2)
      }
      
      if (teamsInWeek.size !== n) {
        const missing = shuffledTeams.filter(t => !teamsInWeek.has(t))
        throw new Error(`Week ${week + 1}: Cannot add incomplete week. Only ${teamsInWeek.size}/${n} teams matched. Missing: ${missing.join(', ')}`)
      }
      
      // Verify no duplicate teams in matches
      for (const [t1, t2] of weekMatches) {
        if (t1 === t2) {
          throw new Error(`Week ${week + 1}: Invalid match - team ${t1} matched with itself`)
        }
      }
    }
    
    // Update counts for next week
    for (const [t1, t2] of weekMatches) {
      const pairKey = getPairKey(t1, t2)
      pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1)
      teamMatchCounts.set(t1, (teamMatchCounts.get(t1) || 0) + 1)
      teamMatchCounts.set(t2, (teamMatchCounts.get(t2) || 0) + 1)
    }
    
    // CRITICAL: Final check before adding to schedule
    // For even numbers, MUST have exactly targetMatchesPerWeek matches with all n teams
    if (n % 2 === 0) {
      if (weekMatches.length !== targetMatchesPerWeek) {
        throw new Error(`Week ${week + 1}: REFUSING to add incomplete week. Expected ${targetMatchesPerWeek} matches, got ${weekMatches.length}`)
      }
      
      const allTeamsInWeek = new Set<number>()
      for (const [t1, t2] of weekMatches) {
        allTeamsInWeek.add(t1)
        allTeamsInWeek.add(t2)
      }
      
      if (allTeamsInWeek.size !== n) {
        const missing = shuffledTeams.filter(t => !allTeamsInWeek.has(t))
        throw new Error(`Week ${week + 1}: REFUSING to add incomplete week. Only ${allTeamsInWeek.size}/${n} teams. Missing: ${missing.join(', ')}`)
      }
    }
    
    // Only add to schedule if all verifications pass
    weeklySchedule.push(weekMatches)
    console.log(`Week ${week + 1}: ✅ Added to schedule - ${weekMatches.length} matches, all ${n} teams matched`)
  }
  
  // FINAL VERIFICATION: Ensure all teams have exactly the same number of matches
  const finalTeamMatchCounts = new Map<number, number>()
  shuffledTeams.forEach(team => finalTeamMatchCounts.set(team, 0))
  
  // Track which teams appear in which weeks for debugging
  const teamsByWeek = new Map<number, Set<number>>()
  
  for (let w = 0; w < weeklySchedule.length; w++) {
    const weekMatches = weeklySchedule[w]
    const teamsInWeek = new Set<number>()
    
    for (const [t1, t2] of weekMatches) {
      finalTeamMatchCounts.set(t1, (finalTeamMatchCounts.get(t1) || 0) + 1)
      finalTeamMatchCounts.set(t2, (finalTeamMatchCounts.get(t2) || 0) + 1)
      teamsInWeek.add(t1)
      teamsInWeek.add(t2)
    }
    
    teamsByWeek.set(w + 1, teamsInWeek)
  }
  
  const counts = Array.from(finalTeamMatchCounts.values())
  const minCount = Math.min(...counts)
  const maxCount = Math.max(...counts)
  
  // CRITICAL: All teams must have exactly the same number of matches
  if (minCount !== maxCount) {
    const unequal: Array<{ team: number; count: number; missingWeeks: number[] }> = []
    finalTeamMatchCounts.forEach((count, team) => {
      if (count !== maxCount) {
        // Find which weeks this team is missing from
        const missingWeeks: number[] = []
        for (let w = 1; w <= numWeeks; w++) {
          const teamsInWeek = teamsByWeek.get(w)
          if (!teamsInWeek || !teamsInWeek.has(team)) {
            missingWeeks.push(w)
          }
        }
        unequal.push({ team, count, missingWeeks })
      }
    })
    
    console.error(`CRITICAL ERROR: Teams have unequal match counts:`)
    console.error(`Min: ${minCount}, Max: ${maxCount}`)
    console.error(`Expected: ${numWeeks} matches per team`)
    console.error(`Unequal teams (${unequal.length}):`, unequal)
    
    // Log each week's matches in detail
    for (let w = 0; w < weeklySchedule.length; w++) {
      const weekMatches = weeklySchedule[w]
      const teamsInWeek = teamsByWeek.get(w + 1) || new Set()
      const missingTeams = shuffledTeams.filter(t => !teamsInWeek.has(t))
      
      console.error(`Week ${w + 1}: ${weekMatches.length} matches, ${teamsInWeek.size} teams matched`)
      if (missingTeams.length > 0) {
        console.error(`  ⚠️  Missing teams in Week ${w + 1}: ${missingTeams.join(', ')}`)
      }
    }
    
    // Show which teams have which counts
    const teamsByCount = new Map<number, number[]>()
    finalTeamMatchCounts.forEach((count, team) => {
      if (!teamsByCount.has(count)) {
        teamsByCount.set(count, [])
      }
      teamsByCount.get(count)!.push(team)
    })
    
    console.error(`Teams grouped by match count:`)
    teamsByCount.forEach((teams, count) => {
      console.error(`  ${count} matches: ${teams.length} teams (${teams.join(', ')})`)
    })
    
    throw new Error(`Schedule generation FAILED: Teams have unequal match counts. Min: ${minCount}, Max: ${maxCount}. ${unequal.length} teams have incorrect counts. Expected ${numWeeks} matches per team.`)
  }
  
  // For even numbers, verify all teams have exactly numWeeks matches
  if (n % 2 === 0 && maxCount !== numWeeks) {
    throw new Error(`Schedule generation FAILED: For even numbers, all teams should have exactly ${numWeeks} matches (one per week), but found ${maxCount} matches per team.`)
  }
  
  console.log(`✅ Schedule verified: All ${n} teams have exactly ${maxCount} matches over ${numWeeks} weeks`)
  
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

    // Get weeks 1-10 ONLY (exclude 11 and championship)
    // For Louisville: 10 weeks of regular season, each team should have 10 matches
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
    
    // Ensure we have exactly 10 weeks (or fewer if that's all that exists)
    if (weeks.length > 10) {
      console.warn(`Found ${weeks.length} weeks, but only using first 10 for schedule generation`)
      weeks.splice(10) // Keep only first 10 weeks
    }
    
    console.log(`Generating schedule for ${weeks.length} weeks (weeks ${weeks.map(w => w.weekNumber).join(', ')})`)

    // Delete existing matches for weeks 1-10 ONLY
    // This ensures we don't count matches from week 11 or championship
    const weekIds = weeks.map(w => w.id)
    const deleteResult = await prisma.match.deleteMany({
      where: {
        weekId: { in: weekIds }
      }
    })
    console.log(`Deleted ${deleteResult.count} existing matches for weeks 1-10`)
    
    // Verify no matches remain for weeks 1-10
    const remainingMatches = await prisma.match.count({
      where: {
        weekId: { in: weekIds }
      }
    })
    if (remainingMatches > 0) {
      console.error(`WARNING: ${remainingMatches} matches still exist for weeks 1-10 after deletion`)
    }

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

    // Collect all matches to create - schedule generation already verified uniqueness
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i]
      const weekMatches = weeklySchedule[i] || []

      if (weekMatches.length === 0) {
        console.error(`ERROR: Week ${week.weekNumber}: No matches generated! This should not happen.`)
        return NextResponse.json({ 
          error: `Week ${week.weekNumber} has no matches generated. Schedule generation failed.`,
          details: {
            week: week.weekNumber,
            expectedMatches: Math.floor(teamIds.length / 2),
            actualMatches: 0
          }
        }, { status: 500 })
      }

      // Track teams in this week to verify uniqueness (should already be verified, but double-check)
      const teamsInThisWeek = new Set<number>()
      
      for (const [team1Id, team2Id] of weekMatches) {
        // Verify no duplicates within this week (shouldn't happen, but safety check)
        if (teamsInThisWeek.has(team1Id) || teamsInThisWeek.has(team2Id)) {
          console.error(`ERROR: Week ${week.weekNumber}: Duplicate team found in generated schedule! Team ${team1Id} or ${team2Id} appears multiple times.`)
          return NextResponse.json({ 
            error: `Schedule generation error: Week ${week.weekNumber} has duplicate teams. This indicates a bug in the algorithm.`,
            details: {
              week: week.weekNumber,
              team1Id,
              team2Id,
              teamsInWeek: Array.from(teamsInThisWeek)
            }
          }, { status: 500 })
        }
        
        teamsInThisWeek.add(team1Id)
        teamsInThisWeek.add(team2Id)

        // Ensure team2Id is never null (shouldn't happen, but safety check)
        if (!team2Id) {
          console.error(`ERROR: Week ${week.weekNumber}: Attempted to create match with null team2Id. Team1Id: ${team1Id}`)
          return NextResponse.json({ 
            error: `Schedule generation error: Attempted to create match with null team2Id in Week ${week.weekNumber}`,
            details: {
              week: week.weekNumber,
              team1Id
            }
          }, { status: 500 })
        }

        matchesToCreate.push({
          weekId: week.id,
          team1Id,
          team2Id,
          isManual: false
        })
      }
      
      // Verify all teams are in this week for even numbers
      if (teamIds.length % 2 === 0 && teamsInThisWeek.size !== teamIds.length) {
        const missing = teamIds.filter(id => !teamsInThisWeek.has(id))
        console.error(`ERROR: Week ${week.weekNumber}: Not all teams matched. Missing: ${missing.join(', ')}`)
        return NextResponse.json({ 
          error: `Schedule generation error: Week ${week.weekNumber} is missing teams. Expected ${teamIds.length} teams, got ${teamsInThisWeek.size}.`,
          details: {
            week: week.weekNumber,
            expectedTeams: teamIds.length,
            actualTeams: teamsInThisWeek.size,
            missingTeams: missing
          }
        }, { status: 500 })
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

    // CRITICAL: Create matches individually to ensure ALL are created
    // This ensures we catch any failures immediately and don't silently skip matches
    console.log(`Creating ${matchesToCreate.length} matches in database (one by one to ensure all are created)...`)
    let createdCount = 0
    const failedMatches: Array<{ weekId: number; team1Id: number; team2Id: number; error: string }> = []
    
    if (matchesToCreate.length > 0) {
      for (const match of matchesToCreate) {
        try {
          await prisma.match.create({
            data: match
          })
          createdCount++
        } catch (error: any) {
          failedMatches.push({
            weekId: match.weekId,
            team1Id: match.team1Id,
            team2Id: match.team2Id,
            error: error.message || String(error)
          })
          console.error(`❌ Failed to create match: Week ${match.weekId}, Team ${match.team1Id} vs Team ${match.team2Id}`, error)
        }
      }
      
      if (failedMatches.length > 0) {
        return NextResponse.json({ 
          error: `Failed to create ${failedMatches.length} out of ${matchesToCreate.length} matches. This will cause unequal match counts.`,
          details: {
            totalMatches: matchesToCreate.length,
            created: createdCount,
            failed: failedMatches.length,
            failedMatches: failedMatches.slice(0, 10) // Show first 10 failures
          }
        }, { status: 500 })
      }
      
      if (createdCount !== matchesToCreate.length) {
        return NextResponse.json({ 
          error: `Mismatch: Expected to create ${matchesToCreate.length} matches, but created ${createdCount}`,
          details: {
            expected: matchesToCreate.length,
            created: createdCount
          }
        }, { status: 500 })
      }
      
      console.log(`✅ Successfully created all ${createdCount} matches`)
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
    // CRITICAL: Only count matches from weeks 1-10 (weekIds), NOT week 11 or championship
    const createdMatches = await prisma.match.findMany({
      where: {
        weekId: { in: weekIds }, // Only weeks 1-10
        team2Id: { not: null } // Only valid matches with both teams
      },
      select: {
        team1Id: true,
        team2Id: true,
        weekId: true
      }
    })
    
    // Log breakdown by week to help debug
    const matchesByWeek = new Map<number, number>()
    createdMatches.forEach(match => {
      matchesByWeek.set(match.weekId, (matchesByWeek.get(match.weekId) || 0) + 1)
    })
    console.log(`Matches created by week (weeks 1-10 only):`, Object.fromEntries(matchesByWeek))
    console.log(`Total matches in DB for weeks 1-10: ${createdMatches.length}, Expected: ${matchesToCreate.length}`)

    // Count matches per team from database (ONLY weeks 1-10)
    const dbTeamMatchCounts = new Map<number, number>()
    teams.forEach(team => dbTeamMatchCounts.set(team.id, 0))
    
    createdMatches.forEach(match => {
      if (match.team2Id) {
        dbTeamMatchCounts.set(match.team1Id, (dbTeamMatchCounts.get(match.team1Id) || 0) + 1)
        dbTeamMatchCounts.set(match.team2Id, (dbTeamMatchCounts.get(match.team2Id) || 0) + 1)
      }
    })
    
    // Log match counts per team for debugging
    console.log(`Match counts per team (weeks 1-10 only):`)
    dbTeamMatchCounts.forEach((count, teamId) => {
      const team = teams.find(t => t.id === teamId)
      console.log(`  Team ${team?.teamNumber || teamId}: ${count} matches`)
    })

    const dbMatchCounts = Array.from(dbTeamMatchCounts.values())
    const dbMinMatches = Math.min(...dbMatchCounts)
    const dbMaxMatches = Math.max(...dbMatchCounts)

    // For Louisville: 10 weeks of regular season, each team should have exactly 10 matches
    // If that's not possible, all teams should have 9 matches (but all teams must be equal)
    const expectedMatchesPerTeam = weeks.length // Should be 10 for Louisville
    
    if (dbMinMatches !== dbMaxMatches && teams.length % 2 === 0) {
      console.error(`ERROR: Database verification failed - teams have unequal matches in database. Min: ${dbMinMatches}, Max: ${dbMaxMatches}, Expected: ${expectedMatchesPerTeam}`)
      const unequalTeams: Array<{ teamId: number; teamNumber: number; matches: number }> = []
      dbTeamMatchCounts.forEach((count, teamId) => {
        if (count !== dbMaxMatches) {
          const team = teams.find(t => t.id === teamId)
          unequalTeams.push({ teamId, teamNumber: team?.teamNumber || 0, matches: count })
        }
      })
      
      return NextResponse.json({ 
        error: `Database verification failed: Teams have unequal match counts after creation. Expected ${expectedMatchesPerTeam} matches per team (one per week), but found min: ${dbMinMatches}, max: ${dbMaxMatches}. ${unequalTeams.length} teams have incorrect counts.`,
        details: {
          teams: teams.length,
          weeks: weeks.length,
          expectedMatchesPerTeam,
          actualMinMatches: dbMinMatches,
          actualMaxMatches: dbMaxMatches,
          unequalTeams,
          dbMatchCounts: Object.fromEntries(dbTeamMatchCounts)
        }
      }, { status: 500 })
    }
    
    // Final check: ensure all teams have exactly expectedMatchesPerTeam matches (should be 10 for Louisville)
    if (dbMaxMatches !== expectedMatchesPerTeam) {
      console.error(`ERROR: Teams have ${dbMaxMatches} matches, but expected ${expectedMatchesPerTeam} matches per team (one per week for ${weeks.length} weeks)`)
      return NextResponse.json({ 
        error: `Schedule generation failed: Each team should have exactly ${expectedMatchesPerTeam} matches (one per week for ${weeks.length} weeks), but found ${dbMaxMatches} matches per team.`,
        details: {
          teams: teams.length,
          weeks: weeks.length,
          expectedMatchesPerTeam,
          actualMatchesPerTeam: dbMaxMatches,
          totalMatchesCreated: createdMatches.length
        }
      }, { status: 500 })
    }

    console.log(`✅ Database verification passed: All ${teams.length} teams have exactly ${expectedMatchesPerTeam} matches (one per week for ${weeks.length} weeks)`)

    return NextResponse.json({
      success: true,
      message: `Schedule generated successfully for ${teams.length} teams over ${weeks.length} weeks. Each team has exactly ${expectedMatchesPerTeam} matches.`,
      matches: matchesToCreate.length,
      weeks: weeks.length,
      matchesPerTeam: expectedMatchesPerTeam
    })
  } catch (error: any) {
    console.error('Error generating schedule:', error)
    const errorMessage = error?.message || 'Failed to generate schedule'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

