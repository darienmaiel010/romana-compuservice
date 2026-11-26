import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const customerId = new URL(request.url).searchParams.get("customerId");
  const equipment = await prisma.equipment.findMany({
    where: customerId ? { customerId } : undefined,
    include: { customer: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ equipment });
}

export async function POST(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const body = await request.json();
  const customerId = String(body.customerId ?? "");
  const type = String(body.type ?? "").trim();
  if (!customerId || !type) {
    return NextResponse.json(
      { error: "Cliente y tipo de equipo son obligatorios." },
      { status: 400 },
    );
  }
  const equipment = await prisma.equipment.create({
    data: {
      customerId,
      type,
      brand: String(body.brand ?? "").trim() || null,
      model: String(body.model ?? "").trim() || null,
      serialNumber: String(body.serialNumber ?? "").trim() || null,
      accessories: String(body.accessories ?? "").trim() || null,
      physicalState: String(body.physicalState ?? "").trim() || null,
      passwordHint: String(body.passwordHint ?? "").trim() || null,
    },
  });
  return NextResponse.json({ equipment }, { status: 201 });
}
