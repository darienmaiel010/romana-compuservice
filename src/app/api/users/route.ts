import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    const password = String(body.password ?? "");
    const role = String(body.role ?? "RECEPCION");

    if (!name || !username || !password) {
      return NextResponse.json({ error: "Nombre, usuario y contraseña son obligatorios." }, { status: 400 });
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return NextResponse.json({ error: "El usuario debe tener 3-30 caracteres: letras, números, punto, guion o guion bajo." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    if (!["ADMINISTRADOR", "RECEPCION", "TECNICO"].includes(role)) {
      return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: role as "ADMINISTRADOR" | "RECEPCION" | "TECNICO",
      },
      select: { id: true, name: true, username: true, email: true, role: true, active: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ya existe un usuario o correo registrado." }, { status: 409 });
    }
    return NextResponse.json({ error: "No fue posible crear el usuario." }, { status: 500 });
  }
}
