import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const now = new Date();
  const critical = await prisma.repairOrder.findMany({
    where: {
      status: { notIn: ["ENTREGADO", "CANCELADO"] },
      receivedAt: { lt: new Date(now.getTime() - 15 * 86400000) },
    },
    include: { customer: true },
  });

  let created = 0;
  for (const order of critical) {
    const exists = await prisma.notification.findFirst({
      where: { type: "CRITICAL_TIME", orderId: order.id, read: false },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          type: "CRITICAL_TIME",
          title: "Equipo crítico",
          message: `La orden ${order.orderNumber} lleva más de 15 días y pertenece a ${order.customer.name}.`,
          severity: "CRITICO",
          orderId: order.id,
        },
      });
      created += 1;
    }
  }

  return NextResponse.json({ created });
}
