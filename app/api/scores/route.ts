import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processCompletedRound, calculateAppliedHandicap, ensureAllWeightedScores, recalculateAllHandicaps } from '@/lib/handicap-calculator'

/**
 * Check if a score has hole-by-hole data
 */
function hasHoleScores(score: any): boolean {
  if (!score) return false
  // Check if at least one hole has a value
  for (let i = 1; i <= 18; i++) {
    const holeKey = `hole${i}` as keyof typeof score
    if (score[holeKey] !== null && score[holeKey] !== undefined) {
      return true
    }
  }
  return false
}

/**
 * Extract hole scores from a score record
 */
function extractHoleScores(score: any): number[] {
  return [
    score.hole1 ?? 0, score.hole2 ?? 0, score.hole3 ?? 0,
    score.hole4 ?? 0, score.hole5 ?? 0, score.hole6 ?? 0,
    score.hole7 ?? 0, score.hole8 ?? 0, score.hole9 ?? 0,
    score.hole10 ?? 0, score.hole11 ?? 0, score.hole12 ?? 0,
    score.hole13 ?? 0, score.hole14 ?? 0, score.hole15 ?? 0,
    score.hole16 ?? 0, score.hole17 ?? 0, score.hole18 ?? 0
  ]
}

/**
 * Get team scores, handling cases where a player only has total score
 * If one player has no hole scores, use the teammate's scores
 */
function getTeamScores(player1Score: any, player2Score: any): number[][] {
  const player1HasHoles = hasHoleScores(player1Score)
  const player2HasHoles = hasHoleScores(player2Score)

  // If both have hole scores, use both
  if (player1HasHoles && player2HasHoles) {
    return [
      extractHoleScores(player1Score),
      extractHoleScores(player2Score)
    ]
  }

  // If only player1 has hole scores, use player1's scores for both
  if (player1HasHoles && !player2HasHoles) {
    const player1Scores = extractHoleScores(player1Score)
    return [player1Scores, player1Scores]
  }

  // If only player2 has hole scores, use player2's scores for both
  if (!player1HasHoles && player2HasHoles) {
    const player2Scores = extractHoleScores(player2Score)
    return [player2Scores, player2Scores]
  }

  // If neither has hole scores, return empty arrays (will be skipped)
  return [[], []]
}

/**
 * Calculate Best Ball Match Play score
 * For each hole, compare lowest score from each team
 * Lower score gets 1 point, ties get 0 points
 */
function calculateMatchPlay(team1Scores: number[][], team2Scores: number[][]): { team1Points: number; team2Points: number } {
  let team1Points = 0
  let team2Points = 0

  for (let hole = 0; hole < 18; hole++) {
    // Get lowest score for each team on this hole
    const team1HoleScores = team1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
    const team2HoleScores = team2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)

    if (team1HoleScores.length === 0 || team2HoleScores.length === 0) {
      continue // Skip holes where no scores are available
    }

    const team1Low = Math.min(...team1HoleScores)
    const team2Low = Math.min(...team2HoleScores)

    if (team1Low < team2Low) {
      team1Points++
    } else if (team2Low < team1Low) {
      team2Points++
    }
    // If tied, no points awarded
  }

  return { team1Points, team2Points }
}

/**
 * Calculate all matches for a week
 */
async function calculateMatchesForWeek(weekId: number) {
  // Get the week to find weekNumber and leagueId
  const week = await prisma.week.findUnique({
    where: { id: weekId }
  })

  if (!week) {
    console.error(`Week ${weekId} not found`)
    return
  }

  const matches = await prisma.match.findMany({
    where: { weekId },
    include: {
      team1: {
        include: {
          player1: true,
          player2: true,
          league: true
        }
      },
      team2: {
        include: {
          player1: true,
          player2: true
        }
      },
      week: true
    }
  })

  for (const match of matches) {
    if (!match.team2Id || !match.team2) continue // Skip matches without opponents

    // TypeScript guard: we know team2 exists after the check above
    const team2 = match.team2

    // Get scores for team 1 players - try weekId first, then fallback to weekNumber
    let team1Player1Score = await prisma.score.findFirst({
      where: {
        playerId: match.team1.player1Id,
        weekId: weekId
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })

    // If not found by weekId, try by weekNumber (handles duplicate weeks)
    if (!team1Player1Score) {
      team1Player1Score = await prisma.score.findFirst({
        where: {
          playerId: match.team1.player1Id,
          week: {
            leagueId: week.leagueId,
            weekNumber: week.weekNumber,
            isChampionship: week.isChampionship
          }
        },
        include: {
          week: true
        },
        orderBy: { id: 'desc' }
      })
    }

    console.log(`Match ${match.id} - Week ${week.weekNumber} (weekId: ${weekId}): Looking for scores for Team ${match.team1.teamNumber} (Player1: ${match.team1.player1Id}, Player2: ${match.team1.player2Id}) vs Team ${team2.teamNumber} (Player1: ${team2.player1Id}, Player2: ${team2.player2Id})`)
    console.log(`  Team1 Player1 Score found: ${team1Player1Score ? `Yes (ID: ${team1Player1Score.id}, weekId: ${team1Player1Score.weekId}, has holes: ${hasHoleScores(team1Player1Score)})` : 'No'}`)

    // Get team1 player2 score - try weekId first, then weekNumber
    let team1Player2Score = await prisma.score.findFirst({
      where: {
        playerId: match.team1.player2Id,
        weekId: weekId
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })
    if (!team1Player2Score) {
      team1Player2Score = await prisma.score.findFirst({
        where: {
          playerId: match.team1.player2Id,
          week: {
            leagueId: week.leagueId,
            weekNumber: week.weekNumber,
            isChampionship: week.isChampionship
          }
        },
        include: {
          week: true
        },
        orderBy: { id: 'desc' }
      })
    }

    // Get scores for team 2 players - try weekId first, then weekNumber
    let team2Player1Score = await prisma.score.findFirst({
      where: {
        playerId: team2.player1Id,
        weekId: weekId
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })
    if (!team2Player1Score) {
      team2Player1Score = await prisma.score.findFirst({
        where: {
          playerId: team2.player1Id,
          week: {
            leagueId: week.leagueId,
            weekNumber: week.weekNumber,
            isChampionship: week.isChampionship
          }
        },
        include: {
          week: true
        },
        orderBy: { id: 'desc' }
      })
    }

    let team2Player2Score = await prisma.score.findFirst({
      where: {
        playerId: team2.player2Id,
        weekId: weekId
      },
      include: {
        week: true
      },
      orderBy: { id: 'desc' }
    })
    if (!team2Player2Score) {
      team2Player2Score = await prisma.score.findFirst({
        where: {
          playerId: team2.player2Id,
          week: {
            leagueId: week.leagueId,
            weekNumber: week.weekNumber,
            isChampionship: week.isChampionship
          }
        },
        include: {
          week: true
        },
        orderBy: { id: 'desc' }
      })
    }

    console.log(`  Team1 Player2 Score found: ${team1Player2Score ? `Yes (ID: ${team1Player2Score.id}, has holes: ${hasHoleScores(team1Player2Score)})` : 'No'}`)
    console.log(`  Team2 Player1 Score found: ${team2Player1Score ? `Yes (ID: ${team2Player1Score.id}, has holes: ${hasHoleScores(team2Player1Score)})` : 'No'}`)
    console.log(`  Team2 Player2 Score found: ${team2Player2Score ? `Yes (ID: ${team2Player2Score.id}, has holes: ${hasHoleScores(team2Player2Score)})` : 'No'}`)

    // Check if at least one player from each team has a score
    if (!team1Player1Score && !team1Player2Score) {
      continue // Skip if team 1 has no scores
    }

    if (!team2Player1Score && !team2Player2Score) {
      continue // Skip if team 2 has no scores
    }

    // Get team scores (handling cases where players only have total scores)
    const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
    const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

    console.log(`  Team1 scores: ${team1Scores.length} players, Team2 scores: ${team2Scores.length} players`)
    console.log(`  Team1 has valid scores: ${team1Scores.length > 0 && team1Scores[0].length > 0 && !team1Scores.every(s => s.every(h => h === 0))}`)
    console.log(`  Team2 has valid scores: ${team2Scores.length > 0 && team2Scores[0].length > 0 && !team2Scores.every(s => s.every(h => h === 0))}`)

    // Check if we have valid scores for both teams
    if (team1Scores.length === 0 || team1Scores[0].length === 0 || team1Scores.every(s => s.every(h => h === 0))) {
      console.log(`  Skipping match ${match.id} - Team 1 has no valid hole-by-hole scores`)
      continue // Skip if team 1 has no hole-by-hole scores
    }

    if (team2Scores.length === 0 || team2Scores[0].length === 0 || team2Scores.every(s => s.every(h => h === 0))) {
      console.log(`  Skipping match ${match.id} - Team 2 has no valid hole-by-hole scores`)
      continue // Skip if team 2 has no hole-by-hole scores
    }

    // Calculate match play points
    const { team1Points, team2Points } = calculateMatchPlay(team1Scores, team2Scores)
    
    console.log(`  Calculated match points: Team1=${team1Points}, Team2=${team2Points}`)

    // Determine winner
    let winnerId: number | null = null
    if (team1Points > team2Points) {
      winnerId = match.team1Id
    } else if (team2Points > team1Points) {
      winnerId = team2.id
    }

    // Update match
    await prisma.match.update({
      where: { id: match.id },
      data: {
        team1Points,
        team2Points,
        winnerId
      }
    })
    
    console.log(`  Updated match ${match.id} with points: Team1=${team1Points}, Team2=${team2Points}, Winner=${winnerId || 'Tie'}`)
  }
  
  console.log(`Finished calculating matches for week ${week.weekNumber} (weekId: ${weekId})`)
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { playerId, weekId, scores, scorecardImage } = data

    console.log('Creating score with data:', { playerId, weekId, scoresLength: scores?.length, scorecardImage })

    // Validate required fields
    if (!playerId || !weekId) {
      return NextResponse.json({ error: 'playerId and weekId are required' }, { status: 400 })
    }

    if (!scores || !Array.isArray(scores) || scores.length !== 18) {
      return NextResponse.json({ 
        error: `scores must be an array of 18 values. Received: ${scores ? (Array.isArray(scores) ? scores.length : typeof scores) : 'null/undefined'}` 
      }, { status: 400 })
    }

    // Convert scores to numbers and validate
    const numericScores = scores.map((s, i) => {
      const num = typeof s === 'string' ? parseInt(s, 10) : Number(s)
      if (isNaN(num)) {
        console.warn(`Score at index ${i} is not a number:`, s)
        return 0
      }
      return num
    })

    // Calculate front 9, back 9, and total
    const front9 = numericScores.slice(0, 9).reduce((sum: number, score: number) => sum + (score || 0), 0)
    const back9 = numericScores.slice(9, 18).reduce((sum: number, score: number) => sum + (score || 0), 0)
    const total = front9 + back9

    // Get the week to determine weekNumber
    const week = await prisma.week.findUnique({
      where: { id: parseInt(weekId) },
      include: { league: true }
    })

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 })
    }

    // Get applied handicap for this round
    let appliedHandicap = 0
    try {
      appliedHandicap = await calculateAppliedHandicap(
        parseInt(playerId),
        week.leagueId,
        week.weekNumber
      )
    } catch (handicapError: any) {
      console.error('Error calculating applied handicap:', handicapError)
      // Use 0 as default handicap if calculation fails
      appliedHandicap = 0
    }

    // Calculate weighted score: unweighted score (total) minus applied handicap
    const weightedScore = Math.round(total - appliedHandicap)
    
    console.log('Calculated values:', { front9, back9, total, appliedHandicap, weightedScore })

    // Check if a score already exists for this player/week combination
    // Handle duplicate weeks by finding the most recent score for this weekNumber
    const existingScores = await prisma.score.findMany({
      where: {
        playerId: parseInt(playerId),
        week: {
          weekNumber: week.weekNumber,
          leagueId: week.leagueId,
          isChampionship: week.isChampionship
        }
      },
      orderBy: {
        id: 'desc' // Most recent first
      }
    })

    let score
    if (existingScores.length > 0) {
      // Update the most recent existing score
      score = await prisma.score.update({
        where: { id: existingScores[0].id },
        data: {
          hole1: numericScores[0] || null,
          hole2: numericScores[1] || null,
          hole3: numericScores[2] || null,
          hole4: numericScores[3] || null,
          hole5: numericScores[4] || null,
          hole6: numericScores[5] || null,
          hole7: numericScores[6] || null,
          hole8: numericScores[7] || null,
          hole9: numericScores[8] || null,
          hole10: numericScores[9] || null,
          hole11: numericScores[10] || null,
          hole12: numericScores[11] || null,
          hole13: numericScores[12] || null,
          hole14: numericScores[13] || null,
          hole15: numericScores[14] || null,
          hole16: numericScores[15] || null,
          hole17: numericScores[16] || null,
          hole18: numericScores[17] || null,
          front9,
          back9,
          total,
          weightedScore,
          scorecardImage: scorecardImage !== undefined ? scorecardImage : existingScores[0].scorecardImage // Preserve existing image if not provided
        }
      })
      
      // Delete any other duplicate scores for this player/week
      if (existingScores.length > 1) {
        const duplicateIds = existingScores.slice(1).map(s => s.id)
        await prisma.score.deleteMany({
          where: {
            id: { in: duplicateIds }
          }
        })
      }
    } else {
      // Create new score record
      console.log('Creating new score with data:', {
        playerId: parseInt(playerId),
        weekId: parseInt(weekId),
        front9,
        back9,
        total,
        weightedScore
      })
      
      try {
        score = await prisma.score.create({
          data: {
            playerId: parseInt(playerId),
            weekId: parseInt(weekId),
            hole1: numericScores[0] || null,
            hole2: numericScores[1] || null,
            hole3: numericScores[2] || null,
            hole4: numericScores[3] || null,
            hole5: numericScores[4] || null,
            hole6: numericScores[5] || null,
            hole7: numericScores[6] || null,
            hole8: numericScores[7] || null,
            hole9: numericScores[8] || null,
            hole10: numericScores[9] || null,
            hole11: numericScores[10] || null,
            hole12: numericScores[11] || null,
            hole13: numericScores[12] || null,
            hole14: numericScores[13] || null,
            hole15: numericScores[14] || null,
            hole16: numericScores[15] || null,
            hole17: numericScores[16] || null,
            hole18: numericScores[17] || null,
            front9,
            back9,
            total,
            weightedScore,
            scorecardImage: scorecardImage || null
          }
        })
        console.log('Score created successfully:', score.id)
      } catch (createError: any) {
        console.error('Prisma create error:', createError)
        console.error('Error code:', createError?.code)
        console.error('Error meta:', createError?.meta)
        throw createError // Re-throw to be caught by outer catch
      }
    }

    console.log('Score created with image URL:', score.scorecardImage)
    
    // Check if all players have submitted total scores for this week
    // If so, calculate matches and process handicaps for next week
    const checkAndProcessWeek = async () => {
      try {
        // Get all players in the league
        const allPlayers = await prisma.player.findMany({
          where: { leagueId: week.leagueId }
        })

        // Get all scores for this week that have a total (unweighted total score)
        const weekScores = await prisma.score.findMany({
          where: {
            weekId: parseInt(weekId),
            total: { not: null }
          },
          select: { playerId: true }
        })

        const uniquePlayersWithScores = new Set(weekScores.map(s => s.playerId))
        const allPlayersSubmitted = allPlayers.length > 0 && uniquePlayersWithScores.size === allPlayers.length

        if (allPlayersSubmitted) {
          console.log(`All players have submitted scores for week ${week.weekNumber}. Processing...`)
          
          // Process the round to calculate raw handicaps and update handicaps
          await processCompletedRound(week.leagueId, week.weekNumber)
          console.log(`Successfully processed round ${week.weekNumber} for league ${week.leagueId}`)
          
          // IMPORTANT: Recalculate ALL players' handicaps when the week is complete
          // This ensures all players get their handicaps updated, not just the one who submitted
          console.log(`Recalculating all handicaps for league ${week.leagueId}...`)
          try {
            await recalculateAllHandicaps(week.leagueId)
            console.log(`Successfully recalculated all handicaps for league ${week.leagueId}`)
          } catch (recalcError) {
            console.error('Error recalculating all handicaps:', recalcError)
            // Don't throw - continue with other processing
          }
          
          // Calculate matches for this week
          await calculateMatchesForWeek(parseInt(weekId))
          console.log(`Successfully calculated matches for week ${week.weekNumber}`)

          // If this is week 4 or later, calculate handicaps for next week
          // (Weeks 1-4 don't use progressive handicaps until after week 3)
          // Note: recalculateAllHandicaps already handles this, but we ensure next week's applied handicaps are set
          if (week.weekNumber >= 4 && !week.isChampionship && week.weekNumber < 12) {
            const nextWeekNumber = week.weekNumber + 1
            // Find the next week
            const nextWeek = await prisma.week.findFirst({
              where: {
                leagueId: week.leagueId,
                weekNumber: nextWeekNumber,
                isChampionship: false
              }
            })

            if (nextWeek) {
              // Calculate applied handicaps for next week
              for (const player of allPlayers) {
                try {
                  await calculateAppliedHandicap(player.id, week.leagueId, nextWeekNumber)
                } catch (error) {
                  console.error(`Error calculating handicap for player ${player.id} for week ${nextWeekNumber}:`, error)
                }
              }
              console.log(`Calculated handicaps for week ${nextWeekNumber}`)
            }
          }
        } else {
          console.log(`Week ${week.weekNumber} not complete yet. ${uniquePlayersWithScores.size}/${allPlayers.length} players have submitted scores.`)
          // Still calculate matches for this week (in case some matches can be calculated)
          await calculateMatchesForWeek(parseInt(weekId))
        }
      } catch (error) {
        console.error('Error in checkAndProcessWeek:', error)
      }
    }

    // Run asynchronously to not block the response
    checkAndProcessWeek().catch(error => {
      console.error('Error processing week completion:', error)
    })
    
    // Also run legacy code for backward compatibility (will be redundant if week is complete)
    processCompletedRound(week.leagueId, week.weekNumber)
      .then(() => {
        console.log(`Successfully processed round ${week.weekNumber} for league ${week.leagueId}`)
        // Calculate matches for this week
        return calculateMatchesForWeek(parseInt(weekId))
      })
      .then(() => {
        console.log(`Successfully calculated matches for week ${week.weekNumber}`)
        // After processing, check if all players submitted and log next week's handicap status
        return prisma.player.count({ where: { leagueId: week.leagueId } })
          .then(totalPlayers => {
            return prisma.score.count({
              where: {
                week: {
                  leagueId: week.leagueId,
                  weekNumber: week.weekNumber,
                  isChampionship: week.isChampionship
                },
                total: { not: null }
              }
            }).then(scoreCount => {
              console.log(`Week ${week.weekNumber}: ${scoreCount}/${totalPlayers} players have submitted`)
              if (scoreCount >= totalPlayers) {
                console.log(`All players submitted for week ${week.weekNumber}, next week's handicap should be calculated`)
                // Check if next week exists and has handicaps
                return prisma.week.findFirst({
                  where: {
                    leagueId: week.leagueId,
                    weekNumber: week.weekNumber + 1,
                    isChampionship: false
                  }
                }).then(nextWeek => {
                  if (nextWeek) {
                    return prisma.handicap.count({
                      where: {
                        weekId: nextWeek.id
                      }
                    }).then(handicapCount => {
                      console.log(`Week ${week.weekNumber + 1} has ${handicapCount} handicap records`)
                    })
                  }
                })
              }
            })
          })
      })
      .catch(error => {
        console.error('Error processing completed round:', error)
        console.error('Error stack:', error?.stack)
      })
    
    // Ensure weighted score is calculated (fallback)
    if (score.total !== null && score.total !== undefined) {
      ensureAllWeightedScores(week.leagueId).catch(error => {
        console.error('Error ensuring weighted scores:', error)
      })
    }
    
    return NextResponse.json(score)
  } catch (error: any) {
    console.error('Error creating score:', error)
    const errorMessage = error?.message || 'Failed to create score'
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const weekId = searchParams.get('weekId')
    const weekNumber = searchParams.get('weekNumber')
    const playerId = searchParams.get('playerId')
    const leagueId = searchParams.get('leagueId')

    const where: any = {}
    if (weekId) where.weekId = parseInt(weekId)
    if (playerId) where.playerId = parseInt(playerId)
    if (leagueId) {
      where.player = { leagueId: parseInt(leagueId) }
    }
    if (weekNumber) {
      where.week = {
        weekNumber: parseInt(weekNumber),
        isChampionship: false
      }
      if (leagueId) {
        where.week.leagueId = parseInt(leagueId)
      }
    }

    const scores = await prisma.score.findMany({
      where,
      include: {
        player: true,
        week: true
      },
      orderBy: [
        { week: { weekNumber: 'asc' } },
        { player: { firstName: 'asc' } }
      ]
    })

    return NextResponse.json(scores)
  } catch (error) {
    console.error('Error fetching scores:', error)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

