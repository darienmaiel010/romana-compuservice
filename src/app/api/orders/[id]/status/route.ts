import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const status = String(body.status ?? "");
  const allowed = [
    "RECIBIDO",
    "PENDIENTE_DIAGNOSTICO",
    "DIAGNOSTICO_COMPLETADO",
    "ESPERANDO_APROBACION",
    "APROBADO",
    "EN_REPARACION",
    "ESPERANDO_REPUESTOS",
    "LISTO_PARA_ENTREGAR",
    "ENTREGADO",
    "CANCELADO",
  ];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
  }
  const current = await prisma.repairOrder.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  }

  const order = await prisma.repairOrder.update({
    where: { id },
    data: {
      status: status as never,
      diagnosis: body.diagnosis !== undefined ? String(body.diagnosis) : current.diagnosis,
      workDone: body.workDone !== undefined ? String(body.workDone) : current.workDone,
      deliveredAt: status === "ENTREGADO" ? new Date() : current.deliveredAt,
      history: {
        create: {
          action: `Estado cambiado a ${status}`,
          previousStatus: current.status,
          newStatus: status as never,
          comment: String(body.comment ?? "").trim() || null,
          userId: user.id,
        },
      },
    },
  });
  return NextResponse.json({ order });
}
