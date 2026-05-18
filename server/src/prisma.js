const { PrismaClient } = require("@prisma/client"); // imports Prisma Client so we can query the database from JavaScript
const { PrismaPg } = require("@prisma/adapter-pg"); // imports the PostgreSQL adapter required by Prisma 7

// Creates a PostgreSQL adapter using the DATABASE_URL from the .env file
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Creates one Prisma client instance connected to PostgreSQL through the adapter
const prisma = new PrismaClient({
  adapter,
});

// Exports the Prisma client so other backend files can use it
module.exports = prisma;