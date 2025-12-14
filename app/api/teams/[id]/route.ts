import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    // Delete all matches associated with this team
    await prisma.match.deleteMany({
      where: {
        OR: [
          { team1Id: id },
          { team2Id: id }
        ]
      }
    })

    // Delete the team
    await prisma.team.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Team deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting team:', error)
    const errorMessage = error?.message || 'Failed to delete team'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}



