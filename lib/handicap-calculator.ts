import { prisma } from './prisma'

/**
 * Handicap Calculation System
 * 
 * RAW HANDICAP: For each week, calculated as (Player Score - Round Low), capped at 25.
 * This represents "strokes back from the lead" for that specific week.
 * 
 * APPLIED HANDICAP: The handicap used to calculate weighted scores (total - appliedHandicap)
 * 
 * Weeks 1-3: No handicap (0) - all players play straight up
 * 
 * Week 4: Uses BASELINE handicap - average of raw handicaps from weeks 1-3
 * 
 * Weeks 5+: Uses PROGRESSIVE HANDICAP - average of raw handicaps from ALL previous weeks
 *   - Week 5: average of weeks 1-4 raw handicaps
 *   - Week 6: average of weeks 1-5 raw handicaps
 *   - Week 7: average of weeks 1-6 raw handicaps
 *   - etc.
 * 
 * Progressive means each week's handicap uses ALL previous weeks' raw handicaps (strokes back from the lead),
 * not just a rolling window. This gives a true average performance across all completed rounds.
 * 
 * CALCULATION TRIGGER: Handicaps are automatically recalculated when the last score for a week is submitted.
 * This ensures all handicaps use complete data from previous weeks.
 */

/**
 * Calculate raw handicap for a player in a round
 * Raw handicap = (Player Score - Round Low), capped at 25
 * This represents "strokes back from the lead" for that specific week
 */
export function calculateRawHandicap(playerScore: number, roundLow: number): number {
  const raw = playerScore - roundLow
  return Math.max(0, Math.min(25, Math.round(raw)))
}

/**
 * Calculate average of raw handicaps (standard rounding)
 */
export function calculateAverage(rawHandicaps: number[]): number {
  if (rawHandicaps.length === 0) return 0
  
  const sum = rawHandicaps.reduce((a, b) => a + b, 0)
  const average = sum / rawHandicaps.length
  return Math.round(average) // Standard rounding
}

/**
 * Calculate baseline handicap (average of first 3 rounds' raw handicaps)
 * Uses standard rounding (0.5+ rounds up, <0.5 rounds down)
 */
export function calculateBaseline(rawHandicaps: number[]): number {
  if (rawHandicaps.length < 3) {
    throw new Error('Need at least 3 rounds to calculate baseline')
  }
  
  const firstThree = rawHandicaps.slice(0, 3)
  const sum = firstThree.reduce((a, b) => a + b, 0)
  const average = sum / 3
  return Math.round(average) // Standard rounding for baseline
}

/**
 * Get all raw handicaps for a player up to a specific week (excluding that week)
 * Uses the stored raw handicap from handicap records (handles duplicates by using most recent)
 */
export async function getPlayerRawHandicaps(
  playerId: number,
  leagueId: number,
  upToWeekNumber: number,
  excludeWeekNumber?: number
): Promise<number[]> {
  // Get unique week numbers up to the target week
  const weekNumbers = Array.from({ length: upToWeekNumber }, (_, i) => i + 1)
    .filter(w => !excludeWeekNumber || w !== excludeWeekNumber)
  
  const rawHandicaps: number[] = []
  
  for (const weekNum of weekNumbers) {
    // Get all handicaps for this player and weekNumber, then find the one with rawHandicap
    // This handles duplicate week records better
    const handicaps = await prisma.handicap.findMany({
      where: {
        playerId,
        week: {
          weekNumber: weekNum,
          leagueId,
          isChampionship: false
        },
        rawHandicap: {
          not: null
        }
      },
      include: {
        week: true
      },
      orderBy: [
        { updatedAt: 'desc' }, // Most recently updated
        { id: 'desc' } // Fallback to most recent ID
      ]
    })
    
    // Get the first one with a valid rawHandicap
    const handicap = handicaps.find(h => h.rawHandicap !== null && h.rawHandicap !== undefined)
    
    if (handicap && handicap.rawHandicap !== null && handicap.rawHandicap !== undefined) {
      rawHandicaps.push(handicap.rawHandicap)
    }
  }

  return rawHandicaps
}

/**
 * Calculate applied handicap for a specific week
 * - Weeks 1-3: No handicap (0)
 * - Week 4: Baseline (average of weeks 1-3 raw handicaps)
 * - Week 5+: Progressive average of all previous weeks' raw handicaps (strokes back from the lead)
 *   - Week 5: average of weeks 1-4 raw handicaps
 *   - Week 6: average of weeks 1-5 raw handicaps
 *   - Week 7: average of weeks 1-6 raw handicaps
 *   - etc.
 * 
 * Progressive means each week's handicap uses ALL previous weeks' raw handicaps, not just a rolling window.
 */
export async function calculateAppliedHandicap(
  playerId: number,
  leagueId: number,
  weekNumber: number
): Promise<number> {
  if (weekNumber <= 3) {
    return 0 // No handicap for first 3 rounds
  }
  
  if (weekNumber === 4) {
    // Week 4 uses baseline from first 3 rounds
    const rawHandicaps = await getPlayerRawHandicaps(playerId, leagueId, 3)
    if (rawHandicaps.length < 3) {
      return 0 // Not enough rounds yet
    }
    return calculateBaseline(rawHandicaps)
  }
  
  // Week 5+: Progressive average of all previous weeks' raw handicaps (strokes back from the lead)
  // Week 5: average of weeks 1-4 raw handicaps
  // Week 6: average of weeks 1-5 raw handicaps
  // Week 7: average of weeks 1-6 raw handicaps
  // etc.
  // Progressive means each week uses ALL previous weeks' raw handicaps, not just a rolling window
  const rawHandicaps = await getPlayerRawHandicaps(playerId, leagueId, weekNumber - 1)
  if (rawHandicaps.length < 3) {
    return 0 // Not enough rounds yet
  }
  
  return calculateAverage(rawHandicaps)
}

/**
 * Calculate and set baseline handicaps for all players after round 3
 * Applies baseline to weeks 1-4
 */
export async function calculateBaselineHandicaps(leagueId: number): Promise<void> {
  console.log(`[calculateBaselineHandicaps] Starting for league ${leagueId}`)
  
  // Fetch all data upfront
  const [players, weeks1to3, allScores] = await Promise.all([
    prisma.player.findMany({
      where: { leagueId }
    }),
    prisma.week.findMany({
      where: {
        leagueId,
        weekNumber: { lte: 3 },
        isChampionship: false
      }
    }),
    prisma.score.findMany({
      where: {
        player: { leagueId },
        week: {
          leagueId,
          weekNumber: { lte: 3 },
          isChampionship: false
        },
        total: { not: null }
      },
      include: { week: true }
    })
  ])
  
  const weekIds = weeks1to3.map(w => w.id)
  const weekIdSet = new Set(weekIds)
  
  // Group scores by player
  const scoresByPlayer = new Map<number, typeof allScores>()
  for (const score of allScores) {
    if (!scoresByPlayer.has(score.playerId)) {
      scoresByPlayer.set(score.playerId, [])
    }
    scoresByPlayer.get(score.playerId)!.push(score)
  }

  for (const player of players) {
    const playerScores = scoresByPlayer.get(player.id) || []
    
    // Group scores by weekNumber to handle duplicates
    const scoresByWeek = new Map<number, typeof playerScores[0]>()
    for (const score of playerScores) {
      if (!scoresByWeek.has(score.week.weekNumber)) {
        scoresByWeek.set(score.week.weekNumber, score)
      }
    }
    
    if (scoresByWeek.size < 3) {
      console.log(`[calculateBaselineHandicaps] Player ${player.id} (${player.firstName}): Only ${scoresByWeek.size} rounds with scores, skipping`)
      continue // Player doesn't have 3 rounds yet
    }
    
    // Get raw handicaps - if missing, calculate them now
    let rawHandicaps = await getPlayerRawHandicaps(player.id, leagueId, 3)
    
    // If we have scores but missing raw handicaps, calculate them
    if (rawHandicaps.length < 3 && scoresByWeek.size >= 3) {
      console.log(`[calculateBaselineHandicaps] Player ${player.id} (${player.firstName}): Missing raw handicaps, calculating now...`)
      
      // Calculate raw handicaps for each week
      // Group all scores by weekId to find round lows
      const allWeekScoresMap = new Map<number, typeof allScores>()
      for (const score of allScores) {
        if (weekIdSet.has(score.weekId)) {
          if (!allWeekScoresMap.has(score.weekId)) {
            allWeekScoresMap.set(score.weekId, [])
          }
          allWeekScoresMap.get(score.weekId)!.push(score)
        }
      }
      
      const rawHandicapUpdates: Array<{
        playerId: number
        weekId: number
        rawHandicap: number
      }> = []
      
      for (let weekNum = 1; weekNum <= 3; weekNum++) {
        const score = scoresByWeek.get(weekNum)
        if (!score) continue
        
        const allWeekScores = allWeekScoresMap.get(score.weekId) || []
        
        if (allWeekScores.length > 0) {
          const roundLow = Math.min(...allWeekScores.map(s => s.total!))
          const rawHandicap = calculateRawHandicap(score.total!, roundLow)
          rawHandicapUpdates.push({
            playerId: player.id,
            weekId: score.weekId,
            rawHandicap
          })
        }
      }
      
      // Batch update raw handicaps
      if (rawHandicapUpdates.length > 0) {
        await Promise.all(
          rawHandicapUpdates.map(update =>
            prisma.handicap.upsert({
              where: {
                playerId_weekId: {
                  playerId: update.playerId,
                  weekId: update.weekId
                }
              },
              update: {
                rawHandicap: update.rawHandicap
              },
              create: {
                playerId: update.playerId,
                weekId: update.weekId,
                rawHandicap: update.rawHandicap
              }
            })
          )
        )
      }
      
      // Get raw handicaps again after calculating
      rawHandicaps = await getPlayerRawHandicaps(player.id, leagueId, 3)
    }
    
    if (rawHandicaps.length < 3) {
      console.log(`[calculateBaselineHandicaps] Player ${player.id} (${player.firstName}): Only ${rawHandicaps.length} raw handicaps after calculation, skipping`)
      continue
    }
    
    const baseline = calculateBaseline(rawHandicaps)
    console.log(`[calculateBaselineHandicaps] Player ${player.id} (${player.firstName}): Baseline = ${baseline} (from raw handicaps: ${rawHandicaps.join(', ')})`)
    
    // Fetch weeks 1-4 and scores upfront
    const [weeks1to4, playerScores1to4] = await Promise.all([
      prisma.week.findMany({
        where: {
          leagueId,
          weekNumber: { lte: 4 },
          isChampionship: false
        }
      }),
      prisma.score.findMany({
        where: {
          playerId: player.id,
          week: {
            leagueId,
            weekNumber: { lte: 4 },
            isChampionship: false
          },
          total: { not: null }
        },
        include: { week: true }
      })
    ])
    
    // Batch update handicaps for weeks 1-4
    const handicapUpdates: Array<{
      playerId: number
      weekId: number
      appliedHandicap: number
      isBaseline: boolean
    }> = []
    
    for (const week of weeks1to4) {
      handicapUpdates.push({
        playerId: player.id,
        weekId: week.id,
        appliedHandicap: baseline,
        isBaseline: week.weekNumber <= 3
      })
    }
    
    // Batch upsert handicaps
    if (handicapUpdates.length > 0) {
      await Promise.all(
        handicapUpdates.map(update =>
          prisma.handicap.upsert({
            where: {
              playerId_weekId: {
                playerId: update.playerId,
                weekId: update.weekId
              }
            },
            update: {
              appliedHandicap: update.appliedHandicap,
              isBaseline: update.isBaseline,
              handicap: update.appliedHandicap
            },
            create: {
              playerId: update.playerId,
              weekId: update.weekId,
              appliedHandicap: update.appliedHandicap,
              handicap: update.appliedHandicap,
              isBaseline: update.isBaseline
            }
          })
        )
      )
    }
    
    // Batch update weighted scores for weeks 1-4
    const scoreUpdates: Array<{
      id: number
      weightedScore: number
    }> = []
    
    for (const score of playerScores1to4) {
      if (score.total !== null && score.total !== undefined) {
        const weightedScore = Math.round(score.total - baseline)
        if (score.weightedScore !== weightedScore) {
          scoreUpdates.push({
            id: score.id,
            weightedScore
          })
        }
      }
    }
    
    // Batch update scores
    if (scoreUpdates.length > 0) {
      const BATCH_SIZE = 50
      for (let i = 0; i < scoreUpdates.length; i += BATCH_SIZE) {
        const batch = scoreUpdates.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(update =>
            prisma.score.update({
              where: { id: update.id },
              data: { weightedScore: update.weightedScore }
            })
          )
        )
      }
    }
  }
  console.log(`[calculateBaselineHandicaps] Completed for league ${leagueId}`)
}

/**
 * Check if all players in a league have submitted scores for a specific week
 */
export async function allPlayersSubmitted(leagueId: number, weekNumber: number): Promise<boolean> {
  // Get all players in the league
  const players = await prisma.player.findMany({
    where: { leagueId }
  })
  
  if (players.length === 0) {
    return false // No players in league
  }
  
  // Get all weeks with this weekNumber (handle duplicates)
  const weeks = await prisma.week.findMany({
    where: {
      leagueId,
      weekNumber,
      isChampionship: false
    }
  })
  
  if (weeks.length === 0) {
    return false // Week doesn't exist
  }
  
  const weekIds = weeks.map(w => w.id)
  
  // Check if each player has at least one score for this week
  for (const player of players) {
    const playerScore = await prisma.score.findFirst({
      where: {
        playerId: player.id,
        weekId: { in: weekIds },
        total: {
          not: null
        }
      }
    })
    
    if (!playerScore) {
      return false // This player hasn't submitted
    }
  }
  
  return true // All players have submitted
}

/**
 * Process a completed round:
 * 1. Calculate raw handicaps for all players (strokes back from the lead)
 * 2. Update applied handicaps for current round
 * 3. Only proceed with handicap calculations if ALL players have submitted for current week
 * 4. For week 5+, calculate progressive handicap (average of weeks 1 through weekNumber-1)
 * 5. Recalculate weighted scores
 * 
 * This is automatically triggered when the last score of a week is submitted.
 */
export async function processCompletedRound(leagueId: number, weekNumber: number): Promise<void> {
  // Get the week
  const week = await prisma.week.findFirst({
    where: {
      leagueId,
      weekNumber,
      isChampionship: false
    }
  })
  
  if (!week) {
    throw new Error(`Week ${weekNumber} not found for league ${leagueId}`)
  }
  
  // Get all scores for this round
  // Handle duplicate scores by only using the most recent score per player
  const allScores = await prisma.score.findMany({
    where: {
      week: {
        weekNumber: week.weekNumber,
        leagueId,
        isChampionship: false
      },
      total: {
        not: null
      }
    },
    include: {
      player: true,
      week: true
    },
    orderBy: {
      id: 'desc' // Most recent first
    }
  })
  
  if (allScores.length === 0) {
    return // No scores to process
  }
  
  // Deduplicate: keep only the most recent score per player
  const playerScoreMap = new Map<number, typeof allScores[0]>()
  for (const score of allScores) {
    if (!playerScoreMap.has(score.playerId)) {
      playerScoreMap.set(score.playerId, score)
    }
  }
  const scores = Array.from(playerScoreMap.values())
  
  // Find round low (lowest score)
  const roundLow = Math.min(...scores.map(s => s.total!))
  
  // Calculate and store raw handicaps for all players
  // Use the weekId from each score to handle duplicate weeks
  for (const score of scores) {
    const rawHandicap = calculateRawHandicap(score.total!, roundLow)
    
    // Use the weekId from the score itself (handles duplicate week records)
    await prisma.handicap.upsert({
      where: {
        playerId_weekId: {
          playerId: score.playerId,
          weekId: score.weekId
        }
      },
      update: {
        rawHandicap
      },
      create: {
        playerId: score.playerId,
        weekId: score.weekId,
        rawHandicap
      }
    })
  }
  
  // Check if all players have submitted for this week
  const allSubmitted = await allPlayersSubmitted(leagueId, weekNumber)
  
  // Only proceed with handicap calculations if all players have submitted
  if (!allSubmitted) {
    // Still update raw handicaps for players who have submitted, but don't calculate next week's handicap
    return
  }
  
  // If this is round 3 and all players submitted, calculate baselines
  if (weekNumber === 3) {
    await calculateBaselineHandicaps(leagueId)
  }
  
  // For rounds 4+, calculate progressive handicaps for THIS round and NEXT round
  // Week 4 uses baseline (weeks 1-3), so this section handles week 5+ progressive calculation
  if (weekNumber >= 4) {
    const players = await prisma.player.findMany({
      where: { leagueId }
    })
    
    for (const player of players) {
      // When Week 4 completes, set Week 5's handicap (progressive average of weeks 1-4)
      // When Week 5+ completes, set current week's handicap and next week's handicap
      if (weekNumber === 4) {
        // Week 4 just completed - set Week 5's handicap using progressive average of weeks 1-4
        const rawHandicapsForWeek5 = await getPlayerRawHandicaps(player.id, leagueId, 4) // Get weeks 1-4
        
        console.log(`[processCompletedRound] Week 4 completed - Player ${player.id} (${player.firstName}): Retrieving raw handicaps for Week 5`)
        console.log(`[processCompletedRound] Raw handicaps found: ${rawHandicapsForWeek5.length} values: [${rawHandicapsForWeek5.join(', ')}]`)
        
        if (rawHandicapsForWeek5.length >= 4) {
          // Calculate progressive average: average of weeks 1-4 raw handicaps
          const appliedHandicapForWeek5 = calculateAverage(rawHandicapsForWeek5)
          
          console.log(`[processCompletedRound] Player ${player.id} (${player.firstName}): Calculating Week 5 handicap = ${appliedHandicapForWeek5} (progressive average of weeks 1-4: ${rawHandicapsForWeek5.join(', ')})`)
          
          const week5 = await prisma.week.findFirst({
            where: {
              leagueId,
              weekNumber: 5,
              isChampionship: false
            }
          })
          
          if (week5) {
            console.log(`[processCompletedRound] Week 5 found (weekId: ${week5.id}), setting handicap...`)
            const result = await prisma.handicap.upsert({
              where: {
                playerId_weekId: {
                  playerId: player.id,
                  weekId: week5.id
                }
              },
              update: {
                appliedHandicap: appliedHandicapForWeek5,
                handicap: appliedHandicapForWeek5
              },
              create: {
                playerId: player.id,
                weekId: week5.id,
                appliedHandicap: appliedHandicapForWeek5,
                handicap: appliedHandicapForWeek5
              }
            })
            console.log(`[processCompletedRound] Successfully set Week 5 handicap for player ${player.id}. Record: appliedHandicap=${result.appliedHandicap}, handicap=${result.handicap}`)
          } else {
            console.log(`[processCompletedRound] WARNING: Week 5 does not exist yet in database for league ${leagueId}`)
          }
        } else {
          console.log(`[processCompletedRound] ERROR: Player ${player.id} does not have enough raw handicaps for Week 5. Expected 4, found ${rawHandicapsForWeek5.length}. Raw handicaps: [${rawHandicapsForWeek5.join(', ')}]`)
          
          // Debug: Check what raw handicaps exist in the database
          const allHandicaps = await prisma.handicap.findMany({
            where: {
              playerId: player.id,
              week: {
                leagueId,
                weekNumber: { lte: 4 },
                isChampionship: false
              },
              rawHandicap: { not: null }
            },
            include: { week: true },
            orderBy: { week: { weekNumber: 'asc' } }
          })
          console.log(`[processCompletedRound] DEBUG: All handicap records with rawHandicap for player ${player.id}:`, allHandicaps.map(h => ({
            weekNumber: h.week.weekNumber,
            rawHandicap: h.rawHandicap,
            appliedHandicap: h.appliedHandicap
          })))
        }
      } else if (weekNumber >= 5) {
        // Week 5+: Get raw handicaps from weeks 1 through (weekNumber - 1)
        // This is the progressive average of all previous weeks' raw handicaps (strokes back from the lead)
        const rawHandicapsForCurrentWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber - 1)
        
        console.log(`Player ${player.id} (${player.firstName}): ${rawHandicapsForCurrentWeek.length} raw handicaps for week ${weekNumber} (using weeks 1-${weekNumber - 1})`)
        
        // Week 5 needs exactly 4 raw handicaps (weeks 1-4), Week 6+ needs (weekNumber - 1) raw handicaps
        const minRequiredForCurrent = weekNumber === 5 ? 4 : weekNumber - 1
        
        if (rawHandicapsForCurrentWeek.length >= minRequiredForCurrent) {
          // Calculate progressive average: average of all previous weeks' raw handicaps
          const appliedHandicapForCurrentWeek = calculateAverage(rawHandicapsForCurrentWeek)
          
          console.log(`  Calculated applied handicap for week ${weekNumber}: ${appliedHandicapForCurrentWeek}`)
          
          // Update applied handicap for THIS round (retroactive)
          await prisma.handicap.upsert({
            where: {
              playerId_weekId: {
                playerId: player.id,
                weekId: week.id
              }
            },
            update: {
              appliedHandicap: appliedHandicapForCurrentWeek,
              handicap: appliedHandicapForCurrentWeek
            },
            create: {
              playerId: player.id,
              weekId: week.id,
              appliedHandicap: appliedHandicapForCurrentWeek,
              handicap: appliedHandicapForCurrentWeek,
              rawHandicap: rawHandicapsForCurrentWeek[rawHandicapsForCurrentWeek.length - 1]
            }
          })
          
          // Update weighted scores for this round
          const playerScores = await prisma.score.findMany({
            where: {
              playerId: player.id,
              weekId: week.id
            }
          })
          
          for (const score of playerScores) {
            if (score.total !== null && score.total !== undefined) {
              await prisma.score.update({
                where: { id: score.id },
                data: {
                  weightedScore: Math.round(score.total - appliedHandicapForCurrentWeek)
                }
              })
            }
          }
          
          // Set applied handicap for the next round (weekNumber + 1)
          // Next week's handicap uses weeks 1 through current week (weekNumber)
          // This is the progressive average: all previous weeks including the current one
          const rawHandicapsForNextWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber)
          
          if (rawHandicapsForNextWeek.length >= 3) {
            const appliedHandicapForNextWeek = calculateAverage(rawHandicapsForNextWeek)
            
            const nextWeek = await prisma.week.findFirst({
              where: {
                leagueId,
                weekNumber: weekNumber + 1,
                isChampionship: false
              }
            })
            
            if (nextWeek) {
              console.log(`  Setting applied handicap for week ${weekNumber + 1} (weekId: ${nextWeek.id}): ${appliedHandicapForNextWeek} (progressive average of weeks 1-${weekNumber})`)
              await prisma.handicap.upsert({
                where: {
                  playerId_weekId: {
                    playerId: player.id,
                    weekId: nextWeek.id
                  }
                },
                update: {
                  appliedHandicap: appliedHandicapForNextWeek,
                  handicap: appliedHandicapForNextWeek
                },
                create: {
                  playerId: player.id,
                  weekId: nextWeek.id,
                  appliedHandicap: appliedHandicapForNextWeek,
                  handicap: appliedHandicapForNextWeek
                }
              })
              console.log(`  Successfully set handicap for player ${player.id} for week ${weekNumber + 1}`)
            } else {
              console.log(`  Week ${weekNumber + 1} does not exist yet`)
            }
          }
        } else {
          console.log(`  Player ${player.id} does not have enough rounds for week ${weekNumber} (${rawHandicapsForCurrentWeek.length} < 3)`)
        }
      }
    }
  }
  
  // Recalculate applied handicaps for all weeks up to current (ensures consistency)
  // But skip weeks 1-3 if baseline was just calculated (week 3 completion)
  if (weekNumber === 3) {
    // Don't recalculate weeks 1-3 - baseline was just set by calculateBaselineHandicaps
    // Only recalculate week 4+ if they exist
    await recalculateProgressiveHandicaps(leagueId, weekNumber, true)
  } else if (weekNumber === 4) {
    // When Week 4 completes, we've already set Week 5's handicap above
    // Call recalculateProgressiveHandicaps with weekNumber + 1 to process Week 5
    // This ensures Week 5 is processed correctly and any other weeks up to Week 5
    await recalculateProgressiveHandicaps(leagueId, weekNumber + 1, false)
  } else {
    await recalculateProgressiveHandicaps(leagueId, weekNumber)
  }
}

/**
 * Recalculate progressive handicaps for all weeks up to a given week
 * This ensures every week has its correct applied handicap stored
 * Only calculates handicaps for weeks where all players have submitted the prior week
 * 
 * Week 5+ handicaps are calculated as progressive averages:
 * - Week 5: average of weeks 1-4 raw handicaps (strokes back from the lead)
 * - Week 6: average of weeks 1-5 raw handicaps
 * - Week 7: average of weeks 1-6 raw handicaps
 * - etc.
 * 
 * Progressive means each week uses ALL previous weeks' raw handicaps, not just a rolling window.
 */
export async function recalculateProgressiveHandicaps(
  leagueId: number,
  upToWeekNumber: number,
  skipWeeks1to3?: boolean
): Promise<void> {
  console.log(`[recalculateProgressiveHandicaps] Starting for league ${leagueId}, up to week ${upToWeekNumber}`)
  
  // Fetch all data upfront
  const [players, weeks, allHandicaps] = await Promise.all([
    prisma.player.findMany({
      where: { leagueId }
    }),
    prisma.week.findMany({
      where: {
        leagueId,
        weekNumber: { lte: upToWeekNumber },
        isChampionship: false
      },
      orderBy: { weekNumber: 'asc' }
    }),
    prisma.handicap.findMany({
      where: {
        player: { leagueId },
        week: {
          leagueId,
          weekNumber: { lte: upToWeekNumber },
          isChampionship: false
        },
        rawHandicap: { not: null }
      },
      include: { week: true }
    })
  ])
  
  // Cache week completeness (check once per week)
  const weekCompleteCache = new Map<number, boolean>()
  const playerCount = players.length
  
  // Get all scores to check completeness
  const allScores = await prisma.score.findMany({
    where: {
      player: { leagueId },
      week: {
        leagueId,
        weekNumber: { lte: upToWeekNumber },
        isChampionship: false
      },
      total: { not: null }
    },
    include: { week: true }
  })
  
  // Group scores by week to check completeness
  const scoresByWeek = new Map<number, typeof allScores>()
  for (const score of allScores) {
    const weekNum = score.week.weekNumber
    if (!scoresByWeek.has(weekNum)) {
      scoresByWeek.set(weekNum, [])
    }
    scoresByWeek.get(weekNum)!.push(score)
  }
  
  // Check which weeks are complete
  for (let w = 1; w <= upToWeekNumber; w++) {
    const weekScores = scoresByWeek.get(w) || []
    const uniquePlayers = new Set(weekScores.map(s => s.playerId))
    const isComplete = uniquePlayers.size === playerCount && playerCount > 0
    weekCompleteCache.set(w, isComplete)
    console.log(`[recalculateProgressiveHandicaps] Week ${w} completeness: ${uniquePlayers.size}/${playerCount} players submitted, complete: ${isComplete}`)
  }
  
  // Group handicaps by player and week for quick lookup
  const handicapMap = new Map<string, typeof allHandicaps[0]>()
  for (const handicap of allHandicaps) {
    const key = `${handicap.playerId}-${handicap.week.weekNumber}`
    handicapMap.set(key, handicap)
  }
  
  // Group raw handicaps by player
  const rawHandicapsByPlayer = new Map<number, Map<number, number>>()
  for (const handicap of allHandicaps) {
    if (handicap.rawHandicap !== null) {
      if (!rawHandicapsByPlayer.has(handicap.playerId)) {
        rawHandicapsByPlayer.set(handicap.playerId, new Map())
      }
      rawHandicapsByPlayer.get(handicap.playerId)!.set(handicap.week.weekNumber, handicap.rawHandicap)
    }
  }
  console.log(`[recalculateProgressiveHandicaps] Total handicaps with rawHandicap: ${allHandicaps.length}`)
  console.log(`[recalculateProgressiveHandicaps] Players with raw handicaps: ${rawHandicapsByPlayer.size}`)
  
  const week3Complete = weekCompleteCache.get(3) || false
  
  // Batch updates
  const handicapUpdates: Array<{
    playerId: number
    weekId: number
    appliedHandicap: number
  }> = []
  
  const scoreUpdates: Array<{
    id: number
    weightedScore: number
  }> = []
  
  // Get all player scores for weighted score updates
  const allPlayerScores = await prisma.score.findMany({
    where: {
      player: { leagueId },
      week: {
        leagueId,
        weekNumber: { lte: upToWeekNumber },
        isChampionship: false
      },
      total: { not: null }
    },
    include: { week: true }
  })
  
  for (const player of players) {
    const playerRawHandicaps = rawHandicapsByPlayer.get(player.id) || new Map()
    
    for (const week of weeks) {
      const w = week.weekNumber
      
      console.log(`[recalculateProgressiveHandicaps] Processing Week ${w} for Player ${player.id}`)
      
      // Skip weeks 1-3 if requested
      if (skipWeeks1to3 && w <= 3) {
        console.log(`[recalculateProgressiveHandicaps] Skipping Week ${w} for Player ${player.id} (skipWeeks1to3=true)`)
        continue
      }
      
      // For weeks 2+, check if prior week is complete (all scores submitted)
      // This ensures handicaps are only calculated when the prior week is fully complete
      // For week 5+, this means the progressive handicap uses all previous weeks' data only when each prior week is complete
      if (w > 1) {
        const priorWeekComplete = weekCompleteCache.get(w - 1)
        console.log(`[recalculateProgressiveHandicaps] Week ${w}, Player ${player.id}: Checking if prior week ${w - 1} is complete: ${priorWeekComplete}`)
        if (!priorWeekComplete) {
          console.log(`[recalculateProgressiveHandicaps] Week ${w}, Player ${player.id}: Skipping because prior week ${w - 1} is not complete`)
          continue // Skip this week if prior week is not complete - wait for all scores
        }
      }
      
      let appliedHandicap = 0
      
      if (w <= 3) {
        // Weeks 1-3: Use baseline if calculated
        if (week3Complete) {
          const rawHandicaps = Array.from({ length: 3 }, (_, i) => i + 1)
            .map(weekNum => playerRawHandicaps.get(weekNum))
            .filter((h): h is number => h !== undefined)
          if (rawHandicaps.length >= 3) {
            appliedHandicap = calculateBaseline(rawHandicaps)
          }
        }
      } else if (w === 4) {
        // Week 4: Use baseline
        if (week3Complete) {
          const rawHandicaps = Array.from({ length: 3 }, (_, i) => i + 1)
            .map(weekNum => playerRawHandicaps.get(weekNum))
            .filter((h): h is number => h !== undefined)
          if (rawHandicaps.length >= 3) {
            appliedHandicap = calculateBaseline(rawHandicaps)
          }
        }
      } else {
        // Week 5+: Progressive average of all previous weeks' raw handicaps (strokes back from the lead)
        // Week 5: average of weeks 1-4
        // Week 6: average of weeks 1-5
        // Week 7: average of weeks 1-6
        // etc.
        // This creates an array [1, 2, 3, ..., w-1] to get all previous weeks' raw handicaps
        const rawHandicaps = Array.from({ length: w - 1 }, (_, i) => i + 1)
          .map(weekNum => playerRawHandicaps.get(weekNum))
          .filter((h): h is number => h !== undefined)
        
        // For Week 5, we need exactly 4 raw handicaps (weeks 1-4)
        // For Week 6+, we need at least (w-1) raw handicaps (all previous weeks)
        const minRequired = w === 5 ? 4 : w - 1
        
        console.log(`[recalculateProgressiveHandicaps] Week ${w}, Player ${player.id}: Processing progressive handicap calculation`)
        console.log(`[recalculateProgressiveHandicaps] Raw handicaps retrieved: ${rawHandicaps.length} values: [${rawHandicaps.join(', ')}]`)
        console.log(`[recalculateProgressiveHandicaps] Minimum required: ${minRequired} (need weeks 1-${w-1})`)
        
        if (rawHandicaps.length >= minRequired) {
          // Calculate progressive average: average of all previous weeks' raw handicaps
          appliedHandicap = calculateAverage(rawHandicaps)
          console.log(`[recalculateProgressiveHandicaps] Week ${w}, Player ${player.id}: Calculated progressive handicap = ${appliedHandicap} (average of weeks 1-${w-1}: ${rawHandicaps.join(', ')})`)
        } else {
          console.log(`[recalculateProgressiveHandicaps] ERROR: Week ${w}, Player ${player.id}: Not enough raw handicaps (${rawHandicaps.length} < ${minRequired}). Need weeks 1-${w-1}, have: [${rawHandicaps.map((h, idx) => `week${idx+1}:${h}`).join(', ')}]`)
          
          // Debug: Check what raw handicaps exist in the database for this player
          const debugHandicaps = await prisma.handicap.findMany({
            where: {
              playerId: player.id,
              week: {
                leagueId,
                weekNumber: { lte: w - 1 },
                isChampionship: false
              }
            },
            include: { week: true },
            orderBy: { week: { weekNumber: 'asc' } }
          })
          console.log(`[recalculateProgressiveHandicaps] DEBUG: All handicap records for player ${player.id}, weeks 1-${w-1}:`, debugHandicaps.map(h => ({
            weekNumber: h.week.weekNumber,
            rawHandicap: h.rawHandicap,
            appliedHandicap: h.appliedHandicap,
            handicap: h.handicap
          })))
        }
      }
      
      // For weeks 5+, appliedHandicap can be > 0 even if it's the result of calculation
      // For weeks 1-3, appliedHandicap is 0 (no handicap)
      // For week 4, appliedHandicap is the baseline (can be > 0)
      // For weeks 5+, appliedHandicap is the progressive average (can be > 0)
      if (appliedHandicap > 0 || w <= 3) {
        console.log(`[recalculateProgressiveHandicaps] Adding handicap update for Week ${w}, Player ${player.id}: appliedHandicap = ${appliedHandicap}`)
        handicapUpdates.push({
          playerId: player.id,
          weekId: week.id,
          appliedHandicap
        })
      } else {
        console.log(`[recalculateProgressiveHandicaps] Skipping Week ${w}, Player ${player.id}: appliedHandicap = ${appliedHandicap} (would set to 0)`)
      }
      
      // Update weighted scores for this player/week
      const playerWeekScores = allPlayerScores.filter(
        s => s.playerId === player.id && s.weekId === week.id
      )
      
      for (const score of playerWeekScores) {
        if (score.total !== null) {
          const weightedScore = Math.round(score.total - appliedHandicap)
          if (score.weightedScore !== weightedScore) {
            scoreUpdates.push({
              id: score.id,
              weightedScore
            })
          }
        }
      }
    }
  }
  
  // Batch update handicaps
  if (handicapUpdates.length > 0) {
    console.log(`[recalculateProgressiveHandicaps] Batch updating ${handicapUpdates.length} handicaps`)
    const BATCH_SIZE = 50
    for (let i = 0; i < handicapUpdates.length; i += BATCH_SIZE) {
      const batch = handicapUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(update =>
          prisma.handicap.upsert({
            where: {
              playerId_weekId: {
                playerId: update.playerId,
                weekId: update.weekId
              }
            },
            update: {
              appliedHandicap: update.appliedHandicap,
              handicap: update.appliedHandicap // Ensure both fields are set to the same value
            },
            create: {
              playerId: update.playerId,
              weekId: update.weekId,
              appliedHandicap: update.appliedHandicap,
              handicap: update.appliedHandicap // Ensure both fields are set to the same value
            }
          })
        )
      )
    }
  }
  
  // Batch update weighted scores
  if (scoreUpdates.length > 0) {
    console.log(`[recalculateProgressiveHandicaps] Batch updating ${scoreUpdates.length} weighted scores`)
    const BATCH_SIZE = 50
    for (let i = 0; i < scoreUpdates.length; i += BATCH_SIZE) {
      const batch = scoreUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(update =>
          prisma.score.update({
            where: { id: update.id },
            data: { weightedScore: update.weightedScore }
          })
        )
      )
    }
  }
  
  console.log(`[recalculateProgressiveHandicaps] Completed for league ${leagueId}`)
}

/**
 * Recalculate all handicaps for a league
 * Only calculates handicaps for weeks where all players have submitted
 * Useful for fixing data or after manual edits
 * Optimized for large leagues by batching operations
 */
export async function recalculateAllHandicaps(leagueId: number): Promise<void> {
  console.log(`[recalculateAllHandicaps] Starting for league ${leagueId}`)
  
  // Fetch all data upfront to reduce queries
  const [weeks, players, allScores] = await Promise.all([
    prisma.week.findMany({
      where: {
        leagueId,
        isChampionship: false
      },
      orderBy: {
        weekNumber: 'asc'
      }
    }),
    prisma.player.findMany({
      where: { leagueId }
    }),
    prisma.score.findMany({
      where: {
        player: { leagueId },
        total: { not: null }
      },
      include: {
        player: true,
        week: true
      }
    })
  ])
  
  console.log(`[recalculateAllHandicaps] Found ${weeks.length} weeks, ${players.length} players, ${allScores.length} scores`)
  
  // Cache which weeks are complete (check once per week)
  const weekCompleteCache = new Map<number, boolean>()
  const playerCount = players.length
  
  // Group scores by week
  const scoresByWeek = new Map<number, typeof allScores>()
  for (const score of allScores) {
    const weekNum = score.week.weekNumber
    if (!scoresByWeek.has(weekNum)) {
      scoresByWeek.set(weekNum, [])
    }
    scoresByWeek.get(weekNum)!.push(score)
  }
  
  // Check which weeks are complete (all players submitted)
  for (const week of weeks) {
    const weekScores = scoresByWeek.get(week.weekNumber) || []
    const uniquePlayers = new Set(weekScores.map(s => s.playerId))
    weekCompleteCache.set(week.weekNumber, uniquePlayers.size === playerCount && playerCount > 0)
  }
  
  // Batch update raw handicaps for all completed weeks
  const handicapUpdates: Array<{
    playerId: number
    weekId: number
    rawHandicap: number
  }> = []
  
  for (const week of weeks) {
    const isComplete = weekCompleteCache.get(week.weekNumber)
    if (!isComplete) {
      console.log(`[recalculateAllHandicaps] Week ${week.weekNumber} not complete, skipping`)
      continue
    }
    
    const weekScores = scoresByWeek.get(week.weekNumber) || []
    if (weekScores.length === 0) continue
    
    // Deduplicate scores (keep most recent per player)
    const playerScoreMap = new Map<number, typeof weekScores[0]>()
    for (const score of weekScores) {
      const existing = playerScoreMap.get(score.playerId)
      if (!existing || score.id > existing.id) {
        playerScoreMap.set(score.playerId, score)
      }
    }
    
    const uniqueScores = Array.from(playerScoreMap.values())
    const roundLow = Math.min(...uniqueScores.map(s => s.total!))
    
    for (const score of uniqueScores) {
      const rawHandicap = calculateRawHandicap(score.total!, roundLow)
      handicapUpdates.push({
        playerId: score.playerId,
        weekId: week.id,
        rawHandicap
      })
    }
  }
  
  // Batch upsert raw handicaps in smaller chunks to avoid timeout
  console.log(`[recalculateAllHandicaps] Batch updating ${handicapUpdates.length} raw handicaps`)
  const BATCH_SIZE = 50 // Process 50 at a time
  for (let i = 0; i < handicapUpdates.length; i += BATCH_SIZE) {
    const batch = handicapUpdates.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(update =>
        prisma.handicap.upsert({
          where: {
            playerId_weekId: {
              playerId: update.playerId,
              weekId: update.weekId
            }
          },
          update: {
            rawHandicap: update.rawHandicap
          },
          create: {
            playerId: update.playerId,
            weekId: update.weekId,
            rawHandicap: update.rawHandicap
          }
        })
      )
    )
    console.log(`[recalculateAllHandicaps] Processed batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(handicapUpdates.length / BATCH_SIZE)}`)
  }
  
  // Calculate baselines if we have at least 3 completed rounds
  const week3Complete = weekCompleteCache.get(3)
  if (week3Complete) {
    console.log(`[recalculateAllHandicaps] Week 3 complete, calculating baselines`)
    await calculateBaselineHandicaps(leagueId)
  }
  
  // Recalculate progressive handicaps for all completed weeks (optimized)
  const maxWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0)
  if (maxWeekNumber >= 4) {
    console.log(`[recalculateAllHandicaps] Recalculating progressive handicaps up to week ${maxWeekNumber}`)
    // Process weeks in batches to avoid timeout
    const completedWeeks = weeks.filter(w => weekCompleteCache.get(w.weekNumber))
    
    // Process each completed week
    // Important: When Week 4 is complete, we need to process up to Week 5 (not just Week 4)
    // because Week 5's handicap depends on Week 4 being complete
    for (const week of completedWeeks) {
      const weekNum = week.weekNumber
      if (weekNum === 4) {
        // When Week 4 is complete, process up to Week 5 to set Week 5's handicap
        console.log(`[recalculateAllHandicaps] Week 4 complete, processing up to Week 5`)
        await recalculateProgressiveHandicaps(leagueId, 5, false) // Process up to Week 5, not just Week 4
      } else if (weekNum >= 5) {
        // For Week 5+, process up to that week number
        await recalculateProgressiveHandicaps(leagueId, weekNum, false)
      } else {
        // For weeks 1-3, process up to that week number
        await recalculateProgressiveHandicaps(leagueId, weekNum, false)
      }
    }
    
    // Also explicitly process Week 5 if Week 4 is complete but Week 5 wasn't in the completed weeks list
    if (maxWeekNumber >= 5 && weekCompleteCache.get(4)) {
      const week5Completed = weekCompleteCache.get(5)
      if (!week5Completed) {
        // Week 4 is complete but Week 5 hasn't started yet - still need to set Week 5's handicap
        console.log(`[recalculateAllHandicaps] Week 4 complete, Week 5 not started yet - processing Week 5 handicap`)
        await recalculateProgressiveHandicaps(leagueId, 5, false)
      }
    }
  }
  
  // Ensure all scores have weighted scores calculated (optimized)
  console.log(`[recalculateAllHandicaps] Ensuring weighted scores are calculated`)
  await ensureAllWeightedScores(leagueId)
  
  console.log(`[recalculateAllHandicaps] Completed for league ${leagueId}`)
}

/**
 * Ensure all scores have weighted scores calculated
 * If a score has a total and a handicap exists, calculate weighted score
 * Handles duplicate scores by only processing the most recent score per player/week
 * Optimized for large leagues by batching operations
 */
export async function ensureAllWeightedScores(leagueId: number): Promise<void> {
  console.log(`[ensureAllWeightedScores] Starting for league ${leagueId}`)
  
  // Fetch all scores and handicaps in bulk
  const [allScores, allHandicaps] = await Promise.all([
    prisma.score.findMany({
      where: {
        player: {
          leagueId
        },
        total: {
          not: null
        }
      },
      include: {
        player: true,
        week: true
      },
      orderBy: {
        id: 'desc' // Most recent first
      }
    }),
    prisma.handicap.findMany({
      where: {
        player: {
          leagueId
        }
      },
      include: {
        week: true
      }
    })
  ])
  
  console.log(`[ensureAllWeightedScores] Found ${allScores.length} scores, ${allHandicaps.length} handicaps`)
  
  // Deduplicate: keep only the most recent score per player/week
  const scoreKeyMap = new Map<string, typeof allScores[0]>()
  for (const score of allScores) {
    const key = `${score.playerId}-${score.week.weekNumber}-${score.week.isChampionship}`
    if (!scoreKeyMap.has(key)) {
      scoreKeyMap.set(key, score)
    }
  }
  const scores = Array.from(scoreKeyMap.values())
  
  // Create a map of handicaps for quick lookup
  const handicapMap = new Map<string, typeof allHandicaps[0]>()
  for (const handicap of allHandicaps) {
    const key = `${handicap.playerId}-${handicap.weekId}`
    handicapMap.set(key, handicap)
  }
  
  // Batch updates
  const scoreUpdates: Array<{
    id: number
    weightedScore: number
  }> = []
  
  for (const score of scores) {
    const handicapKey = `${score.playerId}-${score.weekId}`
    const handicap = handicapMap.get(handicapKey)
    
    const appliedHandicap = handicap?.appliedHandicap ?? handicap?.handicap ?? 0
    const weightedScore = Math.round(score.total! - appliedHandicap)
    
    // Only update if different
    if (score.weightedScore !== weightedScore) {
      scoreUpdates.push({
        id: score.id,
        weightedScore
      })
    }
  }
  
  // Batch update scores in smaller chunks to avoid timeout
  if (scoreUpdates.length > 0) {
    console.log(`[ensureAllWeightedScores] Updating ${scoreUpdates.length} weighted scores`)
    const BATCH_SIZE = 50 // Process 50 at a time
    for (let i = 0; i < scoreUpdates.length; i += BATCH_SIZE) {
      const batch = scoreUpdates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(update =>
          prisma.score.update({
            where: { id: update.id },
            data: { weightedScore: update.weightedScore }
          })
        )
      )
      console.log(`[ensureAllWeightedScores] Processed batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(scoreUpdates.length / BATCH_SIZE)}`)
    }
  }
  
  console.log(`[ensureAllWeightedScores] Completed for league ${leagueId}`)
}
