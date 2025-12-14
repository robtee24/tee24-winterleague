import { prisma } from '../lib/prisma'

async function mergeDuplicateWeeks() {
  console.log('Finding and merging duplicate weeks...')
  
  // Find all weeks grouped by leagueId, weekNumber, and isChampionship
  const weeks = await prisma.week.findMany({
    orderBy: [
      { leagueId: 'asc' },
      { weekNumber: 'asc' },
      { id: 'asc' }
    ],
    include: {
      _count: {
        select: { scores: true }
      }
    }
  })
  
  // Group by leagueId, weekNumber, isChampionship
  const groups = new Map<string, typeof weeks>()
  weeks.forEach(week => {
    const key = `${week.leagueId}-${week.weekNumber}-${week.isChampionship}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(week)
  })
  
  // Find duplicates and merge them
  let mergedCount = 0
  let scoresMoved = 0
  let weeksDeleted = 0
  
  for (const [key, weekList] of groups.entries()) {
    if (weekList.length > 1) {
      // Keep the first week (lowest ID)
      const keepWeek = weekList[0]
      const duplicateWeeks = weekList.slice(1)
      
      console.log(`\nMerging ${weekList.length} weeks for ${key}:`)
      console.log(`  Keeping Week ID ${keepWeek.id} (has ${keepWeek._count.scores} scores)`)
      
      for (const duplicateWeek of duplicateWeeks) {
        console.log(`  Merging Week ID ${duplicateWeek.id} (has ${duplicateWeek._count.scores} scores)`)
        
        // Move all scores from duplicate week to the kept week
        const scoresToMove = await prisma.score.findMany({
          where: { weekId: duplicateWeek.id }
        })
        
        for (const score of scoresToMove) {
          // Check if a score already exists for this player and the kept week
          const existingScore = await prisma.score.findFirst({
            where: {
              playerId: score.playerId,
              weekId: keepWeek.id
            }
          })
          
          if (existingScore) {
            // If score exists, prefer the one with an image or the newer one
            if (score.scorecardImage && !existingScore.scorecardImage) {
              // Update existing score with image from duplicate
              await prisma.score.update({
                where: { id: existingScore.id },
                data: {
                  ...score,
                  id: existingScore.id, // Keep existing ID
                  weekId: keepWeek.id
                }
              })
              // Delete the duplicate score
              await prisma.score.delete({ where: { id: score.id } })
            } else {
              // Keep existing, delete duplicate
              await prisma.score.delete({ where: { id: score.id } })
            }
          } else {
            // No existing score, just update the weekId
            await prisma.score.update({
              where: { id: score.id },
              data: { weekId: keepWeek.id }
            })
          }
          scoresMoved++
        }
        
        // Move all handicaps from duplicate week to the kept week
        const handicapsToMove = await prisma.handicap.findMany({
          where: { weekId: duplicateWeek.id }
        })
        
        for (const handicap of handicapsToMove) {
          // Check if handicap already exists
          const existingHandicap = await prisma.handicap.findUnique({
            where: {
              playerId_weekId: {
                playerId: handicap.playerId,
                weekId: keepWeek.id
              }
            }
          })
          
          if (existingHandicap) {
            // Update existing handicap (prefer the one from duplicate if different)
            await prisma.handicap.update({
              where: { id: existingHandicap.id },
              data: { handicap: handicap.handicap }
            })
            // Delete duplicate handicap
            await prisma.handicap.delete({ where: { id: handicap.id } })
          } else {
            // No existing handicap, just update the weekId
            await prisma.handicap.update({
              where: { id: handicap.id },
              data: { weekId: keepWeek.id }
            })
          }
        }
        
        // Delete the duplicate week
        await prisma.week.delete({ where: { id: duplicateWeek.id } })
        weeksDeleted++
      }
      
      mergedCount++
    }
  }
  
  console.log(`\n✅ Merge complete!`)
  console.log(`  - Merged ${mergedCount} duplicate week groups`)
  console.log(`  - Moved ${scoresMoved} scores`)
  console.log(`  - Deleted ${weeksDeleted} duplicate weeks`)
}

mergeDuplicateWeeks()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

