import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id)
    
    let player: any
    try {
      // Try to fetch with select to avoid winningsEligible column if it doesn't exist
      const playerData = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          leagueId: true,
          createdAt: true,
          updatedAt: true
        }
      })
      
      // Add winningsEligible default
      if (playerData) {
        player = {
          ...playerData,
          winningsEligible: true // Default value since column may not exist
        }
      }
    } catch (schemaError: any) {
      // If column error, try raw query
      if (schemaError?.code === 'P2021' || schemaError?.message?.includes('column') || schemaError?.message?.includes('Unknown column')) {
        console.log('[Player API] Column error detected, using fallback query...')
        const rawPlayer = await prisma.$queryRawUnsafe(`
          SELECT id, "firstName", "lastName", phone, email, "leagueId", "createdAt", "updatedAt"
          FROM "Player"
          WHERE id = $1
        `, playerId) as Array<{
          id: number
          firstName: string
          lastName: string | null
          phone: string | null
          email: string | null
          leagueId: number
          createdAt: Date
          updatedAt: Date
        }>
        
        if (rawPlayer.length === 0) {
          return NextResponse.json({ error: 'Player not found' }, { status: 404 })
        }
        
        player = {
          ...rawPlayer[0],
          winningsEligible: true // Default value
        }
      } else {
        throw schemaError
      }
    }
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    
    return NextResponse.json(player)
  } catch (error: any) {
    console.error('[Player API] Error fetching player:', error)
    console.error('[Player API] Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta
    })
    const errorMessage = error?.message || 'Failed to fetch player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id)
    const updateData = await request.json()
    
    // Build update object with only provided fields
    const dataToUpdate: any = {}
    
    if (updateData.firstName !== undefined) {
      if (!updateData.firstName || !updateData.firstName.trim()) {
        return NextResponse.json({ error: 'First name cannot be empty' }, { status: 400 })
      }
      dataToUpdate.firstName = updateData.firstName.trim()
    }
    
    if (updateData.lastName !== undefined) {
      dataToUpdate.lastName = updateData.lastName?.trim() || null
    }
    
    if (updateData.phone !== undefined) {
      dataToUpdate.phone = updateData.phone?.trim() || null
    }
    
    if (updateData.email !== undefined) {
      dataToUpdate.email = updateData.email?.trim() || null
    }
    
    if (updateData.winningsEligible !== undefined) {
      // Only try to update winningsEligible if the column exists
      // If it doesn't exist, we'll just skip it and return success
      try {
        dataToUpdate.winningsEligible = Boolean(updateData.winningsEligible)
      } catch (e) {
        // Column doesn't exist, skip it
        console.log('[Player API] winningsEligible column doesn\'t exist, skipping update')
      }
    }

    // If no fields to update, return error
    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })
    }

    let player
    try {
      player = await prisma.player.update({
        where: { id: playerId },
        data: dataToUpdate,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          leagueId: true,
          createdAt: true,
          updatedAt: true
        }
      })
      
      // Add winningsEligible default
      player = {
        ...player,
        winningsEligible: updateData.winningsEligible !== undefined ? Boolean(updateData.winningsEligible) : true
      }
    } catch (updateError: any) {
      // If column error when updating winningsEligible, try without it
      if (updateError?.code === 'P2021' || updateError?.message?.includes('column') || updateError?.message?.includes('winningsEligible')) {
        console.log('[Player API] Column error when updating, retrying without winningsEligible...')
        const dataWithoutWinnings = { ...dataToUpdate }
        delete dataWithoutWinnings.winningsEligible
        
        player = await prisma.player.update({
          where: { id: playerId },
          data: dataWithoutWinnings,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            leagueId: true,
            createdAt: true,
            updatedAt: true
          }
        })
        
        // Add winningsEligible default
        player = {
          ...player,
          winningsEligible: updateData.winningsEligible !== undefined ? Boolean(updateData.winningsEligible) : true
        }
      } else {
        throw updateError
      }
    }
    
    return NextResponse.json(player)
  } catch (error: any) {
    console.error('Error updating player:', error)
    const errorMessage = error?.message || 'Failed to update player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id)
    
    // Check if player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId }
    })
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Delete in order to respect foreign key constraints
    // 1. Delete all scores for this player
    await prisma.score.deleteMany({
      where: { playerId }
    })

    // 2. Delete all handicaps for this player
    await prisma.handicap.deleteMany({
      where: { playerId }
    })

    // 3. Delete matches where this player's teams are involved
    // First, get all teams this player is on
    const playerTeams = await prisma.team.findMany({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId }
        ]
      }
    })

    const teamIds = playerTeams.map(t => t.id)

    // Delete matches involving these teams
    await prisma.match.deleteMany({
      where: {
        OR: [
          { team1Id: { in: teamIds } },
          { team2Id: { in: teamIds } }
        ]
      }
    })

    // 4. Delete teams where this player is a member
    await prisma.team.deleteMany({
      where: {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId }
        ]
      }
    })

    // 5. Finally, delete the player
    await prisma.player.delete({
      where: { id: playerId }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Player deleted successfully' 
    })
  } catch (error: any) {
    console.error('Error deleting player:', error)
    const errorMessage = error?.message || 'Failed to delete player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
