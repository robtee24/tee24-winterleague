import { prisma } from '../lib/prisma'

async function main() {
  console.log('Starting to clear all players and scores...')

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete all scores
    const deletedScores = await prisma.score.deleteMany({})
    console.log(`Deleted ${deletedScores.count} scores`)

    // 2. Delete all handicaps
    const deletedHandicaps = await prisma.handicap.deleteMany({})
    console.log(`Deleted ${deletedHandicaps.count} handicaps`)

    // 3. Delete all matches
    const deletedMatches = await prisma.match.deleteMany({})
    console.log(`Deleted ${deletedMatches.count} matches`)

    // 4. Delete all teams
    const deletedTeams = await prisma.team.deleteMany({})
    console.log(`Deleted ${deletedTeams.count} teams`)

    // 5. Delete all players
    const deletedPlayers = await prisma.player.deleteMany({})
    console.log(`Deleted ${deletedPlayers.count} players`)

    console.log('\n✅ Successfully cleared all players and scores!')
    console.log('\nSummary:')
    console.log(`- Scores: ${deletedScores.count}`)
    console.log(`- Handicaps: ${deletedHandicaps.count}`)
    console.log(`- Matches: ${deletedMatches.count}`)
    console.log(`- Teams: ${deletedTeams.count}`)
    console.log(`- Players: ${deletedPlayers.count}`)
  } catch (error) {
    console.error('Error clearing data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

