import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function recalculateWeightedScores() {
  try {
    console.log('Fetching all scores...')
    const scores = await prisma.score.findMany({
      include: {
        player: true,
        week: true
      }
    })

    console.log(`Found ${scores.length} scores to update`)

    for (const score of scores) {
      if (!score.total) {
        console.log(`Skipping score ${score.id} - no total score`)
        continue
      }

      // Get week-specific handicap
      const handicapRecord = await prisma.handicap.findUnique({
        where: {
          playerId_weekId: {
            playerId: score.playerId,
            weekId: score.weekId
          }
        }
      })

      const handicap = handicapRecord?.handicap || 0
      const weightedScore = Math.round(score.total - handicap)

      await prisma.score.update({
        where: { id: score.id },
        data: { weightedScore }
      })

      console.log(`Updated score ${score.id}: total=${score.total}, handicap=${handicap}, weighted=${weightedScore}`)
    }

    console.log('Finished recalculating weighted scores')
  } catch (error) {
    console.error('Error recalculating weighted scores:', error)
  } finally {
    await prisma.$disconnect()
  }
}

recalculateWeightedScores()

