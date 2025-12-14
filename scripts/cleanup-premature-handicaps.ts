import { prisma } from '../lib/prisma'
import { allPlayersSubmitted } from '../lib/handicap-calculator'

/**
 * Remove handicaps for weeks where the prior week is not complete
 */
async function cleanupPrematureHandicaps() {
  const leagues = await prisma.league.findMany()
  
  for (const league of leagues) {
    console.log(`\nProcessing league: ${league.name}`)
    
    // Check each week from 2 to 11
    for (let weekNum = 2; weekNum <= 11; weekNum++) {
      const priorWeekComplete = await allPlayersSubmitted(league.id, weekNum - 1)
      
      if (!priorWeekComplete) {
        // Prior week not complete, remove handicaps for this week
        const weeks = await prisma.week.findMany({
          where: {
            leagueId: league.id,
            weekNumber: weekNum,
            isChampionship: false
          }
        })
        
        if (weeks.length > 0) {
          const weekIds = weeks.map(w => w.id)
          const deleted = await prisma.handicap.deleteMany({
            where: {
              weekId: { in: weekIds }
            }
          })
          
          if (deleted.count > 0) {
            console.log(`  Week ${weekNum}: Deleted ${deleted.count} handicaps (Week ${weekNum - 1} not complete)`)
          }
        }
      }
    }
  }
  
  console.log('\n✅ Cleanup complete')
}

cleanupPrematureHandicaps()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


