import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();

  try {
    const data: {
      name?: string;
      username?: string;
      role?: "ADMINISTRADOR" | "RECEPCION" | "TECNICO";
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (typeof body.username === "string") {
      const username = body.username.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return NextResponse.json(
          { error: "El usuario debe tener 3-30 caracteres: letras, números, punto, guion o guion bajo." },
          { status: 400 },
        );
      }
      data.username = username;
    }
    if (typeof body.active === "boolean") data.active = body.active;
    if (["ADMINISTRADOR", "RECEPCION", "TECNICO"].includes(String(body.role))) {
      data.role = body.role;
    }
    if (typeof body.password === "string" && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 8 caracteres." },
          { status: 400 },
        );
      }
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, username: true, email: true, role: true, active: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: "No fue posible actualizar el usuario." },
      { status: 500 },
    );
  }
}
