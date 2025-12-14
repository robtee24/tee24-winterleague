import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create leagues
  const louisville = await prisma.league.upsert({
    where: { name: 'Louisville' },
    update: {},
    create: {
      name: 'Louisville',
    },
  })

  const clarksville = await prisma.league.upsert({
    where: { name: 'Clarksville' },
    update: {},
    create: {
      name: 'Clarksville',
    },
  })

  console.log('Seeded leagues:', { louisville, clarksville })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })



