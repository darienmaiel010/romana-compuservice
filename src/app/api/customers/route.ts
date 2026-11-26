import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const search = new URL(request.url).searchParams.get("search")?.trim();
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { whatsapp: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true, equipment: true } },
    },
  });

  return NextResponse.json({ customers });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim() || null;
  const whatsapp = String(body.whatsapp ?? "").trim() || null;
  const address = String(body.address ?? "").trim() || null;
  const notes = String(body.notes ?? "").trim() || null;

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  const normalizedPhone = phone?.replace(/\D/g, "");
  const existing = normalizedPhone
    ? await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            ...(phone ? [{ phone }] : []),
            ...(whatsapp ? [{ whatsapp }] : []),
          ],
        },
      })
    : whatsapp
      ? await prisma.customer.findFirst({ where: { whatsapp } })
      : null;

  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un cliente con ese teléfono o WhatsApp.", customer: existing },
      { status: 409 },
    );
  }

  const customer = await prisma.customer.create({
    data: { name, phone: normalizedPhone, whatsapp, address, notes },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
