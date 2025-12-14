import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const data = await request.json()
    const { name } = data

    if (name === undefined) {
      return NextResponse.json({ error: 'Course name is required' }, { status: 400 })
    }

    const course = await prisma.course.update({
      where: { id },
      data: { name: typeof name === 'string' ? name.trim() : '' }
    })

    return NextResponse.json(course)
  } catch (error: any) {
    console.error('Error updating course:', error)
    const errorMessage = error?.message || 'Failed to update course'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

