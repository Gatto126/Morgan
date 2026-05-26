import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("No transactions to reclassify in the new split schema.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
