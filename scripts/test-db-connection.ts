import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Testing database connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET')
  
  try {
    const leagues = await prisma.league.findMany({
      orderBy: { name: 'asc' }
    })
    
    console.log(`✅ Connection successful!`)
    console.log(`Found ${leagues.length} leagues:`)
    leagues.forEach(league => {
      console.log(`  - ${league.name} (ID: ${league.id})`)
    })
    
    // Also check weeks and courses
    const weeks = await prisma.week.findMany({
      include: { league: true }
    })
    console.log(`\nFound ${weeks.length} weeks`)
    
    const courses = await prisma.course.findMany({
      include: { league: true }
    })
    console.log(`Found ${courses.length} courses`)
    
    // Group by league
    const clarksvilleCourses = courses.filter(c => c.league.name === 'Clarksville')
    const louisvilleCourses = courses.filter(c => c.league.name === 'Louisville')
    
    console.log(`\nClarksville: ${clarksvilleCourses.length} courses`)
    console.log(`Louisville: ${louisvilleCourses.length} courses`)
    
  } catch (error: any) {
    console.error('❌ Database connection failed!')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })

