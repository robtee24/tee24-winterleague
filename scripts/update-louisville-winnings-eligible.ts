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
      { firstName: 'BJ', lastName: 'Nichols' },
      { firstName: 'Jay', lastName: 'Sharp' },
      { firstName: 'TJ', lastName: 'Mcnelis' },
      { firstName: 'Matthew', lastName: 'Ansert' },
      { firstName: 'Cody', lastName: 'Wheeler' },
      { firstName: 'Eric', lastName: 'Johnson' },
      { firstName: 'Ben', lastName: 'Martin' },
      { firstName: 'Jody', lastName: 'Speaks' },
      { firstName: 'Tyler', lastName: 'Langdon' }
    ]

    let updatedCount = 0
    for (const { firstName, lastName } of eligiblePlayers) {
      // Try to find player by first name and last name (case-insensitive, partial match)
      const allPlayers = await prisma.player.findMany({
        where: {
          leagueId: louisvilleLeague.id
        }
      })

      // Find matching player using case-insensitive partial matching
      const player = allPlayers.find(p => {
        const pFirstName = p.firstName.toLowerCase()
        const pLastName = (p.lastName || '').toLowerCase()
        const searchFirstName = firstName.toLowerCase()
        const searchLastName = lastName.toLowerCase()
        
        return pFirstName.startsWith(searchFirstName) && 
               pLastName.startsWith(searchLastName)
      })

      if (player) {
        await prisma.player.update({
          where: { id: player.id },
          data: { winningsEligible: true }
        })
        console.log(`✓ Set ${player.firstName} ${player.lastName} (matched ${firstName} ${lastName}) to eligible`)
        updatedCount++
      } else {
        console.log(`✗ Could not find player matching: ${firstName} ${lastName}`)
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

