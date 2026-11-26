import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json({ error: "Usuario y contraseña son obligatorios." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
    }

    await createSession({
      id: user.id,
      name: user.name,
      email: user.email ?? "",
      role: user.role,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No fue posible iniciar sesión." }, { status: 500 });
  }
}
