import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const player = await prisma.player.findUnique({
      where: { id }
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json(player)
  } catch (error) {
    console.error('Error fetching player:', error)
    return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const data = await request.json()

    const player = await prisma.player.update({
      where: { id },
      data
    })

    return NextResponse.json(player)
  } catch (error) {
    console.error('Error updating player:', error)
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    // Delete all scores for this player
    await prisma.score.deleteMany({
      where: { playerId: id }
    })

    // Delete all handicaps for this player
    await prisma.handicap.deleteMany({
      where: { playerId: id }
    })

    // Delete the player
    await prisma.player.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Player and all related data deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting player:', error)
    const errorMessage = error?.message || 'Failed to delete player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

