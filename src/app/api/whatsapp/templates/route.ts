import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const templates = await prisma.whatsappTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ templates });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const body = await request.json();
  const id = String(body.id ?? "");
  const text = String(body.body ?? "").trim();
  if (!id || !text) {
    return NextResponse.json({ error: "Plantilla y texto son obligatorios." }, { status: 400 });
  }
  const template = await prisma.whatsappTemplate.update({
    where: { id },
    data: { body: text, active: body.active !== false },
  });
  return NextResponse.json({ template });
}
