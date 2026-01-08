import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetMembersAndScores() {
  try {
    // Find Clarksville league
    const clarksvilleLeague = await prisma.league.findUnique({
      where: { name: 'Clarksville' }
    })

    if (!clarksvilleLeague) {
      console.error('Clarksville league not found')
      return
    }

    console.log(`Found Clarksville league with ID: ${clarksvilleLeague.id}`)

    // Delete all scores first (they reference players)
    console.log('\nDeleting all scores...')
    const deletedScores = await prisma.score.deleteMany({})
    console.log(`Deleted ${deletedScores.count} scores`)

    // Delete all handicaps (they reference players)
    console.log('Deleting all handicaps...')
    const deletedHandicaps = await prisma.handicap.deleteMany({})
    console.log(`Deleted ${deletedHandicaps.count} handicaps`)

    // Delete all matches (they reference teams, which reference players)
    console.log('Deleting all matches...')
    const deletedMatches = await prisma.match.deleteMany({})
    console.log(`Deleted ${deletedMatches.count} matches`)

    // Delete all teams (they reference players)
    console.log('Deleting all teams...')
    const deletedTeams = await prisma.team.deleteMany({})
    console.log(`Deleted ${deletedTeams.count} teams`)

    // Delete all players
    console.log('Deleting all players...')
    const deletedPlayers = await prisma.player.deleteMany({})
    console.log(`Deleted ${deletedPlayers.count} players`)

    // Create 4 new members for Clarksville
    console.log('\nCreating 4 new members for Clarksville...')
    const newMembers = [
      { firstName: 'Member', lastName: 'One' },
      { firstName: 'Member', lastName: 'Two' },
      { firstName: 'Member', lastName: 'Three' },
      { firstName: 'Member', lastName: 'Four' }
    ]

    for (const member of newMembers) {
      const player = await prisma.player.create({
        data: {
          firstName: member.firstName,
          lastName: member.lastName,
          leagueId: clarksvilleLeague.id
        }
      })
      console.log(`Created: ${member.firstName} ${member.lastName} (ID: ${player.id})`)
    }

    console.log('\n✅ Successfully reset members and scores!')
    console.log(`Created ${newMembers.length} new members for Clarksville league`)
  } catch (error) {
    console.error('Error resetting members and scores:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetMembersAndScores()



