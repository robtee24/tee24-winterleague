import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processCompletedRound, calculateAppliedHandicap, ensureAllWeightedScores } from '@/lib/handicap-calculator'

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
    const team1Low = Math.min(...team1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined))
    const team2Low = Math.min(...team2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined))

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
 * Calculate all matches for a week using individual round scores
 */
async function calculateMatchesForWeek(weekId: number) {
  // Get the week to find weekNumber and leagueId
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      league: true
    }
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
          player2: true
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

    // Get scores for team 1 players - use weekNumber to handle duplicate weeks
    const team1Player1Score = await prisma.score.findFirst({
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

    const team1Player2Score = await prisma.score.findFirst({
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

    // Get scores for team 2 players
    const team2Player1Score = await prisma.score.findFirst({
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

    const team2Player2Score = await prisma.score.findFirst({
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

    // Check if at least one player from each team has a score
    if (!team1Player1Score && !team1Player2Score) {
      continue // Skip if team 1 has no scores
    }

    if (!team2Player1Score && !team2Player2Score) {
      continue // Skip if team 2 has no scores
    }

    // Use helper functions to get team scores (handles cases where players only have total scores)
    function hasHoleScores(score: any): boolean {
      if (!score) return false
      for (let i = 1; i <= 18; i++) {
        const holeKey = `hole${i}` as keyof typeof score
        if (score[holeKey] !== null && score[holeKey] !== undefined) {
          return true
        }
      }
      return false
    }

    function extractHoleScores(score: any): number[] {
      if (!score) return Array(18).fill(0)
      return [
        score.hole1 ?? 0, score.hole2 ?? 0, score.hole3 ?? 0,
        score.hole4 ?? 0, score.hole5 ?? 0, score.hole6 ?? 0,
        score.hole7 ?? 0, score.hole8 ?? 0, score.hole9 ?? 0,
        score.hole10 ?? 0, score.hole11 ?? 0, score.hole12 ?? 0,
        score.hole13 ?? 0, score.hole14 ?? 0, score.hole15 ?? 0,
        score.hole16 ?? 0, score.hole17 ?? 0, score.hole18 ?? 0
      ]
    }

    function getTeamScores(player1Score: any, player2Score: any): number[][] {
      const player1HasHoles = hasHoleScores(player1Score)
      const player2HasHoles = hasHoleScores(player2Score)

      if (player1HasHoles && player2HasHoles) {
        return [
          extractHoleScores(player1Score),
          extractHoleScores(player2Score)
        ]
      }

      if (player1HasHoles && !player2HasHoles) {
        const player1Scores = extractHoleScores(player1Score)
        return [player1Scores, player1Scores]
      }

      if (!player1HasHoles && player2HasHoles) {
        const player2Scores = extractHoleScores(player2Score)
        return [player2Scores, player2Scores]
      }

      return [[], []]
    }

    const team1Scores = getTeamScores(team1Player1Score, team1Player2Score)
    const team2Scores = getTeamScores(team2Player1Score, team2Player2Score)

    // Check if we have valid scores for both teams
    if (team1Scores.length === 0 || team1Scores[0].length === 0 || team1Scores.every(s => s.every(h => h === 0))) {
      continue // Skip if team 1 has no hole-by-hole scores
    }

    if (team2Scores.length === 0 || team2Scores[0].length === 0 || team2Scores.every(s => s.every(h => h === 0))) {
      continue // Skip if team 2 has no hole-by-hole scores
    }

    // Calculate match play points - filter out 0 scores
    function calculateMatchPlayFiltered(team1Scores: number[][], team2Scores: number[][]): { team1Points: number; team2Points: number } {
      let team1Points = 0
      let team2Points = 0

      for (let hole = 0; hole < 18; hole++) {
        const team1HoleScores = team1Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)
        const team2HoleScores = team2Scores.map(s => s[hole]).filter(s => s !== null && s !== undefined && s > 0)

        if (team1HoleScores.length === 0 || team2HoleScores.length === 0) {
          continue
        }

        const team1Low = Math.min(...team1HoleScores)
        const team2Low = Math.min(...team2HoleScores)

        if (team1Low < team2Low) {
          team1Points++
        } else if (team2Low < team1Low) {
          team2Points++
        }
      }

      return { team1Points, team2Points }
    }

    const { team1Points, team2Points } = calculateMatchPlayFiltered(team1Scores, team2Scores)

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
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const data = await request.json()

    // Get the score to find weekId and playerId
    const existingScore = await prisma.score.findUnique({
      where: { id }
    })

    if (!existingScore) {
      return NextResponse.json({ error: 'Score not found' }, { status: 404 })
    }

    // Get the week to determine weekNumber
    const week = await prisma.week.findUnique({
      where: { id: existingScore.weekId },
      include: { league: true }
    })

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 })
    }

    // Get applied handicap for this round
    const appliedHandicap = await calculateAppliedHandicap(
      existingScore.playerId,
      week.leagueId,
      week.weekNumber
    )
    
    // Recalculate totals if hole scores are provided
    let front9 = data.front9 ?? existingScore.front9 ?? 0
    let back9 = data.back9 ?? existingScore.back9 ?? 0
    let total = data.total ?? existingScore.total ?? 0
    
    // If total is not provided, calculate from existing score
    if (total === 0 && existingScore.total) {
      total = existingScore.total
    }
    
    // If individual holes are provided, recalculate from holes
    if (data.hole1 !== undefined || data.hole2 !== undefined) {
      const holes = [
        data.hole1 ?? existingScore.hole1 ?? 0,
        data.hole2 ?? existingScore.hole2 ?? 0,
        data.hole3 ?? existingScore.hole3 ?? 0,
        data.hole4 ?? existingScore.hole4 ?? 0,
        data.hole5 ?? existingScore.hole5 ?? 0,
        data.hole6 ?? existingScore.hole6 ?? 0,
        data.hole7 ?? existingScore.hole7 ?? 0,
        data.hole8 ?? existingScore.hole8 ?? 0,
        data.hole9 ?? existingScore.hole9 ?? 0,
        data.hole10 ?? existingScore.hole10 ?? 0,
        data.hole11 ?? existingScore.hole11 ?? 0,
        data.hole12 ?? existingScore.hole12 ?? 0,
        data.hole13 ?? existingScore.hole13 ?? 0,
        data.hole14 ?? existingScore.hole14 ?? 0,
        data.hole15 ?? existingScore.hole15 ?? 0,
        data.hole16 ?? existingScore.hole16 ?? 0,
        data.hole17 ?? existingScore.hole17 ?? 0,
        data.hole18 ?? existingScore.hole18 ?? 0,
      ]
      front9 = holes.slice(0, 9).reduce((sum, score) => sum + (score || 0), 0)
      back9 = holes.slice(9, 18).reduce((sum, score) => sum + (score || 0), 0)
      total = front9 + back9
    }
    
    // Always recalculate weighted score: unweighted score (total) minus applied handicap, rounded to whole number
    const weightedScore = Math.round(total - appliedHandicap)

    // Prepare update data - only include fields that are provided
    const updateData: any = {}
    if (data.hole1 !== undefined) updateData.hole1 = data.hole1
    if (data.hole2 !== undefined) updateData.hole2 = data.hole2
    if (data.hole3 !== undefined) updateData.hole3 = data.hole3
    if (data.hole4 !== undefined) updateData.hole4 = data.hole4
    if (data.hole5 !== undefined) updateData.hole5 = data.hole5
    if (data.hole6 !== undefined) updateData.hole6 = data.hole6
    if (data.hole7 !== undefined) updateData.hole7 = data.hole7
    if (data.hole8 !== undefined) updateData.hole8 = data.hole8
    if (data.hole9 !== undefined) updateData.hole9 = data.hole9
    if (data.hole10 !== undefined) updateData.hole10 = data.hole10
    if (data.hole11 !== undefined) updateData.hole11 = data.hole11
    if (data.hole12 !== undefined) updateData.hole12 = data.hole12
    if (data.hole13 !== undefined) updateData.hole13 = data.hole13
    if (data.hole14 !== undefined) updateData.hole14 = data.hole14
    if (data.hole15 !== undefined) updateData.hole15 = data.hole15
    if (data.hole16 !== undefined) updateData.hole16 = data.hole16
    if (data.hole17 !== undefined) updateData.hole17 = data.hole17
    if (data.hole18 !== undefined) updateData.hole18 = data.hole18
    if (front9 !== undefined) updateData.front9 = front9
    if (back9 !== undefined) updateData.back9 = back9
    if (total !== undefined) updateData.total = total
    // Always recalculate weighted score: unweighted score (total) minus handicap
    updateData.weightedScore = weightedScore

    const score = await prisma.score.update({
      where: { id },
      data: updateData,
      include: {
        week: {
          include: {
            league: true
          }
        }
      }
    })

    // If total was updated, check if week is complete and process accordingly
    if (data.total !== undefined || data.hole1 !== undefined) {
      const checkAndProcessWeek = async () => {
        try {
          // Get all players in the league
          const allPlayers = await prisma.player.findMany({
            where: { leagueId: score.week.league.id }
          })

          // Get all scores for this week that have a total (unweighted total score)
          const weekScores = await prisma.score.findMany({
            where: {
              weekId: existingScore.weekId,
              total: { not: null }
            },
            select: { playerId: true }
          })

          const uniquePlayersWithScores = new Set(weekScores.map(s => s.playerId))
          const allPlayersSubmitted = allPlayers.length > 0 && uniquePlayersWithScores.size === allPlayers.length

          if (allPlayersSubmitted) {
            console.log(`All players have submitted scores for week ${score.week.weekNumber}. Processing...`)
            
            // Process the round to calculate raw handicaps and update handicaps
            await processCompletedRound(score.week.league.id, score.week.weekNumber)
            console.log(`Successfully processed round ${score.week.weekNumber} for league ${score.week.league.id}`)
            
            // Calculate matches for this week
            await calculateMatchesForWeek(existingScore.weekId)
            console.log(`Successfully calculated matches for week ${score.week.weekNumber}`)

            // If this is week 4 or later, calculate handicaps for next week
            if (score.week.weekNumber >= 4 && !score.week.isChampionship && score.week.weekNumber < 12) {
              const nextWeekNumber = score.week.weekNumber + 1
              const nextWeek = await prisma.week.findFirst({
                where: {
                  leagueId: score.week.league.id,
                  weekNumber: nextWeekNumber,
                  isChampionship: false
                }
              })

              if (nextWeek) {
                for (const player of allPlayers) {
                  try {
                    await calculateAppliedHandicap(player.id, score.week.league.id, nextWeekNumber)
                  } catch (error) {
                    console.error(`Error calculating handicap for player ${player.id} for week ${nextWeekNumber}:`, error)
                  }
                }
                console.log(`Calculated handicaps for week ${nextWeekNumber}`)
              }
            }
          } else {
            console.log(`Week ${score.week.weekNumber} not complete yet. ${uniquePlayersWithScores.size}/${allPlayers.length} players have submitted scores.`)
            // Still calculate matches for this week (in case some matches can be calculated)
            await calculateMatchesForWeek(existingScore.weekId)
          }
        } catch (error) {
          console.error('Error in checkAndProcessWeek (update):', error)
        }
      }

      // Run asynchronously to not block the response
      checkAndProcessWeek().catch(error => {
        console.error('Error processing week completion after update:', error)
      })
      
      // Also run legacy code for backward compatibility
      processCompletedRound(score.week.league.id, score.week.weekNumber)
        .then(() => {
          return calculateMatchesForWeek(existingScore.weekId)
        })
        .then(() => {
          console.log(`Successfully recalculated matches for week ${score.week.weekNumber} after score update`)
        })
        .catch(error => {
          console.error('Error processing completed round after score update:', error)
        })
      
      // Ensure all weighted scores are calculated
      ensureAllWeightedScores(score.week.league.id).catch(error => {
        console.error('Error ensuring weighted scores:', error)
      })
    }

    return NextResponse.json(score)
  } catch (error: any) {
    console.error('Error updating score:', error)
    const errorMessage = error?.message || 'Failed to update score'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

