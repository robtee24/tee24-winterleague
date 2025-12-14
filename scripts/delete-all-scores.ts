import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllScores() {
  try {
    console.log('Deleting all scores...')
    const deletedScores = await prisma.score.deleteMany({})
    console.log(`✅ Deleted ${deletedScores.count} scores`)

    // Also delete handicaps since they're tied to scores
    console.log('Deleting all handicaps...')
    const deletedHandicaps = await prisma.handicap.deleteMany({})
    console.log(`✅ Deleted ${deletedHandicaps.count} handicaps`)

    console.log('\n✅ Successfully deleted all scores and handicaps!')
  } catch (error) {
    console.error('Error deleting scores:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAllScores()


