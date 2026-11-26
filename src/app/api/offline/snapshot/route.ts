import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const [customers, equipment, orders] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      select: {
        id: true,
        customerId: true,
        type: true,
        brand: true,
        model: true,
        serialNumber: true,
        accessories: true,
        physicalState: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.repairOrder.findMany({
      include: {
        customer: true,
        equipment: {
          select: {
            id: true,
            customerId: true,
            type: true,
            brand: true,
            model: true,
            serialNumber: true,
            accessories: true,
            physicalState: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        history: { orderBy: { createdAt: "desc" } },
        budgets: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  return NextResponse.json(
    { customers, equipment, orders, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
