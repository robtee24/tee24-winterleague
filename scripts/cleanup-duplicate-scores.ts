import { prisma } from '../lib/prisma'

/**
 * Clean up duplicate scores - keep only the most recent score per player/week
 */
async function cleanupDuplicateScores() {
  console.log('Finding duplicate scores...')

  // Get all scores grouped by player and week
  const allScores = await prisma.score.findMany({
    include: {
      player: true,
      week: true
    },
    orderBy: [
      { playerId: 'asc' },
      { week: { weekNumber: 'asc' } },
      { id: 'desc' } // Most recent first
    ]
  })

  // Group by player + weekNumber (not weekId, to handle duplicate week records)
  const scoreGroups = new Map<string, typeof allScores>()

  for (const score of allScores) {
    const key = `${score.playerId}-${score.week.weekNumber}-${score.week.isChampionship}`
    if (!scoreGroups.has(key)) {
      scoreGroups.set(key, [])
    }
    scoreGroups.get(key)!.push(score)
  }

  let deletedCount = 0
  let keptCount = 0

  for (const [key, scores] of scoreGroups.entries()) {
    if (scores.length > 1) {
      // Keep the most recent score (first in array since sorted by id desc)
      const keepScore = scores[0]
      const duplicates = scores.slice(1)

      console.log(`\nPlayer ${keepScore.player.firstName} ${keepScore.player.lastName}, Week ${keepScore.week.weekNumber}:`)
      console.log(`  Keeping score ID ${keepScore.id} (Total: ${keepScore.total})`)
      console.log(`  Deleting ${duplicates.length} duplicate(s):`)

      for (const dup of duplicates) {
        console.log(`    - Score ID ${dup.id} (Total: ${dup.total})`)
        await prisma.score.delete({
          where: { id: dup.id }
        })
        deletedCount++
      }

      keptCount++
    }
  }

  if (deletedCount > 0) {
    console.log(`\n✅ Cleanup complete:`)
    console.log(`  - Kept ${keptCount} score groups with duplicates`)
    console.log(`  - Deleted ${deletedCount} duplicate scores`)
  } else {
    console.log('\n✅ No duplicate scores found.')
  }
}

cleanupDuplicateScores()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })



