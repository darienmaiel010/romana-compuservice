import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const search = new URL(request.url).searchParams.get("search")?.trim();
  const orders = await prisma.repairOrder.findMany({
    where: search
      ? {
          OR: [
            { orderNumber: { contains: search } },
            { reportedProblem: { contains: search } },
            { customer: { name: { contains: search } } },
            { customer: { phone: { contains: search } } },
            { customer: { whatsapp: { contains: search } } },
            { equipment: { serialNumber: { contains: search } } },
            { equipment: { model: { contains: search } } },
            { equipment: { brand: { contains: search } } },
          ],
        }
      : undefined,
    include: {
      customer: true,
      equipment: true,
      technician: true,
      budgets: { orderBy: { createdAt: "desc" }, take: 1 },
      payments: true,
    },
    orderBy: { receivedAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = await request.json();
  const customerId = String(body.customerId ?? "");
  const equipmentId = String(body.equipmentId ?? "");
  const reportedProblem = String(body.reportedProblem ?? "").trim();

  if (!customerId || !equipmentId || !reportedProblem) {
    return NextResponse.json(
      { error: "Cliente, equipo y problema son obligatorios." },
      { status: 400 },
    );
  }

  const year = new Date().getFullYear();
  const latest = await prisma.repairOrder.findFirst({
    where: { orderNumber: { startsWith: `${year}-` } },
    orderBy: { orderNumber: "desc" },
  });
  const sequence = latest
    ? Number(latest.orderNumber.split("-")[1] ?? "0") + 1
    : 1771;
  const orderNumber = `${year}-${String(sequence).padStart(7, "0")}`;

  const order = await prisma.repairOrder.create({
    data: {
      orderNumber,
      customerId,
      equipmentId,
      reportedProblem,
      diagnosis: String(body.diagnosis ?? "").trim() || null,
      status: "RECIBIDO",
      technicianId: body.technicianId ? String(body.technicianId) : null,
      estimatedDate: body.estimatedDate ? new Date(String(body.estimatedDate)) : null,
      history: {
        create: {
          action: "Equipo recibido",
          newStatus: "RECIBIDO",
          userId: user.id,
        },
      },
    },
    include: { customer: true, equipment: true, history: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
