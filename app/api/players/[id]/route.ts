import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
