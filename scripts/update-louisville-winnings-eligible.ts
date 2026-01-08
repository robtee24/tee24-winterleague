import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateLouisvilleWinningsEligible() {
  try {
    // Find Louisville league
    const louisvilleLeague = await prisma.league.findUnique({
      where: { name: 'Louisville' }
    })

    if (!louisvilleLeague) {
      console.error('Louisville league not found')
      return
    }

    console.log(`Found Louisville league with ID: ${louisvilleLeague.id}`)

    // Step 1: Set all Louisville players to not eligible
    const updateAllResult = await prisma.player.updateMany({
      where: { leagueId: louisvilleLeague.id },
      data: { winningsEligible: false }
    })

    console.log(`Updated ${updateAllResult.count} players to not eligible`)

    // Step 2: Set specific players to eligible
    const eligiblePlayers = [
      'BJ Nichols',
      'Jay Sharp',
      'TJ Mcnelis',
      'Matthew Ansert',
      'Cody Wheeler',
      'Eric Johnson',
      'Ben Martin',
      'Jody Speaks',
      'Tyler Langdon'
    ]

    let updatedCount = 0
    for (const playerName of eligiblePlayers) {
      const nameParts = playerName.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

      // Try to find player by first name and last name
      const player = await prisma.player.findFirst({
        where: {
          leagueId: louisvilleLeague.id,
          firstName: firstName,
          lastName: lastName || null
        }
      })

      if (player) {
        await prisma.player.update({
          where: { id: player.id },
          data: { winningsEligible: true }
        })
        console.log(`✓ Set ${playerName} (${player.firstName} ${player.lastName}) to eligible`)
        updatedCount++
      } else {
        console.log(`✗ Could not find player: ${playerName}`)
      }
    }

    console.log(`\nSuccessfully updated ${updatedCount} players to eligible`)
    console.log('Done!')
  } catch (error) {
    console.error('Error updating Louisville winnings eligibility:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateLouisvilleWinningsEligible()

