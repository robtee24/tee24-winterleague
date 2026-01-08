import { prisma } from './prisma'

/**
 * Calculate raw handicap for a player in a round
 * Raw handicap = (Player Score - Round Low), capped at 25
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
 * - Week 5+: Average of all previous rounds' raw handicaps
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
  
  // Week 5+: Average of all previous rounds
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
  const players = await prisma.player.findMany({
    where: { leagueId }
  })

  for (const player of players) {
    // First, check if player has scores for weeks 1-3
    const weeks1to3 = await prisma.week.findMany({
      where: {
        leagueId,
        weekNumber: { lte: 3 },
        isChampionship: false
      }
    })
    
    const weekIds = weeks1to3.map(w => w.id)
    const playerScores = await prisma.score.findMany({
      where: {
        playerId: player.id,
        weekId: { in: weekIds },
        total: { not: null }
      },
      include: { week: true }
    })
    
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
      for (let weekNum = 1; weekNum <= 3; weekNum++) {
        const score = scoresByWeek.get(weekNum)
        if (!score) continue
        
        // Get all scores for this week to find round low
        const allWeekScores = await prisma.score.findMany({
          where: {
            weekId: score.weekId,
            total: { not: null }
          }
        })
        
        if (allWeekScores.length > 0) {
          const roundLow = Math.min(...allWeekScores.map(s => s.total!))
          const rawHandicap = calculateRawHandicap(score.total!, roundLow)
          
          // Store the raw handicap
          await prisma.handicap.upsert({
            where: {
              playerId_weekId: {
                playerId: player.id,
                weekId: score.weekId
              }
            },
            update: {
              rawHandicap
            },
            create: {
              playerId: player.id,
              weekId: score.weekId,
              rawHandicap
            }
          })
        }
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
    
    // Apply baseline to weeks 1-4
    // Handle duplicate weeks by updating all week records with the same weekNumber
    for (let weekNum = 1; weekNum <= 4; weekNum++) {
      const weeks = await prisma.week.findMany({
        where: {
          leagueId,
          weekNumber: weekNum,
          isChampionship: false
        }
      })
      
      for (const week of weeks) {
        await prisma.handicap.upsert({
          where: {
            playerId_weekId: {
              playerId: player.id,
              weekId: week.id
            }
          },
          update: {
            appliedHandicap: baseline,
            isBaseline: weekNum <= 3,
            handicap: baseline
          },
          create: {
            playerId: player.id,
            weekId: week.id,
            appliedHandicap: baseline,
            handicap: baseline,
            isBaseline: weekNum <= 3
          }
        })
        console.log(`[calculateBaselineHandicaps] Updated handicap for player ${player.id}, week ${weekNum} (weekId: ${week.id}): ${baseline}`)
      }
    }
    
    // Also update weeks 1-4 scores with weighted scores
    const weeks1to4 = await prisma.week.findMany({
      where: {
        leagueId,
        weekNumber: { lte: 4 },
        isChampionship: false
      }
    })
    
    for (const week of weeks1to4) {
      
      // Update weighted scores for weeks 1-4
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
            data: {
              weightedScore
            }
          })
          console.log(`[calculateBaselineHandicaps] Updated weighted score for player ${player.id}, week ${week.weekNumber}, score ${score.id}: ${score.total} - ${baseline} = ${weightedScore}`)
        }
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
 * 1. Calculate raw handicaps for all players
 * 2. Update applied handicaps for current round
 * 3. Only calculate next week's handicap if all players have submitted for current week
 * 4. Recalculate weighted scores
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
  if (weekNumber >= 4) {
    const players = await prisma.player.findMany({
      where: { leagueId }
    })
    
    for (const player of players) {
      // Get all raw handicaps up to and including the current week
      // For calculating next week's handicap, we need raw handicaps up to current week (weekNumber)
      // But we need to make sure we include the raw handicap we just calculated
      // So we get raw handicaps up to weekNumber, which should include the one we just set
      const rawHandicapsForCurrentWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber)
      
      // For calculating next week's applied handicap, we use raw handicaps up to current week
      // This is the average of all completed rounds including the current one
      const rawHandicapsForNextWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber)
      
      console.log(`Player ${player.id} (${player.firstName}): ${rawHandicapsForCurrentWeek.length} raw handicaps for week ${weekNumber}`)
      
      if (rawHandicapsForCurrentWeek.length >= 4) {
        // Calculate average of all completed rounds (up to and including current week)
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
        
        // Set applied handicap for the next round
        // Use the same raw handicaps (up to current week) to calculate next week's handicap
        // This is correct because next week's handicap should be based on all previous rounds
        const appliedHandicapForNextWeek = calculateAverage(rawHandicapsForNextWeek)
        
        const nextWeek = await prisma.week.findFirst({
          where: {
            leagueId,
            weekNumber: weekNumber + 1,
            isChampionship: false
          }
        })
        
        if (nextWeek) {
          console.log(`  Setting applied handicap for week ${weekNumber + 1} (weekId: ${nextWeek.id}): ${appliedHandicapForNextWeek}`)
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
      } else {
        console.log(`  Player ${player.id} does not have enough rounds (${rawHandicapsForCurrentWeek.length} < 4)`)
      }
    }
  }
  
  // Recalculate applied handicaps for all weeks up to current (ensures consistency)
  // But skip weeks 1-3 if baseline was just calculated (week 3 completion)
  if (weekNumber === 3) {
    // Don't recalculate weeks 1-3 - baseline was just set by calculateBaselineHandicaps
    // Only recalculate week 4+ if they exist
    await recalculateProgressiveHandicaps(leagueId, weekNumber, true)
  } else {
    await recalculateProgressiveHandicaps(leagueId, weekNumber)
  }
}

/**
 * Recalculate progressive handicaps for all weeks up to a given week
 * This ensures every week has its correct applied handicap stored
 * Only calculates handicaps for weeks where all players have submitted the prior week
 */
export async function recalculateProgressiveHandicaps(
  leagueId: number,
  upToWeekNumber: number,
  skipWeeks1to3?: boolean
): Promise<void> {
  const players = await prisma.player.findMany({
    where: { leagueId }
  })
  
  for (const player of players) {
    // Recalculate for all weeks from 1 to upToWeekNumber
    // Weeks 1-4 use baseline, weeks 5+ use progressive average
    // Only calculate week N's handicap if all players submitted week N-1
    for (let w = 1; w <= upToWeekNumber; w++) {
      // Skip weeks 1-3 if baseline was just calculated (to avoid overwriting)
      if (skipWeeks1to3 && w <= 3) {
        continue
      }
      
      const week = await prisma.week.findFirst({
        where: {
          leagueId,
          weekNumber: w,
          isChampionship: false
        }
      })
      
      if (!week) continue
      
      // For weeks 2+, check if all players submitted the prior week
      // Week 1 doesn't need a prior week check
      if (w > 1) {
        const priorWeekComplete = await allPlayersSubmitted(leagueId, w - 1)
        if (!priorWeekComplete) {
          // Don't calculate handicap for this week yet - prior week not complete
          continue
        }
      }
      
      let appliedHandicap = 0
      
      // Check if baseline has been calculated (week 3 is complete)
      const week3Complete = await allPlayersSubmitted(leagueId, 3)
      const hasBaseline = week3Complete
      
      if (w <= 3) {
        // Weeks 1-3: Use baseline if it's been calculated, otherwise 0
        if (hasBaseline) {
          const rawHandicapsUpToWeek = await getPlayerRawHandicaps(player.id, leagueId, 3)
          if (rawHandicapsUpToWeek.length >= 3) {
            appliedHandicap = calculateBaseline(rawHandicapsUpToWeek)
          }
        } else {
          appliedHandicap = 0
        }
      } else if (w === 4) {
        // Week 4: Use baseline from weeks 1-3 (only if all players submitted week 3)
        if (week3Complete) {
          const rawHandicapsUpToWeek = await getPlayerRawHandicaps(player.id, leagueId, 3)
          if (rawHandicapsUpToWeek.length >= 3) {
            appliedHandicap = calculateBaseline(rawHandicapsUpToWeek)
          }
        }
      } else {
        // Week 5+: Average of all previous rounds (only if prior week complete)
        const rawHandicapsUpToWeek = await getPlayerRawHandicaps(player.id, leagueId, w - 1)
        if (rawHandicapsUpToWeek.length >= 3) {
          appliedHandicap = calculateAverage(rawHandicapsUpToWeek)
        }
      }
      
      if (appliedHandicap > 0 || w <= 3) {
        
        await prisma.handicap.upsert({
          where: {
            playerId_weekId: {
              playerId: player.id,
              weekId: week.id
            }
          },
          update: {
            appliedHandicap,
            handicap: appliedHandicap
          },
          create: {
            playerId: player.id,
            weekId: week.id,
            appliedHandicap,
            handicap: appliedHandicap
          }
        })
        
        // Update weighted scores for this week
        const scores = await prisma.score.findMany({
          where: {
            playerId: player.id,
            weekId: week.id
          }
        })
        
        for (const score of scores) {
          if (score.total !== null && score.total !== undefined) {
            await prisma.score.update({
              where: { id: score.id },
              data: {
                weightedScore: Math.round(score.total - appliedHandicap)
              }
            })
          }
        }
      }
    }
  }
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
    for (const week of completedWeeks) {
      await recalculateProgressiveHandicaps(leagueId, week.weekNumber, false)
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
