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
  const labor = Number(body.labor ?? 0);
  const parts = Number(body.parts ?? 0);
  const other = Number(body.other ?? 0);
  const discount = Number(body.discount ?? 0);
  const total = labor + parts + other - discount;

  const budget = await prisma.budget.create({
    data: {
      orderId: id,
      labor,
      parts,
      other,
      discount,
      total,
      notes: String(body.notes ?? "").trim() || null,
      createdBy: user.id,
    },
  });

  await prisma.orderHistory.create({
    data: {
      orderId: id,
      userId: user.id,
      action: "Presupuesto creado",
      comment: `Total RD$ ${total.toFixed(2)}`,
    },
  });

  return NextResponse.json({ budget }, { status: 201 });
}
