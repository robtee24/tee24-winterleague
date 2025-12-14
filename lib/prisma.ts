import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Handle connection cleanup in serverless environments
if (process.env.NODE_ENV === 'production') {
  // In production (serverless), don't reuse the client across requests
  // Each request gets a fresh connection from the pool
} else {
  // In development, reuse the client
  globalForPrisma.prisma = prisma
}



