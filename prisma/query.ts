import { prisma } from "./prisma-client";

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT amount from "Invoice";
  `);

  console.log(tables);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(() => prisma.$disconnect());
