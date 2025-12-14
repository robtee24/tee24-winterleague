import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const { handicap } = await request.json()

    const updated = await prisma.handicap.update({
      where: { id },
      data: { handicap: parseFloat(handicap) }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating handicap:', error)
    return NextResponse.json({ error: 'Failed to update handicap' }, { status: 500 })
  }
}



