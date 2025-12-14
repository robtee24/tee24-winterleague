import { recalculateAllHandicaps } from '../lib/handicap-calculator'
import { prisma } from '../lib/prisma'

async function main() {
  const leagueId = process.argv[2] ? parseInt(process.argv[2]) : 2 // Default to Clarksville
  
  console.log(`Recalculating handicaps for league ${leagueId}...`)
  
  await recalculateAllHandicaps(leagueId)
  
  console.log('✅ Handicaps recalculated successfully!')
  
  // Show Bill Betcha's handicaps as example
  const bill = await prisma.player.findFirst({
    where: {
      leagueId,
      firstName: { contains: 'Bill', mode: 'insensitive' }
    },
    include: {
      handicaps: {
        include: {
          week: true
        },
        orderBy: {
          week: {
            weekNumber: 'asc'
          }
        }
      }
    }
  })
  
  if (bill) {
    console.log(`\n${bill.firstName} ${bill.lastName} Handicaps:`)
    bill.handicaps.forEach(h => {
      console.log(`  Week ${h.week.weekNumber}: Applied = ${h.appliedHandicap ?? h.handicap}, Raw = ${h.rawHandicap ?? 'N/A'}`)
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
