import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const now = new Date();
  const [critical, approval, ready, recent] = await Promise.all([
    prisma.repairOrder.count({
      where: {
        status: { notIn: ["ENTREGADO", "CANCELADO"] },
        receivedAt: { lt: new Date(now.getTime() - 15 * 86400000) },
      },
    }),
    prisma.repairOrder.count({ where: { status: "ESPERANDO_APROBACION" } }),
    prisma.repairOrder.count({ where: { status: "LISTO_PARA_ENTREGAR" } }),
    prisma.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    summary: { critical, approval, ready },
    notifications: recent,
  });
}

export async function PATCH(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !body.id.trim()) {
    return NextResponse.json({ error: "El identificador del aviso es obligatorio." }, { status: 400 });
  }

  const notification = await prisma.notification.findUnique({ where: { id: body.id } });
  if (!notification) {
    return NextResponse.json({ error: "Aviso no encontrado." }, { status: 404 });
  }

  const updated = await prisma.notification.update({
    where: { id: body.id },
    data: { read: true },
  });
  return NextResponse.json({ notification: updated });
}
