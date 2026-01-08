import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id)
    
    const player = await prisma.player.findUnique({
      where: { id: playerId }
    })
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    
    return NextResponse.json(player)
  } catch (error: any) {
    console.error('Error fetching player:', error)
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
      dataToUpdate.winningsEligible = Boolean(updateData.winningsEligible)
    }

    // If no fields to update, return error
    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })
    }

    const player = await prisma.player.update({
      where: { id: playerId },
      data: dataToUpdate
    })
    
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
