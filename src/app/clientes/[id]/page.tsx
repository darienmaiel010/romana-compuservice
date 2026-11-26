import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppLink } from "@/lib/phone";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getSession())) redirect("/login");
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      equipment: true,
      orders: {
        include: { equipment: true, budgets: true, payments: true },
        orderBy: { receivedAt: "desc" },
      },
    },
  });
  if (!customer) redirect("/clientes");
  const whatsappLink = buildWhatsAppLink(
    customer.whatsapp ?? customer.phone,
    customer.name,
  );

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">{customer.name}</h1>
          <Link href="/clientes" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Volver</Link>
        </div>
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Teléfono</p><p className="mt-2 font-bold">{customer.phone ?? "-"}</p></article>
          <article className="rounded-2xl bg-white p-5">
            <p className="text-sm text-gray-500">WhatsApp</p>
            <p className="mt-2 font-bold">{customer.whatsapp ?? "-"}</p>
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-bold text-green-700"
              >
                Escribir por WhatsApp
              </a>
            ) : (
              <p className="mt-3 text-sm text-gray-400">No hay un número válido para WhatsApp.</p>
            )}
          </article>
          <article className="rounded-2xl bg-white p-5"><p className="text-sm text-gray-500">Dirección</p><p className="mt-2 font-bold">{customer.address ?? "-"}</p></article>
        </section>
        <section className="mt-6 rounded-2xl bg-white p-5">
          <h2 className="text-xl font-black">Historial de reparaciones</h2>
          {customer.orders.length === 0 ? (
            <p className="mt-3 text-gray-500">Este cliente no tiene órdenes registradas.</p>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {customer.orders.map((order) => {
                const budget = order.budgets[0] ? Number(order.budgets[0].total) : 0;
                const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                return (
                  <Link key={order.id} href={`/ordenes/${order.id}`} className="block py-4">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-black">Orden #{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">{order.equipment.brand} {order.equipment.model} — {order.reportedProblem}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>Balance: <b>RD$ {(budget - paid).toLocaleString("es-DO")}</b></p>
                        <p className="text-gray-500">{order.status.replaceAll("_", " ")}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
