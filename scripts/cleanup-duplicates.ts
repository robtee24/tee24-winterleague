import { prisma } from '../lib/prisma'

/**
 * Comprehensive cleanup script to remove duplicate weeks and matches
 * 1. Merge duplicate weeks (same leagueId, weekNumber, isChampionship)
 * 2. Remove duplicate matches (same weekId, team1Id, team2Id)
 */
async function cleanupDuplicates() {
  console.log('Starting comprehensive duplicate cleanup...\n')

  // Step 1: Merge duplicate weeks
  console.log('Step 1: Merging duplicate weeks...')
  const weeks = await prisma.week.findMany({
    orderBy: [
      { leagueId: 'asc' },
      { weekNumber: 'asc' },
      { id: 'asc' }
    ],
    include: {
      _count: {
        select: { 
          scores: true,
          matches: true,
          handicaps: true
        }
      }
    }
  })

  // Group by leagueId, weekNumber, isChampionship
  const weekGroups = new Map<string, typeof weeks>()
  weeks.forEach(week => {
    const key = `${week.leagueId}-${week.weekNumber}-${week.isChampionship}`
    if (!weekGroups.has(key)) {
      weekGroups.set(key, [])
    }
    weekGroups.get(key)!.push(week)
  })

  let weeksMerged = 0
  let scoresMoved = 0
  let matchesMoved = 0
  let handicapsMoved = 0
  let weeksDeleted = 0

  for (const [key, weekList] of weekGroups.entries()) {
    if (weekList.length <= 1) continue // No duplicates

    // Sort by number of related records (scores, matches, handicaps) - keep the one with most
    weekList.sort((a, b) => {
      const aCount = a._count.scores + a._count.matches + a._count.handicaps
      const bCount = b._count.scores + b._count.matches + b._count.handicaps
      return bCount - aCount
    })

    const primaryWeek = weekList[0]
    const duplicateWeeks = weekList.slice(1)

    console.log(`  Merging ${duplicateWeeks.length} duplicate(s) into week ${primaryWeek.id} (League ${primaryWeek.leagueId}, Week ${primaryWeek.weekNumber}${primaryWeek.isChampionship ? ' - Championship' : ''})`)

    for (const duplicate of duplicateWeeks) {
      // Move scores
      const scoresToMove = await prisma.score.findMany({
        where: { weekId: duplicate.id }
      })
      for (const score of scoresToMove) {
        // Check if a score already exists for this player/week combination
        const existingScore = await prisma.score.findFirst({
          where: {
            playerId: score.playerId,
            weekId: primaryWeek.id
          }
        })

        if (existingScore) {
          // Merge score data - keep the one with more hole data
          const existingHasHoles = hasHoleScores(existingScore)
          const newHasHoles = hasHoleScores(score)
          
          if (newHasHoles && !existingHasHoles) {
            // Update existing with new hole data
            await prisma.score.update({
              where: { id: existingScore.id },
              data: {
                hole1: score.hole1 ?? existingScore.hole1,
                hole2: score.hole2 ?? existingScore.hole2,
                hole3: score.hole3 ?? existingScore.hole3,
                hole4: score.hole4 ?? existingScore.hole4,
                hole5: score.hole5 ?? existingScore.hole5,
                hole6: score.hole6 ?? existingScore.hole6,
                hole7: score.hole7 ?? existingScore.hole7,
                hole8: score.hole8 ?? existingScore.hole8,
                hole9: score.hole9 ?? existingScore.hole9,
                hole10: score.hole10 ?? existingScore.hole10,
                hole11: score.hole11 ?? existingScore.hole11,
                hole12: score.hole12 ?? existingScore.hole12,
                hole13: score.hole13 ?? existingScore.hole13,
                hole14: score.hole14 ?? existingScore.hole14,
                hole15: score.hole15 ?? existingScore.hole15,
                hole16: score.hole16 ?? existingScore.hole16,
                hole17: score.hole17 ?? existingScore.hole17,
                hole18: score.hole18 ?? existingScore.hole18,
                front9: score.front9 ?? existingScore.front9,
                back9: score.back9 ?? existingScore.back9,
                total: score.total ?? existingScore.total,
                weightedScore: score.weightedScore ?? existingScore.weightedScore,
                scorecardImage: score.scorecardImage || existingScore.scorecardImage
              }
            })
          }
          // Delete duplicate score
          await prisma.score.delete({ where: { id: score.id } })
        } else {
          // Move score to primary week
          await prisma.score.update({
            where: { id: score.id },
            data: { weekId: primaryWeek.id }
          })
          scoresMoved++
        }
      }

      // Move matches
      const matchesToMove = await prisma.match.findMany({
        where: { weekId: duplicate.id }
      })
      for (const match of matchesToMove) {
        // Check if a match already exists for this week/team combination
        const existingMatch = await prisma.match.findFirst({
          where: {
            weekId: primaryWeek.id,
            team1Id: match.team1Id,
            team2Id: match.team2Id
          }
        })

        if (existingMatch) {
          // Keep the match with calculated points, or the newer one
          if ((match.team1Points > 0 || match.team2Points > 0) && 
              (existingMatch.team1Points === 0 && existingMatch.team2Points === 0)) {
            // Update existing with calculated match data
            await prisma.match.update({
              where: { id: existingMatch.id },
              data: {
                team1Points: match.team1Points,
                team2Points: match.team2Points,
                winnerId: match.winnerId,
                isManual: match.isManual
              }
            })
          }
          // Delete duplicate match
          await prisma.match.delete({ where: { id: match.id } })
        } else {
          // Move match to primary week
          await prisma.match.update({
            where: { id: match.id },
            data: { weekId: primaryWeek.id }
          })
          matchesMoved++
        }
      }

      // Move handicaps
      const handicapsToMove = await prisma.handicap.findMany({
        where: { weekId: duplicate.id }
      })
      for (const handicap of handicapsToMove) {
        // Check if handicap already exists
        const existingHandicap = await prisma.handicap.findUnique({
          where: {
            playerId_weekId: {
              playerId: handicap.playerId,
              weekId: primaryWeek.id
            }
          }
        })

        if (existingHandicap) {
          // Keep the more recent or more complete handicap
          if (handicap.updatedAt > existingHandicap.updatedAt) {
            await prisma.handicap.update({
              where: { id: existingHandicap.id },
              data: {
                handicap: handicap.handicap,
                rawHandicap: handicap.rawHandicap ?? existingHandicap.rawHandicap,
                appliedHandicap: handicap.appliedHandicap ?? existingHandicap.appliedHandicap,
                isBaseline: handicap.isBaseline || existingHandicap.isBaseline
              }
            })
          }
          // Delete duplicate handicap
          await prisma.handicap.delete({ where: { id: handicap.id } })
        } else {
          // Move handicap to primary week
          await prisma.handicap.update({
            where: { id: handicap.id },
            data: { weekId: primaryWeek.id }
          })
          handicapsMoved++
        }
      }

      // Delete duplicate week
      await prisma.week.delete({ where: { id: duplicate.id } })
      weeksDeleted++
    }

    weeksMerged += duplicateWeeks.length
  }

  console.log(`  ✓ Merged ${weeksMerged} duplicate weeks`)
  console.log(`  ✓ Moved ${scoresMoved} scores`)
  console.log(`  ✓ Moved ${matchesMoved} matches`)
  console.log(`  ✓ Moved ${handicapsMoved} handicaps`)
  console.log(`  ✓ Deleted ${weeksDeleted} duplicate week records\n`)

  // Step 2: Remove duplicate matches (same weekId, team1Id, team2Id)
  console.log('Step 2: Removing duplicate matches...')
  const allMatches = await prisma.match.findMany({
    orderBy: [
      { weekId: 'asc' },
      { team1Id: 'asc' },
      { team2Id: 'asc' },
      { id: 'asc' }
    ]
  })

  // Group by weekId, team1Id, team2Id
  const matchGroups = new Map<string, typeof allMatches>()
  allMatches.forEach(match => {
    const key = `${match.weekId}-${match.team1Id}-${match.team2Id || 'null'}`
    if (!matchGroups.has(key)) {
      matchGroups.set(key, [])
    }
    matchGroups.get(key)!.push(match)
  })

  let matchesDeleted = 0
  let matchesKept = 0

  for (const [key, matchList] of matchGroups.entries()) {
    if (matchList.length <= 1) {
      matchesKept++
      continue // No duplicates
    }

    // Sort by: 1) has calculated points, 2) has winner, 3) newer
    matchList.sort((a, b) => {
      const aHasPoints = (a.team1Points > 0 || a.team2Points > 0) ? 1 : 0
      const bHasPoints = (b.team1Points > 0 || b.team2Points > 0) ? 1 : 0
      if (aHasPoints !== bHasPoints) return bHasPoints - aHasPoints

      const aHasWinner = a.winnerId !== null ? 1 : 0
      const bHasWinner = b.winnerId !== null ? 1 : 0
      if (aHasWinner !== bHasWinner) return bHasWinner - aHasWinner

      return b.id - a.id // Keep newer
    })

    const primaryMatch = matchList[0]
    const duplicateMatches = matchList.slice(1)

    // Update primary match with best data from duplicates
    for (const duplicate of duplicateMatches) {
      if ((duplicate.team1Points > 0 || duplicate.team2Points > 0) && 
          (primaryMatch.team1Points === 0 && primaryMatch.team2Points === 0)) {
        await prisma.match.update({
          where: { id: primaryMatch.id },
          data: {
            team1Points: duplicate.team1Points,
            team2Points: duplicate.team2Points,
            winnerId: duplicate.winnerId,
            isManual: duplicate.isManual
          }
        })
      }
      await prisma.match.delete({ where: { id: duplicate.id } })
      matchesDeleted++
    }

    matchesKept++
  }

  console.log(`  ✓ Kept ${matchesKept} unique matches`)
  console.log(`  ✓ Deleted ${matchesDeleted} duplicate matches\n`)

  // Summary
  console.log('Cleanup Summary:')
  console.log(`  - Weeks merged: ${weeksMerged}`)
  console.log(`  - Weeks deleted: ${weeksDeleted}`)
  console.log(`  - Scores moved: ${scoresMoved}`)
  console.log(`  - Matches moved: ${matchesMoved}`)
  console.log(`  - Matches deleted: ${matchesDeleted}`)
  console.log(`  - Handicaps moved: ${handicapsMoved}`)
  console.log('\n✓ Cleanup complete!')
}

function hasHoleScores(score: any): boolean {
  if (!score) return false
  for (let i = 1; i <= 18; i++) {
    const holeKey = `hole${i}` as keyof typeof score
    if (score[holeKey] !== null && score[holeKey] !== undefined) {
      return true
    }
  }
  return false
}

// Run the cleanup
cleanupDuplicates()
  .catch((error) => {
    console.error('Error during cleanup:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })



