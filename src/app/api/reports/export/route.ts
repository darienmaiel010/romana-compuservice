import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "orders";
  if (type !== "orders" && type !== "customers") {
    return NextResponse.json({ error: "Tipo de reporte no válido." }, { status: 400 });
  }

  let csv = "";
  if (type === "customers") {
    const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
    csv = "Nombre,Telefono,WhatsApp,Direccion\n";
    csv += customers.map((customer) =>
      [customer.name, customer.phone ?? "", customer.whatsapp ?? "", customer.address ?? ""]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ).join("\n");
  } else {
    const orders = await prisma.repairOrder.findMany({
      include: { customer: true, equipment: true, payments: true, budgets: true },
      orderBy: { receivedAt: "desc" },
    });
    csv = "Orden,Cliente,Equipo,Marca,Modelo,Problema,Estado,Recibido,Presupuesto,Abonos,Balance\n";
    csv += orders.map((order) => {
      const budget = order.budgets[0] ? Number(order.budgets[0].total) : 0;
      const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return [
        order.orderNumber,
        order.customer.name,
        order.equipment.type,
        order.equipment.brand ?? "",
        order.equipment.model ?? "",
        order.reportedProblem,
        order.status,
        order.receivedAt.toISOString(),
        budget.toFixed(2),
        paid.toFixed(2),
        (budget - paid).toFixed(2),
      ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
    }).join("\n");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-romana.csv"`,
    },
  });
}
