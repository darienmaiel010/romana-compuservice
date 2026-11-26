import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const amount = Number(body.amount ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "El abono debe ser mayor que cero." }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: id,
      amount,
      method: String(body.method ?? "").trim() || null,
      note: String(body.note ?? "").trim() || null,
      createdBy: user.id,
    },
  });
  await prisma.orderHistory.create({
    data: {
      orderId: id,
      userId: user.id,
      action: "Pago registrado",
      comment: `Abono RD$ ${amount.toFixed(2)}`,
    },
  });
  return NextResponse.json({ payment }, { status: 201 });
}
