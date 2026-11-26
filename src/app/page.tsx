import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statuses = [
  ["RECIBIDO", "Equipos recibidos"],
  ["PENDIENTE_DIAGNOSTICO", "Pendientes"],
  ["DIAGNOSTICO_COMPLETADO", "Diagnósticos completos"],
  ["EN_REPARACION", "En reparación"],
  ["ESPERANDO_REPUESTOS", "Esperando repuestos"],
  ["ESPERANDO_APROBACION", "Esperando aprobación"],
  ["LISTO_PARA_ENTREGAR", "Listos para entregar"],
  ["ENTREGADO", "Entregados"],
] as const;

const navigationLinks = [
  ["Dashboard", "/"],
  ["Nueva orden", "/ordenes/nueva"],
  ["Órdenes", "/ordenes"],
  ["Clientes", "/clientes"],
  ["Equipos", "/equipos"],
  ["Presupuestos", "/presupuestos"],
  ["Avisos y alertas", "/notificaciones"],
  ["Reportes", "/reportes"],
  ["Sincronización", "/sincronizacion"],
  ["Modo sin conexión", "/offline"],
  ["Usuarios", "/usuarios"],
  ["Configuración", "/configuracion"],
] as const;

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  const today = new Date();

  const [counts, pending, waitingApproval, notifications] = await Promise.all([
    prisma.repairOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.repairOrder.findMany({
      where: { status: { notIn: ["ENTREGADO", "CANCELADO"] } },
      include: { customer: true, equipment: true },
      orderBy: { receivedAt: "asc" },
      take: 10,
    }),
    prisma.repairOrder.count({ where: { status: "ESPERANDO_APROBACION" } }),
    prisma.notification.findMany({
      where: { read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((item) => [item.status, item._count._all]),
  );

  const cards = statuses.map(([status, label]) => ({
    label,
    value: countMap[status] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-950 lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[255px] flex-col bg-[#111111] lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Image
            src="/brand/romana-logo.jpeg"
            alt="ROMANA COMPUSERVICE"
            width={768}
            height={768}
            priority
            className="h-[150px] w-[150px] object-contain"
          />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navigationLinks.map(([label, href], index) => (
            <Link
              key={label}
              href={href}
              className={`flex rounded-xl px-3 py-3 text-sm font-semibold ${
                index === 0
                  ? "bg-yellow-400 text-black"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm text-white">
          <p className="font-bold">{session.name}</p>
          <p className="text-xs text-gray-400">{session.role}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[255px]">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <nav aria-label="Navegación principal" className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navigationLinks.map(([label, href], index) => (
              <Link
                key={label}
                href={href}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                  index === 0
                    ? "bg-yellow-400 text-black"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <form action="/ordenes" className="hidden max-w-xl flex-1 sm:block">
              <input
                name="search"
                type="search"
                placeholder="Buscar orden, cliente, serie..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-yellow-400"
              />
            </form>
            <div className="ml-auto rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {waitingApproval} esperando aprobación
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">
                Datos reales
              </p>
              <h1 className="text-2xl font-black sm:text-3xl">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Resumen general del taller</p>
            </div>
            <Link
              href="/ordenes/nueva"
              className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-black"
            >
              + Nueva orden
            </Link>
          </div>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {cards.map((card) => (
              <article key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5">
                <p className="text-sm font-semibold leading-5 text-gray-500">{card.label}</p>
                <p className="mt-4 text-3xl font-black">{card.value}</p>
              </article>
            ))}
          </section>

          {notifications.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-black">Notificaciones</h2>
                <Link href="/notificaciones" className="text-sm font-bold">Ver avisos →</Link>
              </div>
              <div className="mt-3 space-y-2">
                {notifications.map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                    <b>{item.title}</b> — {item.message}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="mt-6 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5">
              <div>
                <h2 className="font-black">Avisos y alertas</h2>
                <p className="mt-1 text-sm text-gray-500">Consulta equipos críticos, aprobaciones y entregas pendientes.</p>
              </div>
              <Link href="/notificaciones" className="text-sm font-bold">Abrir avisos →</Link>
            </section>
          )}

          <section className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-black">Equipos pendientes</h2>
              <Link href="/ordenes" className="text-sm font-bold">Ver todos →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Orden</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Equipo</th>
                    <th className="px-5 py-3">Problema</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Días</th>
                    <th className="px-5 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                        No hay equipos pendientes.
                      </td>
                    </tr>
                  ) : pending.map((order) => {
                    const days = Math.max(
                      0,
                      Math.floor((today.getTime() - order.receivedAt.getTime()) / 86400000),
                    );
                    return (
                      <tr key={order.id}>
                        <td className="px-5 py-4 font-bold">#{order.orderNumber}</td>
                        <td className="px-5 py-4">{order.customer.name}</td>
                        <td className="px-5 py-4">{order.equipment.brand} {order.equipment.model}</td>
                        <td className="px-5 py-4">{order.reportedProblem}</td>
                        <td className="px-5 py-4">{order.status.replaceAll("_", " ")}</td>
                        <td className="px-5 py-4">{days}d</td>
                        <td className="px-5 py-4">
                          <Link href={`/ordenes/${order.id}`} className="font-bold">Ver</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
