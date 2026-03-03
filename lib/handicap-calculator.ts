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
  const handicaps = await prisma.handicap.findMany({
    where: {
      playerId,
      week: {
        leagueId,
        weekNumber: { lte: upToWeekNumber },
        isChampionship: false
      },
      rawHandicap: { not: null }
    },
    include: { week: true },
    orderBy: [
      { week: { weekNumber: 'asc' } },
      { updatedAt: 'desc' },
      { id: 'desc' }
    ]
  })

  // Deduplicate by weekNumber (keep first = most recent due to ordering)
  const seen = new Set<number>()
  const rawHandicaps: number[] = []
  for (const h of handicaps) {
    const wn = h.week.weekNumber
    if (excludeWeekNumber && wn === excludeWeekNumber) continue
    if (seen.has(wn)) continue
    seen.add(wn)
    if (h.rawHandicap !== null && h.rawHandicap !== undefined) {
      rawHandicaps.push(h.rawHandicap)
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
  // Weeks 11 and 12 both use the handicap from after round 10 (weeks 1-10)
  const upToWeek = weekNumber >= 11 ? 10 : weekNumber - 1
  const rawHandicaps = await getPlayerRawHandicaps(playerId, leagueId, upToWeek)
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
  
  // Group scores by player (excludes default scores)
  const nonDefaultScoresBaseline = allScores.filter(s => !s.isDefault)
  const scoresByPlayer = new Map<number, typeof allScores>()
  for (const score of nonDefaultScoresBaseline) {
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
      continue
    }
    
    let rawHandicaps = await getPlayerRawHandicaps(player.id, leagueId, 3)
    
    if (rawHandicaps.length < 3 && scoresByWeek.size >= 3) {
      
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
      continue
    }
    
    const baseline = calculateBaseline(rawHandicaps)
    
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
  
  // Filter out default scores for handicap calculations
  const nonDefaultScores = scores.filter(s => !s.isDefault)
  
  if (nonDefaultScores.length === 0) {
    return // No real scores to process for handicaps
  }
  
  // Find round low from non-default scores only
  const roundLow = Math.min(...nonDefaultScores.map(s => s.total!))
  
  // Calculate and store raw handicaps only for non-default scores
  for (const score of nonDefaultScores) {
    const rawHandicap = calculateRawHandicap(score.total!, roundLow)
    
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
        const rawHandicapsForWeek5 = await getPlayerRawHandicaps(player.id, leagueId, 4)
        
        if (rawHandicapsForWeek5.length >= 3) {
          const appliedHandicapForWeek5 = calculateAverage(rawHandicapsForWeek5)
          
          const week5 = await prisma.week.findFirst({
            where: { leagueId, weekNumber: 5, isChampionship: false }
          })
          
          if (week5) {
            await prisma.handicap.upsert({
              where: { playerId_weekId: { playerId: player.id, weekId: week5.id } },
              update: { appliedHandicap: appliedHandicapForWeek5, handicap: appliedHandicapForWeek5 },
              create: { playerId: player.id, weekId: week5.id, appliedHandicap: appliedHandicapForWeek5, handicap: appliedHandicapForWeek5 }
            })
          }
        }
      } else if (weekNumber >= 5) {
        // Week 5+: Get raw handicaps from weeks 1 through (weekNumber - 1)
        // This is the progressive average of all previous weeks' raw handicaps (strokes back from the lead)
        const rawHandicapsForCurrentWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber - 1)
        
        if (rawHandicapsForCurrentWeek.length >= 3) {
          const appliedHandicapForCurrentWeek = calculateAverage(rawHandicapsForCurrentWeek)
          
          await prisma.handicap.upsert({
            where: { playerId_weekId: { playerId: player.id, weekId: week.id } },
            update: { appliedHandicap: appliedHandicapForCurrentWeek, handicap: appliedHandicapForCurrentWeek },
            create: { playerId: player.id, weekId: week.id, appliedHandicap: appliedHandicapForCurrentWeek, handicap: appliedHandicapForCurrentWeek, rawHandicap: rawHandicapsForCurrentWeek[rawHandicapsForCurrentWeek.length - 1] }
          })
          
          const playerScores = await prisma.score.findMany({
            where: { playerId: player.id, weekId: week.id }
          })
          
          for (const score of playerScores) {
            if (score.total !== null && score.total !== undefined) {
              await prisma.score.update({
                where: { id: score.id },
                data: { weightedScore: Math.round(score.total - appliedHandicapForCurrentWeek) }
              })
            }
          }
          
          const rawHandicapsForNextWeek = await getPlayerRawHandicaps(player.id, leagueId, weekNumber)
          
          if (rawHandicapsForNextWeek.length >= 3) {
            const appliedHandicapForNextWeek = calculateAverage(rawHandicapsForNextWeek)
            
            const nextWeek = await prisma.week.findFirst({
              where: { leagueId, weekNumber: weekNumber + 1, isChampionship: false }
            })
            
            if (nextWeek) {
              await prisma.handicap.upsert({
                where: { playerId_weekId: { playerId: player.id, weekId: nextWeek.id } },
                update: { appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek },
                create: { playerId: player.id, weekId: nextWeek.id, appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek }
              })
              
              if (weekNumber === 10) {
                const week12 = await prisma.week.findFirst({
                  where: { leagueId, weekNumber: 12, isChampionship: false }
                })
                if (week12) {
                  await prisma.handicap.upsert({
                    where: { playerId_weekId: { playerId: player.id, weekId: week12.id } },
                    update: { appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek },
                    create: { playerId: player.id, weekId: week12.id, appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek }
                  })
                }
                const championship = await prisma.week.findFirst({
                  where: { leagueId, isChampionship: true }
                })
                if (championship) {
                  await prisma.handicap.upsert({
                    where: { playerId_weekId: { playerId: player.id, weekId: championship.id } },
                    update: { appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek },
                    create: { playerId: player.id, weekId: championship.id, appliedHandicap: appliedHandicapForNextWeek, handicap: appliedHandicapForNextWeek }
                  })
                }
              }
            }
          }
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
    // When Week 5+ completes, call recalculateProgressiveHandicaps with weekNumber + 1
    // to process the next week's handicap (e.g., when Week 5 completes, process Week 6)
    // This ensures the next week's handicap is calculated when the current week completes
    await recalculateProgressiveHandicaps(leagueId, weekNumber + 1, false)
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
  }
  
  const rawHandicapsByPlayer = new Map<number, Map<number, number>>()
  for (const handicap of allHandicaps) {
    if (handicap.rawHandicap !== null) {
      if (!rawHandicapsByPlayer.has(handicap.playerId)) {
        rawHandicapsByPlayer.set(handicap.playerId, new Map())
      }
      rawHandicapsByPlayer.get(handicap.playerId)!.set(handicap.week.weekNumber, handicap.rawHandicap)
    }
  }
  
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
      
      if (skipWeeks1to3 && w <= 3) continue
      
      if (w > 1) {
        const priorWeekComplete = weekCompleteCache.get(w - 1)
        if (!priorWeekComplete) continue
      }
      
      let appliedHandicap = 0
      
      if (w <= 4) {
        if (week3Complete) {
          const rawHandicaps = Array.from({ length: 3 }, (_, i) => i + 1)
            .map(weekNum => playerRawHandicaps.get(weekNum))
            .filter((h): h is number => h !== undefined)
          if (rawHandicaps.length >= 3) {
            appliedHandicap = calculateBaseline(rawHandicaps)
          }
        }
      } else {
        const rawHandicaps = Array.from({ length: w - 1 }, (_, i) => i + 1)
          .map(weekNum => playerRawHandicaps.get(weekNum))
          .filter((h): h is number => h !== undefined)
        
        if (rawHandicaps.length >= 3) {
          appliedHandicap = calculateAverage(rawHandicaps)
        }
      }
      
      if (appliedHandicap > 0 || w <= 3) {
        handicapUpdates.push({
          playerId: player.id,
          weekId: week.id,
          appliedHandicap
        })
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
    if (!isComplete) continue
    
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
    
    // Filter out default scores for handicap calculations
    const nonDefaultScores = uniqueScores.filter(s => !s.isDefault)
    if (nonDefaultScores.length === 0) continue
    
    const roundLow = Math.min(...nonDefaultScores.map(s => s.total!))
    
    for (const score of nonDefaultScores) {
      const rawHandicap = calculateRawHandicap(score.total!, roundLow)
      handicapUpdates.push({
        playerId: score.playerId,
        weekId: week.id,
        rawHandicap
      })
    }
  }
  
  console.log(`[recalculateAllHandicaps] Updating ${handicapUpdates.length} raw handicaps`)
  const BATCH_SIZE = 50
  for (let i = 0; i < handicapUpdates.length; i += BATCH_SIZE) {
    const batch = handicapUpdates.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(update =>
        prisma.handicap.upsert({
          where: { playerId_weekId: { playerId: update.playerId, weekId: update.weekId } },
          update: { rawHandicap: update.rawHandicap },
          create: { playerId: update.playerId, weekId: update.weekId, rawHandicap: update.rawHandicap }
        })
      )
    )
  }
  
  // Calculate baselines if we have at least 3 completed rounds
  const week3Complete = weekCompleteCache.get(3)
  if (week3Complete) {
    await calculateBaselineHandicaps(leagueId)
  }
  
  // Recalculate progressive handicaps for all completed weeks AND the next week
  const completedWeeks = weeks.filter(w => weekCompleteCache.get(w.weekNumber))
  const maxCompletedWeek = completedWeeks.length > 0
    ? Math.max(...completedWeeks.map(w => w.weekNumber))
    : 0

  if (maxCompletedWeek >= 3) {
    // Process up to maxCompletedWeek + 1 so the NEXT week's handicap gets set
    const processUpTo = maxCompletedWeek + 1
    console.log(`[recalculateAllHandicaps] Recalculating progressive handicaps up to week ${processUpTo} (max completed: ${maxCompletedWeek})`)
    await recalculateProgressiveHandicaps(leagueId, processUpTo, false)

    // After round 10, also set handicap for week 12 (same as week 11)
    if (maxCompletedWeek >= 10) {
      console.log(`[recalculateAllHandicaps] Also processing week 12 (uses round 10 handicap)`)
      await recalculateProgressiveHandicaps(leagueId, 12, false)
    }
  }
  
  // Ensure all scores have weighted scores calculated (optimized)
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
  
  console.log(`[ensureAllWeightedScores] Completed for league ${leagueId}`)
}

/**
 * Ensure the isDefault column exists on the Score table.
 * Runs the ALTER TABLE idempotently so the app self-heals if the migration was never applied.
 */
export async function ensureIsDefaultColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false`
    )
    console.log('[ensureIsDefaultColumn] Column verified/created')
  } catch (err: any) {
    console.error('[ensureIsDefaultColumn] Error:', err?.message)
  }
}

/**
 * Backfill old default scores that were created before the isDefault column existed.
 * Identifies them by: all 18 holes are the same value (evenly distributed artificial scores),
 * or all 18 holes are null while total is set.
 * Marks them isDefault=true and removes their raw handicap records.
 */
export async function backfillDefaultScores(leagueId: number): Promise<void> {
  console.log(`[backfillDefaultScores] Starting for league ${leagueId}`)

  const allScores = await prisma.score.findMany({
    where: {
      player: { leagueId },
      total: { not: null }
    },
    include: { week: true }
  })

  const toMark: number[] = []

  for (const s of allScores) {
    if (s.isDefault) continue // already marked

    const holes = [
      s.hole1, s.hole2, s.hole3, s.hole4, s.hole5, s.hole6,
      s.hole7, s.hole8, s.hole9, s.hole10, s.hole11, s.hole12,
      s.hole13, s.hole14, s.hole15, s.hole16, s.hole17, s.hole18
    ]

    const allNull = holes.every(h => h === null || h === undefined)
    // Evenly distributed: all non-null holes within 1 stroke of each other (artificial pattern)
    const nonNullHoles = holes.filter((h): h is number => h !== null && h !== undefined)
    const allSame = nonNullHoles.length === 18 &&
      (Math.max(...nonNullHoles) - Math.min(...nonNullHoles) <= 1)

    if (allNull || allSame) {
      toMark.push(s.id)
    }
  }

  if (toMark.length === 0) {
    console.log(`[backfillDefaultScores] No old default scores to backfill`)
    return
  }

  console.log(`[backfillDefaultScores] Marking ${toMark.length} scores as isDefault=true`)

  // Mark them as default
  await prisma.score.updateMany({
    where: { id: { in: toMark } },
    data: { isDefault: true }
  })

  // Remove raw handicap records for these scores so they stop polluting averages
  const markedScores = allScores.filter(s => toMark.includes(s.id))
  const handicapDeletes: Array<{ playerId: number; weekId: number }> = []
  for (const s of markedScores) {
    handicapDeletes.push({ playerId: s.playerId, weekId: s.weekId })
  }

  if (handicapDeletes.length > 0) {
    const BATCH = 50
    for (let i = 0; i < handicapDeletes.length; i += BATCH) {
      const batch = handicapDeletes.slice(i, i + BATCH)
      await Promise.all(
        batch.map(del =>
          prisma.handicap.updateMany({
            where: { playerId: del.playerId, weekId: del.weekId },
            data: { rawHandicap: null }
          }).catch(() => {})
        )
      )
    }
  }

  // Also null-out hole data on these scores
  await prisma.score.updateMany({
    where: { id: { in: toMark } },
    data: {
      hole1: null, hole2: null, hole3: null, hole4: null, hole5: null, hole6: null,
      hole7: null, hole8: null, hole9: null, hole10: null, hole11: null, hole12: null,
      hole13: null, hole14: null, hole15: null, hole16: null, hole17: null, hole18: null
    }
  })

  console.log(`[backfillDefaultScores] Completed for league ${leagueId}`)
}

/**
 * Recalculate all default scores for a league.
 * Default score = roundLow + playerHandicap + 5
 * Called when handicaps are recalculated so default scores stay in sync.
 * Uses runtime filtering to be resilient if isDefault column is not yet in DB.
 */
export async function recalculateDefaultScores(leagueId: number): Promise<void> {
  console.log(`[recalculateDefaultScores] Starting for league ${leagueId}`)

  // Fetch all scores and filter at runtime (no Prisma WHERE on isDefault)
  const allScores = await prisma.score.findMany({
    where: {
      player: { leagueId },
      total: { not: null }
    },
    include: {
      player: true,
      week: true
    }
  })

  const defaultScores = allScores.filter(s => s.isDefault)
  const realScores = allScores.filter(s => !s.isDefault)

  if (defaultScores.length === 0) {
    console.log(`[recalculateDefaultScores] No default scores found`)
    return
  }

  // Build round low per weekNumber from real scores only
  const roundLowByWeek = new Map<number, number>()
  for (const s of realScores) {
    const wn = s.week.weekNumber
    const current = roundLowByWeek.get(wn)
    if (current === undefined || s.total! < current) {
      roundLowByWeek.set(wn, s.total!)
    }
  }

  // Get all handicaps for lookup
  const allHandicaps = await prisma.handicap.findMany({
    where: { player: { leagueId } },
    include: { week: true }
  })
  const handicapMap = new Map<string, number>()
  for (const h of allHandicaps) {
    const key = `${h.playerId}-${h.weekId}`
    handicapMap.set(key, h.appliedHandicap ?? h.handicap ?? 0)
  }

  const updates: Array<{ id: number; total: number; front9: number; back9: number; weightedScore: number }> = []

  for (const ds of defaultScores) {
    const roundLow = roundLowByWeek.get(ds.week.weekNumber)
    if (roundLow === undefined) continue

    const hKey = `${ds.playerId}-${ds.weekId}`
    const playerHandicap = handicapMap.get(hKey) ?? 0
    const newTotal = roundLow + playerHandicap + 5
    const newFront9 = Math.round(newTotal / 2)
    const newBack9 = newTotal - newFront9
    const weightedScore = Math.round(newTotal - playerHandicap)

    if (ds.total !== newTotal || ds.weightedScore !== weightedScore) {
      updates.push({ id: ds.id, total: newTotal, front9: newFront9, back9: newBack9, weightedScore })
    }
  }

  if (updates.length > 0) {
    console.log(`[recalculateDefaultScores] Updating ${updates.length} default scores`)
    const BATCH_SIZE = 50
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(u =>
          prisma.score.update({
            where: { id: u.id },
            data: { total: u.total, front9: u.front9, back9: u.back9, weightedScore: u.weightedScore }
          })
        )
      )
    }
  }

  console.log(`[recalculateDefaultScores] Completed for league ${leagueId}`)
}
