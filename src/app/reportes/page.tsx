import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReportesPage() {
  if (!(await getSession())) redirect("/login");
  const [customers, orders, delivered, payments] = await Promise.all([
    prisma.customer.count(),
    prisma.repairOrder.count(),
    prisma.repairOrder.count({ where: { status: "ENTREGADO" } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Reportes</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>
        <section className="grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Clientes</p><p className="mt-3 text-3xl font-black">{customers}</p></article>
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Órdenes</p><p className="mt-3 text-3xl font-black">{orders}</p></article>
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Entregadas</p><p className="mt-3 text-3xl font-black">{delivered}</p></article>
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Abonos registrados</p><p className="mt-3 text-2xl font-black">RD$ {Number(payments._sum.amount ?? 0).toLocaleString("es-DO")}</p></article>
        </section>
        <section className="mt-6 flex flex-wrap gap-3 rounded-2xl bg-white p-5">
          <a href="/api/reports/export?type=orders" className="rounded-xl bg-yellow-400 px-4 py-3 font-black">Exportar órdenes CSV</a>
          <a href="/api/reports/export?type=customers" className="rounded-xl border border-gray-200 px-4 py-3 font-bold">Exportar clientes CSV</a>
        </section>
      </div>
    </main>
  );
}
