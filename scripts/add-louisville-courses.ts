import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const louisvilleCourses = [
  { week: 1, name: 'Coldwater Golf Links' },
  { week: 2, name: 'Mammoth Dunes' },
  { week: 3, name: 'Streamsong Blue' },
  { week: 4, name: 'Quintero Golf Club' },
  { week: 5, name: 'Wolf Creek' },
  { week: 6, name: 'Paynes Valley' },
  { week: 7, name: 'Ballyhack / Tobacco Road' },
  { week: 8, name: 'Tara Iti Golf Club' },
  { week: 9, name: 'Medalist Golf Club' },
  { week: 10, name: 'Bandon Dunes Golf Resort' },
  { week: 11, name: 'Royal Melbourne Golf Club' },
  { week: 12, name: 'Pine Valley Golf Club' }, // Championship
]

async function addLouisvilleCourses() {
  try {
    // Find Louisville league
    const louisvilleLeague = await prisma.league.findUnique({
      where: { name: 'Louisville' }
    })

    if (!louisvilleLeague) {
      console.error('Louisville league not found')
      return
    }

    console.log(`Found Louisville league with ID: ${louisvilleLeague.id}`)

    // Add or update courses for each week
    for (const course of louisvilleCourses) {
      // Check if course already exists for this week
      const existingCourse = await prisma.course.findFirst({
        where: {
          leagueId: louisvilleLeague.id,
          week: course.week
        }
      })

      if (existingCourse) {
        // Update existing course
        await prisma.course.update({
          where: { id: existingCourse.id },
          data: { name: course.name }
        })
        console.log(`Updated course for Week ${course.week}: ${course.name}`)
      } else {
        // Create new course
        await prisma.course.create({
          data: {
            name: course.name,
            week: course.week,
            leagueId: louisvilleLeague.id
          }
        })
        console.log(`Created course for Week ${course.week}: ${course.name}`)
      }
    }

    console.log('\n✅ Successfully added/updated all Louisville courses!')
  } catch (error) {
    console.error('Error adding courses:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addLouisvilleCourses()



