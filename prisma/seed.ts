import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !username || !password) {
    throw new Error("ADMIN_EMAIL, ADMIN_USERNAME y ADMIN_PASSWORD son obligatorios.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name: "Administrador",
      username,
      role: UserRole.ADMINISTRADOR,
      active: true,
    },
    create: {
      name: "Administrador",
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMINISTRADOR,
      active: true,
    },
  });

  const templates = [
    {
      name: "Equipo recibido",
      body: "Hola {{cliente}}. Hemos recibido su equipo en ROMANA COMPUSERVICE.\n\nOrden: {{orden}}\nEquipo: {{equipo}}\n\nGracias por confiar en nosotros.",
    },
    {
      name: "Presupuesto",
      body: "Hola {{cliente}}. El diagnóstico de su equipo está listo.\n\nOrden: {{orden}}\nTotal del presupuesto: RD$ {{total}}\n\nPor favor indíquenos si autoriza la reparación.",
    },
    {
      name: "Listo para entregar",
      body: "Hola {{cliente}}. Su equipo ya está listo para entregar.\n\nOrden: {{orden}}\nBalance pendiente: RD$ {{balance}}\n\nROMANA COMPUSERVICE",
    },
  ];

  for (const template of templates) {
    await prisma.whatsappTemplate.upsert({
      where: { name: template.name },
      update: { body: template.body },
      create: template,
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
