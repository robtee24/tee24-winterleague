import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id)
    const { firstName, lastName, phone, email } = await request.json()
    
    if (!firstName) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }

    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      }
    })
    
    return NextResponse.json(player)
  } catch (error: any) {
    console.error('Error updating player:', error)
    const errorMessage = error?.message || 'Failed to update player'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
