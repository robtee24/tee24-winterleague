import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const match = await prisma.match.findUnique({
      where: { id },
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

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    return NextResponse.json(match)
  } catch (error: any) {
    console.error('Error fetching match:', error)
    const errorMessage = error?.message || 'Failed to fetch match'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const data = await request.json()

    const match = await prisma.match.update({
      where: { id },
      data,
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

    return NextResponse.json(match)
  } catch (error: any) {
    console.error('Error updating match:', error)
    const errorMessage = error?.message || 'Failed to update match'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    await prisma.match.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Match deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting match:', error)
    const errorMessage = error?.message || 'Failed to delete match'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

