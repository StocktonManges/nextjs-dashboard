import bcrypt from "bcrypt";
import {
  users,
  customers,
  invoices,
  revenue,
} from "../app/lib/placeholder-data";
import { prisma } from "./prisma-client";

async function seedUsers() {
  const usersWithHashedPasswords = await Promise.all(
    users.map(async (user) => ({
      ...user,
      password: await bcrypt.hash(user.password, 10),
    }))
  );

  return await prisma.user.createMany({
    data: usersWithHashedPasswords,
    skipDuplicates: true,
  });
}

async function seedCustomers() {
  return await prisma.customer.createMany({
    data: customers,
    skipDuplicates: true,
  });
}

async function seedInvoices() {
  return await prisma.invoice.createMany({
    data: invoices.map((invoice) => ({
      ...invoice,
      date: new Date(invoice.date),
    })),
    skipDuplicates: true,
  });
}

async function seedRevenue() {
  return await prisma.revenue.createMany({
    data: revenue,
    skipDuplicates: true,
  });
}

async function main() {
  console.log("🌱 Seeding database...");
  await seedUsers();
  await seedCustomers();
  await seedInvoices();
  await seedRevenue();
  console.log("✅ Seeding complete.");
}

main()
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
