import { PrismaClient } from '@prisma/client'
import { processCompletedRound } from '../lib/handicap-calculator'

const prisma = new PrismaClient()

// Generate realistic golf scores (typically 70-100 range)
function generateGolfScore(baseScore: number, variance: number = 5): number[] {
  const scores: number[] = []
  let total = 0
  
  // Generate 18 holes with some variance
  for (let i = 0; i < 18; i++) {
    // Par is typically 3-5 per hole, so average around 4
    const holeScore = Math.round(baseScore / 18 + (Math.random() - 0.5) * variance)
    const finalScore = Math.max(2, Math.min(8, holeScore)) // Keep scores between 2-8 per hole
    scores.push(finalScore)
    total += finalScore
  }
  
  // Adjust to match target total
  const diff = baseScore - total
  if (diff !== 0) {
    // Distribute the difference across holes
    const adjustment = Math.sign(diff)
    let remaining = Math.abs(diff)
    let index = 0
    while (remaining > 0 && index < 18) {
      const newScore = scores[index] + adjustment
      if (newScore >= 2 && newScore <= 8) {
        scores[index] = newScore
        remaining--
      }
      index++
      if (index >= 18) index = 0
    }
  }
  
  return scores
}

async function createTestData() {
  try {
    // Get Clarksville league
    const league = await prisma.league.findFirst({
      where: { name: 'Clarksville' }
    })
    
    if (!league) {
      throw new Error('Clarksville league not found')
    }
    
    console.log('Found league:', league.name)
    
    // Get existing players
    const existingPlayers = await prisma.player.findMany({
      where: { leagueId: league.id }
    })
    
    console.log(`Found ${existingPlayers.length} existing players`)
    
    // Add 5 new test players
    const newPlayerNames = [
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Brown' },
      { firstName: 'Charlie', lastName: 'Clark' },
      { firstName: 'Diana', lastName: 'Davis' },
      { firstName: 'Eve', lastName: 'Evans' }
    ]
    
    const newPlayers = []
    for (const name of newPlayerNames) {
      const player = await prisma.player.create({
        data: {
          firstName: name.firstName,
          lastName: name.lastName,
          leagueId: league.id
        }
      })
      newPlayers.push(player)
      console.log(`Created player: ${player.firstName} ${player.lastName}`)
    }
    
    const allPlayers = [...existingPlayers, ...newPlayers]
    console.log(`Total players: ${allPlayers.length}`)
    
    // Create weeks 1-6 if they don't exist
    const weeks = []
    for (let weekNum = 1; weekNum <= 6; weekNum++) {
      const week = await prisma.week.upsert({
        where: {
          // Use a unique constraint if it exists, otherwise find first
          id: -1 // This will fail, so we'll use findFirst + create
        },
        update: {},
        create: {
          weekNumber: weekNum,
          leagueId: league.id,
          isChampionship: false
        }
      }).catch(async () => {
        // Week might already exist, find it
        return await prisma.week.findFirst({
          where: {
            weekNumber: weekNum,
            leagueId: league.id,
            isChampionship: false
          }
        }) || await prisma.week.create({
          data: {
            weekNumber: weekNum,
            leagueId: league.id,
            isChampionship: false
          }
        })
      })
      
      if (week) {
        weeks.push(week)
        console.log(`Week ${weekNum} ready (ID: ${week.id})`)
      }
    }
    
    // Create scores for all players for all 6 weeks
    // Use different base scores to create variety
    const playerBaseScores: { [key: number]: number } = {}
    allPlayers.forEach((player, index) => {
      // Vary base scores from 75 to 95
      playerBaseScores[player.id] = 75 + (index * 3) + Math.floor(Math.random() * 5)
    })
    
    console.log('\nCreating scores...')
    for (const week of weeks) {
      console.log(`\nWeek ${week.weekNumber}:`)
      
      // Find round low for this week (will be the lowest base score)
      const roundLow = Math.min(...Object.values(playerBaseScores))
      
      for (const player of allPlayers) {
        // Generate score with some variance
        const baseScore = playerBaseScores[player.id]
        const variance = 3 + Math.random() * 4 // 3-7 stroke variance
        const totalScore = Math.round(baseScore + (Math.random() - 0.5) * variance)
        
        const holeScores = generateGolfScore(totalScore, 2)
        const front9 = holeScores.slice(0, 9).reduce((a, b) => a + b, 0)
        const back9 = holeScores.slice(9, 18).reduce((a, b) => a + b, 0)
        const total = front9 + back9
        
        // Create score
        const score = await prisma.score.create({
          data: {
            playerId: player.id,
            weekId: week.id,
            hole1: holeScores[0],
            hole2: holeScores[1],
            hole3: holeScores[2],
            hole4: holeScores[3],
            hole5: holeScores[4],
            hole6: holeScores[5],
            hole7: holeScores[6],
            hole8: holeScores[7],
            hole9: holeScores[8],
            hole10: holeScores[9],
            hole11: holeScores[10],
            hole12: holeScores[11],
            hole13: holeScores[12],
            hole14: holeScores[13],
            hole15: holeScores[14],
            hole16: holeScores[15],
            hole17: holeScores[16],
            hole18: holeScores[17],
            front9,
            back9,
            total,
            weightedScore: total // Will be recalculated by processCompletedRound
          }
        })
        
        console.log(`  ${player.firstName} ${player.lastName}: ${total} (${front9}/${back9})`)
      }
      
      // Process the completed round to calculate handicaps
      console.log(`  Processing round ${week.weekNumber}...`)
      await processCompletedRound(league.id, week.weekNumber)
      console.log(`  Week ${week.weekNumber} processed`)
    }
    
    console.log('\n✅ Test data created successfully!')
    console.log(`   - ${allPlayers.length} players`)
    console.log(`   - ${weeks.length} weeks`)
    console.log(`   - ${allPlayers.length * weeks.length} scores`)
    
  } catch (error) {
    console.error('Error creating test data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestData()



