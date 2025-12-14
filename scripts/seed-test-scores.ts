import { prisma } from '../lib/prisma'
import { processCompletedRound } from '../lib/handicap-calculator'

/**
 * Seed test scores for first 10 rounds
 * Creates realistic golf scores with variation
 */

async function seedTestScores() {
  console.log('Fetching players and leagues...')
  
  // Get all leagues and their players
  const leagues = await prisma.league.findMany({
    include: {
      players: true
    }
  })

  if (leagues.length === 0) {
    console.log('No leagues found. Please create leagues first.')
    return
  }

  // Use Clarksville league (or first league with players)
  let league = leagues.find(l => l.name === 'Clarksville' && l.players.length >= 3)
  if (!league) {
    league = leagues.find(l => l.players.length >= 3)
  }
  if (!league) {
    league = leagues[0] // Fallback to first league
  }
  console.log(`Using league: ${league.name} (ID: ${league.id})`)

  if (league.players.length === 0) {
    console.log('No players found in league. Please add players first.')
    return
  }

  const players = league.players.slice(0, 3) // Get first 3 players
  console.log(`Creating scores for ${players.length} players:`)
  players.forEach(p => console.log(`  - ${p.firstName} ${p.lastName}`))

  // Create weeks 1-11 (need week 11 to set handicap after week 10)
  console.log('\nCreating weeks 1-11...')
  const weeks = []
  for (let weekNum = 1; weekNum <= 11; weekNum++) {
    let week = await prisma.week.findFirst({
      where: {
        leagueId: league.id,
        weekNumber: weekNum,
        isChampionship: false
      }
    })
    
    if (!week) {
      week = await prisma.week.create({
        data: {
          leagueId: league.id,
          weekNumber: weekNum,
          isChampionship: false
        }
      })
    }
    weeks.push(week)
  }

  // Generate scores for each round
  // Player 1: Good player (scores 70-75)
  // Player 2: Average player (scores 75-82)
  // Player 3: Struggling player (scores 80-90)
  
  const scoreRanges = [
    [70, 75], // Player 1
    [75, 82], // Player 2
    [80, 90]  // Player 3
  ]

  console.log('\nCreating scores for rounds 1-10...')
  
  for (let round = 1; round <= 10; round++) {
    console.log(`\nRound ${round}:`)
    const week = weeks[round - 1]
    
    // Generate scores with some variation
    const roundScores: number[] = []
    
    for (let i = 0; i < players.length; i++) {
      const [min, max] = scoreRanges[i]
      // Add some randomness and slight improvement over time
      const baseScore = min + Math.floor(Math.random() * (max - min + 1))
      const improvement = Math.floor((round - 1) * 0.3) // Slight improvement
      const variation = Math.floor(Math.random() * 5) - 2 // -2 to +2
      const total = Math.max(min - 5, baseScore - improvement + variation)
      
      roundScores.push(total)
      
      // Create score record
      const front9 = Math.floor(total * 0.48) // Roughly 48% front 9
      const back9 = total - front9
      
      // Check if score exists
      const existingScore = await prisma.score.findFirst({
        where: {
          playerId: players[i].id,
          weekId: week.id
        }
      })

      const scoreData = {
        total,
        front9,
        back9,
        hole1: Math.floor(front9 / 9) + (Math.random() > 0.5 ? 1 : 0),
        hole2: Math.floor(front9 / 9),
        hole3: Math.floor(front9 / 9),
        hole4: Math.floor(front9 / 9),
        hole5: Math.floor(front9 / 9),
        hole6: Math.floor(front9 / 9),
        hole7: Math.floor(front9 / 9),
        hole8: Math.floor(front9 / 9),
        hole9: front9 - Math.floor(front9 / 9) * 8,
        hole10: Math.floor(back9 / 9),
        hole11: Math.floor(back9 / 9),
        hole12: Math.floor(back9 / 9),
        hole13: Math.floor(back9 / 9),
        hole14: Math.floor(back9 / 9),
        hole15: Math.floor(back9 / 9),
        hole16: Math.floor(back9 / 9),
        hole17: Math.floor(back9 / 9),
        hole18: back9 - Math.floor(back9 / 9) * 8,
      }

      if (existingScore) {
        await prisma.score.update({
          where: { id: existingScore.id },
          data: scoreData
        })
      } else {
        await prisma.score.create({
          data: {
            playerId: players[i].id,
            weekId: week.id,
            ...scoreData
          }
        })
      }
      
      console.log(`  ${players[i].firstName} ${players[i].lastName}: ${total}`)
    }
    
    // Process the round to calculate handicaps
    console.log(`  Processing round ${round} for handicap calculation...`)
    await processCompletedRound(league.id, round)
  }

  // Verify week 11 handicap is set
  console.log('\n\nVerifying Week 11 handicaps are set...')
  const week11 = weeks[10]
  for (const player of players) {
    const handicap = await prisma.handicap.findUnique({
      where: {
        playerId_weekId: {
          playerId: player.id,
          weekId: week11.id
        }
      }
    })
    
    if (handicap) {
      console.log(`  ${player.firstName} ${player.lastName}: Applied Handicap = ${handicap.appliedHandicap || handicap.handicap}`)
    } else {
      console.log(`  ${player.firstName} ${player.lastName}: No handicap set (this is expected if they don't have enough rounds)`)
    }
  }

  console.log('\n✅ Test scores created successfully!')
}

seedTestScores()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

