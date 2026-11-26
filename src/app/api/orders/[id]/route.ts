import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const { id } = await context.params;
  const order = await prisma.repairOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      equipment: true,
      technician: true,
      history: { orderBy: { createdAt: "desc" } },
      budgets: { orderBy: { createdAt: "desc" }, take: 1 },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ order });
}
