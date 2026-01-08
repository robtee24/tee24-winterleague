import { PrismaClient } from '@prisma/client'
import { calculateBaseline, getPlayerRawHandicaps } from '../lib/handicap-calculator'

const prisma = new PrismaClient()

async function applyBaselineToWeeks1to3() {
  try {
    // Get Clarksville league
    const clarksvilleLeague = await prisma.league.findUnique({
      where: { name: 'Clarksville' }
    })

    if (!clarksvilleLeague) {
      console.error('Clarksville league not found')
      return
    }

    console.log(`Processing league: ${clarksvilleLeague.name} (ID: ${clarksvilleLeague.id})`)

    // Check if week 3 is complete
    const week3 = await prisma.week.findFirst({
      where: {
        leagueId: clarksvilleLeague.id,
        weekNumber: 3,
        isChampionship: false
      }
    })

    if (!week3) {
      console.log('Week 3 not found')
      return
    }

    // Check if all players have submitted for week 3
    const allPlayers = await prisma.player.findMany({
      where: { leagueId: clarksvilleLeague.id }
    })

    const week3Scores = await prisma.score.findMany({
      where: {
        weekId: week3.id,
        total: { not: null }
      }
    })

    const playersWithScores = new Set(week3Scores.map(s => s.playerId))
    const allSubmitted = allPlayers.length > 0 && playersWithScores.size === allPlayers.length

    if (!allSubmitted) {
      console.log(`Week 3 is not complete. ${playersWithScores.size}/${allPlayers.length} players have submitted.`)
      return
    }

    console.log('Week 3 is complete. Applying baseline to weeks 1-3...\n')

    // Process each player
    for (const player of allPlayers) {
      const rawHandicaps = await getPlayerRawHandicaps(player.id, clarksvilleLeague.id, 3)
      
      if (rawHandicaps.length < 3) {
        console.log(`Player ${player.firstName} ${player.lastName}: Only ${rawHandicaps.length} rounds, skipping`)
        continue
      }
      
      const baseline = calculateBaseline(rawHandicaps)
      console.log(`Player ${player.firstName} ${player.lastName}: Baseline = ${baseline} (from raw handicaps: ${rawHandicaps.join(', ')})`)
      
      // Apply baseline to weeks 1-3
      for (let weekNum = 1; weekNum <= 3; weekNum++) {
        const weeks = await prisma.week.findMany({
          where: {
            leagueId: clarksvilleLeague.id,
            weekNumber: weekNum,
            isChampionship: false
          }
        })
        
        for (const week of weeks) {
          // Update handicap record
          await prisma.handicap.upsert({
            where: {
              playerId_weekId: {
                playerId: player.id,
                weekId: week.id
              }
            },
            update: {
              appliedHandicap: baseline,
              handicap: baseline,
              isBaseline: true
            },
            create: {
              playerId: player.id,
              weekId: week.id,
              appliedHandicap: baseline,
              handicap: baseline,
              isBaseline: true,
              rawHandicap: rawHandicaps[weekNum - 1] || null
            }
          })
          
          // Update weighted scores
          const scores = await prisma.score.findMany({
            where: {
              playerId: player.id,
              weekId: week.id
            }
          })
          
          for (const score of scores) {
            if (score.total !== null && score.total !== undefined) {
              const weightedScore = Math.round(score.total - baseline)
              await prisma.score.update({
                where: { id: score.id },
                data: { weightedScore }
              })
              console.log(`  Week ${weekNum}: Score ${score.id} - Total: ${score.total}, Handicap: ${baseline}, Weighted: ${weightedScore}`)
            }
          }
        }
      }
      
      console.log('')
    }

    console.log('✅ Successfully applied baseline to weeks 1-3!')
  } catch (error) {
    console.error('Error applying baseline:', error)
  } finally {
    await prisma.$disconnect()
  }
}

applyBaselineToWeeks1to3()



