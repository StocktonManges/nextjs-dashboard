import postgres from "postgres";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
} from "./definitions";
import { formatCurrency } from "./utils";
import { prisma } from "@/prisma/prisma-client";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export async function fetchRevenue() {
  try {
    console.log("Fetching revenue data...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log("Data fetch completed after 3 seconds.");

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoice.findMany({
      select: {
        amount: true,
        id: true,
        customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 5,
    });

    const latestInvoices = data.map((invoice) => ({
      amount: formatCurrency(invoice.amount),
      id: invoice.id,
      name: invoice.customer.name,
      email: invoice.customer.email,
      image_url: invoice.customer.image_url,
    }));

    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    const [
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
      numberOfCustomers,
    ] = await Promise.all([
      prisma.invoice.count(),

      prisma.invoice.count({
        where: { status: "paid" },
      }),

      prisma.invoice.count({
        where: { status: "pending" },
      }),

      prisma.customer.count(),
    ]);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
  const q = query.replace(",", "");

  try {
    const invoices = await prisma.$queryRaw<InvoicesTable[]>`
      SELECT
        "Invoice".id,
        "Invoice".amount,
        "Invoice".date,
        "Invoice".status,
        "Customer".name,
        "Customer".email,
        "Customer".image_url
      FROM "Invoice"
      JOIN "Customer" ON "Invoice".customer_id = "Customer".id
      WHERE
        "Customer".name ILIKE ${`%${q}%`} OR
        "Customer".email ILIKE ${`%${q}%`} OR
        TO_CHAR("Invoice".amount, 'FM$999999999D00') ILIKE ${`%${q}%`} OR
        "Invoice".date::text ILIKE ${`%${q}%`} OR
        "Invoice".status ILIKE ${`%${q}%`}
      ORDER BY "Invoice".date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await prisma.$queryRaw`SELECT COUNT(*)
      FROM "Invoice"
      JOIN "Customer" ON "Invoice".customer_id = "Customer".id
      WHERE
        "Customer".name ILIKE ${`%${query}%`} OR
        "Customer".email ILIKE ${`%${query}%`} OR
        "Invoice".amount::text ILIKE ${`%${query}%`} OR
        "Invoice".date::text ILIKE ${`%${query}%`} OR
        "Invoice".status ILIKE ${`%${query}%`}
    `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await prisma.$queryRaw<InvoiceForm[]>`
      SELECT
        "Invoice".id,
        "Invoice".customer_id,
        "Invoice".amount,
        "Invoice".status
      FROM "Invoice"
      WHERE "Invoice".id = ${id};
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const customers = await prisma.$queryRaw<CustomerField[]>`
      SELECT
        id,
        name
      FROM "Customer"
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await prisma.$queryRaw<CustomersTableType[]>`
		SELECT
		  "Customer".id,
		  "Customer".name,
		  "Customer".email,
		  "Customer".image_url,
		  COUNT("Invoice".id) AS total_invoices,
		  SUM(CASE WHEN "Invoice".status = 'pending' THEN "Invoice".amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN "Invoice".status = 'paid' THEN "Invoice".amount ELSE 0 END) AS total_paid
		FROM "Customer"
		LEFT JOIN "Invoice" ON "Customer".id = "Invoice".customer_id
		WHERE
		  "Customer".name ILIKE ${`%${query}%`} OR
        "Customer".email ILIKE ${`%${query}%`}
		GROUP BY "Customer".id, "Customer".name, "Customer".email, "Customer".image_url
		ORDER BY "Customer".name ASC
	  `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
