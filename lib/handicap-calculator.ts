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
 */
export async function recalculateAllHandicaps(leagueId: number): Promise<void> {
  const weeks = await prisma.week.findMany({
    where: {
      leagueId,
      isChampionship: false
    },
    orderBy: {
      weekNumber: 'asc'
    }
  })
  
  // First, recalculate raw handicaps for all COMPLETED rounds only
  for (const week of weeks) {
    // Check if all players have submitted for this week
    const weekComplete = await allPlayersSubmitted(leagueId, week.weekNumber)
    
    if (!weekComplete) {
      console.log(`[recalculateAllHandicaps] Week ${week.weekNumber} not complete, skipping raw handicap calculation`)
      continue
    }
    
    const scores = await prisma.score.findMany({
      where: {
        weekId: week.id,
        total: {
          not: null
        }
      },
      include: {
        player: true
      }
    })
    
    if (scores.length === 0) continue
    
    const roundLow = Math.min(...scores.map(s => s.total!))
    
    for (const score of scores) {
      const rawHandicap = calculateRawHandicap(score.total!, roundLow)
      
      await prisma.handicap.upsert({
        where: {
          playerId_weekId: {
            playerId: score.playerId,
            weekId: week.id
          }
        },
        update: {
          rawHandicap
        },
        create: {
          playerId: score.playerId,
          weekId: week.id,
          rawHandicap
        }
      })
    }
  }
  
  // Calculate baselines if we have at least 3 completed rounds
  const week3Complete = await allPlayersSubmitted(leagueId, 3)
  if (week3Complete) {
    await calculateBaselineHandicaps(leagueId)
  }
  
  // Recalculate progressive handicaps for all completed weeks
  const maxWeekNumber = Math.max(...weeks.map(w => w.weekNumber), 0)
  if (maxWeekNumber >= 4) {
    // Only recalculate for weeks that are complete
    for (let w = 1; w <= maxWeekNumber; w++) {
      const weekComplete = await allPlayersSubmitted(leagueId, w)
      if (weekComplete) {
        await recalculateProgressiveHandicaps(leagueId, w, false)
      }
    }
  }
  
  // Ensure all scores have weighted scores calculated
  await ensureAllWeightedScores(leagueId)
}

/**
 * Ensure all scores have weighted scores calculated
 * If a score has a total and a handicap exists, calculate weighted score
 * Handles duplicate scores by only processing the most recent score per player/week
 */
export async function ensureAllWeightedScores(leagueId: number): Promise<void> {
  const allScores = await prisma.score.findMany({
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
  })
  
  // Deduplicate: keep only the most recent score per player/week
  const scoreKeyMap = new Map<string, typeof allScores[0]>()
  for (const score of allScores) {
    const key = `${score.playerId}-${score.week.weekNumber}-${score.week.isChampionship}`
    if (!scoreKeyMap.has(key)) {
      scoreKeyMap.set(key, score)
    }
  }
  const scores = Array.from(scoreKeyMap.values())
  
  for (const score of scores) {
    // Get the applied handicap for this player/week
    // Try to find handicap by weekId first, then by weekNumber
    let handicap = await prisma.handicap.findFirst({
      where: {
        playerId: score.playerId,
        week: {
          weekNumber: score.week.weekNumber,
          leagueId,
          isChampionship: score.week.isChampionship
        }
      },
      orderBy: {
        updatedAt: 'desc' // Most recent
      }
    })
    
    // Fallback to weekId if not found
    if (!handicap) {
      handicap = await prisma.handicap.findUnique({
        where: {
          playerId_weekId: {
            playerId: score.playerId,
            weekId: score.weekId
          }
        }
      })
    }
    
    const appliedHandicap = handicap?.appliedHandicap ?? handicap?.handicap ?? 0
    
    // Calculate weighted score
    const weightedScore = Math.round(score.total! - appliedHandicap)
    
    // Update if different
    if (score.weightedScore !== weightedScore) {
      await prisma.score.update({
        where: { id: score.id },
        data: {
          weightedScore
        }
      })
    }
  }
}
