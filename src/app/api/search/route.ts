import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ customers: [], orders: [] });

  const [customers, orders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { phone: { contains: query } },
          { whatsapp: { contains: query } },
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    }),
    prisma.repairOrder.findMany({
      where: {
        OR: [
          { orderNumber: { contains: query } },
          { reportedProblem: { contains: query } },
          { customer: { name: { contains: query } } },
          { customer: { phone: { contains: query } } },
          { customer: { whatsapp: { contains: query } } },
          { equipment: { serialNumber: { contains: query } } },
          { equipment: { brand: { contains: query } } },
          { equipment: { model: { contains: query } } },
        ],
      },
      take: 10,
      include: { customer: true, equipment: true },
      orderBy: { receivedAt: "desc" },
    }),
  ]);
  return NextResponse.json({ customers, orders });
}
