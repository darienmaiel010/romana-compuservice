import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PresupuestosPage() {
  if (!(await getSession())) redirect("/login");
  const budgets = await prisma.budget.findMany({
    include: { order: { include: { customer: true, equipment: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Presupuestos</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>
        <section className="overflow-hidden rounded-2xl bg-white">
          {budgets.length === 0 ? (
            <p className="p-6 text-gray-500">No hay presupuestos registrados.</p>
          ) : budgets.map((budget) => (
            <div key={budget.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
              <div>
                <p className="font-black">Orden #{budget.order.orderNumber}</p>
                <p className="text-sm text-gray-600">{budget.order.customer.name} — {budget.order.equipment.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">RD$ {Number(budget.total).toLocaleString("es-DO")}</p>
                <Link href={`/ordenes/${budget.orderId}`} className="text-sm font-bold">Ver presupuesto</Link>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
