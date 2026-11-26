"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  reportedProblem: string;
  diagnosis: string | null;
  workDone: string | null;
  receivedAt: string;
  customer: { name: string; phone: string | null; whatsapp: string | null; address: string | null };
  equipment: { type: string; brand: string | null; model: string | null; serialNumber: string | null };
  history: Array<{ id: string; action: string; comment: string | null; createdAt: string }>;
  budgets: Array<{ id: string; labor: string; parts: string; other: string; discount: string; total: string; notes: string | null }>;
  payments: Array<{ id: string; amount: string; method: string | null; createdAt: string }>;
};

type WhatsappMessageType = "received" | "budget" | "ready";

const statuses = [
  "RECIBIDO",
  "PENDIENTE_DIAGNOSTICO",
  "DIAGNOSTICO_COMPLETADO",
  "ESPERANDO_APROBACION",
  "APROBADO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  "LISTO_PARA_ENTREGAR",
  "ENTREGADO",
  "CANCELADO",
];

export default function OrdenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void params.then(({ id: routeId }) => {
      setId(routeId);
      void fetch(`/api/orders/${routeId}`)
        .then((response) => response.json())
        .then((data) => setOrder(data.order ?? null));
    });
  }, [params]);

  async function changeStatus(status: string) {
    setMessage("");
    const response = await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No fue posible cambiar el estado.");
      return;
    }
    setOrder((current) => current ? { ...current, status } : current);
  }

  async function createBudget() {
    const labor = Number(window.prompt("Mano de obra RD$", "0") ?? 0);
    const parts = Number(window.prompt("Repuestos RD$", "0") ?? 0);
    const other = Number(window.prompt("Otros cargos RD$", "0") ?? 0);
    const discount = Number(window.prompt("Descuento RD$", "0") ?? 0);
    const response = await fetch(`/api/orders/${id}/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labor, parts, other, discount }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Presupuesto creado." : data.error);
  }

  async function createPayment() {
    const amount = Number(window.prompt("Monto del abono RD$", "0") ?? 0);
    if (!amount) return;
    const response = await fetch(`/api/orders/${id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method: "EFECTIVO" }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Abono registrado." : data.error);
  }

  async function sendWhatsapp(type: WhatsappMessageType) {
    setMessage("");
    const response = await fetch(`/api/orders/${id}/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, sender: "erika" }),
    });
    const data = await response.json();
    setMessage(data.message ?? data.error ?? "No se pudo confirmar la respuesta de WhatsApp.");
    if (response.ok) {
      const refreshed = await fetch(`/api/orders/${id}`);
      const refreshedData = await refreshed.json();
      if (refreshed.ok) setOrder(refreshedData.order);
    }
  }

  if (!order) {
    return <main className="min-h-screen bg-[#f4f5f7] p-8">Cargando orden...</main>;
  }

  const budget = order.budgets[0];
  const total = budget ? Number(budget.total) : 0;
  const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div><p className="text-xs font-bold text-yellow-600">ORDEN #{order.orderNumber}</p><h1 className="text-3xl font-black">{order.status.replaceAll("_", " ")}</h1></div>
          <Link href="/ordenes" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Volver</Link>
        </div>
        {message ? <p className="mb-4 rounded-xl bg-white px-4 py-3 font-bold">{message}</p> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-5"><h2 className="font-black">Cliente</h2><p className="mt-3 font-bold">{order.customer.name}</p><p>{order.customer.phone ?? "-"}</p><p>{order.customer.whatsapp ?? "-"}</p></section>
          <section className="rounded-2xl bg-white p-5"><h2 className="font-black">Equipo</h2><p className="mt-3 font-bold">{order.equipment.brand} {order.equipment.model}</p><p>{order.equipment.type}</p><p>Serie: {order.equipment.serialNumber ?? "Desconocido"}</p></section>
          <section className="rounded-2xl bg-white p-5"><h2 className="font-black">Balance</h2><p className="mt-3 text-sm">Presupuesto: RD$ {total.toLocaleString("es-DO")}</p><p className="text-sm">Abonos: RD$ {paid.toLocaleString("es-DO")}</p><p className="mt-2 text-xl font-black">Balance: RD$ {(total - paid).toLocaleString("es-DO")}</p></section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5"><h2 className="font-black">Problema reportado</h2><p className="mt-3 whitespace-pre-wrap">{order.reportedProblem}</p></section>
          <section className="rounded-2xl bg-white p-5"><h2 className="font-black">Diagnóstico técnico</h2><p className="mt-3 whitespace-pre-wrap">{order.diagnosis || "Sin diagnóstico registrado"}</p></section>
        </div>

        <section className="mt-4 rounded-2xl bg-white p-5">
          <h2 className="font-black">Acciones</h2>
          <p className="mt-2 text-sm text-gray-600">Línea emisora de WhatsApp: Erika (•••• 8736)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={order.status} onChange={(event) => changeStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 px-3">
              {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </select>
            <button onClick={createBudget} className="rounded-xl bg-yellow-400 px-4 py-2 font-black">Presupuesto</button>
            <button onClick={createPayment} className="rounded-xl border border-gray-200 px-4 py-2 font-bold">Registrar abono</button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-gray-200 px-4 py-2 font-bold"
            >
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={() => sendWhatsapp("received")}
              className="rounded-xl border border-green-200 px-4 py-2 font-bold text-green-800"
            >
              WhatsApp: recibido
            </button>
            <button
              type="button"
              onClick={() => sendWhatsapp("budget")}
              className="rounded-xl border border-green-200 px-4 py-2 font-bold text-green-800"
            >
              WhatsApp: presupuesto
            </button>
            <button
              type="button"
              onClick={() => sendWhatsapp("ready")}
              className="rounded-xl border border-green-200 px-4 py-2 font-bold text-green-800"
            >
              WhatsApp: listo
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5">
          <h2 className="font-black">Historial</h2>
          <div className="mt-3 space-y-3">
            {order.history.map((item) => (
              <div key={item.id} className="border-l-2 border-yellow-400 pl-3">
                <p className="font-bold">{item.action}</p>
                {item.comment ? <p className="text-sm text-gray-600">{item.comment}</p> : null}
                <p className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString("es-DO")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
