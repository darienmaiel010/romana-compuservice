"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  id: string;
  orderNumber: string;
  reportedProblem: string;
  status: string;
  receivedAt: string;
  customer: { name: string; phone: string | null };
  equipment: { type: string; brand: string | null; model: string | null };
};

export default function OrdenesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");

  async function load(value = "") {
    const response = await fetch(`/api/orders${value ? `?search=${encodeURIComponent(value)}` : ""}`);
    const data = await response.json();
    if (response.ok) setOrders(data.orders);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/orders");
      const data = await response.json();
      if (response.ok) setOrders(data.orders);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Órdenes de reparación</h1>
          <div className="flex gap-2">
            <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
            <Link href="/ordenes/nueva" className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black">Nueva orden</Link>
          </div>
        </div>
        <div className="mb-4 flex gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyUp={(event) => event.key === "Enter" && load(search)} placeholder="Buscar por orden, cliente, teléfono, serie o estado..." className="h-12 flex-1 rounded-xl border border-gray-200 bg-white px-4" />
          <button onClick={() => load(search)} className="rounded-xl bg-[#111111] px-5 font-bold text-white">Buscar</button>
        </div>
        <section className="overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="px-5 py-3">Orden</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Equipo</th><th className="px-5 py-3">Problema</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-4 font-bold">#{order.orderNumber}</td>
                    <td className="px-5 py-4">{order.customer.name}</td>
                    <td className="px-5 py-4">{order.equipment.type} {order.equipment.brand} {order.equipment.model}</td>
                    <td className="px-5 py-4">{order.reportedProblem}</td>
                    <td className="px-5 py-4">{order.status.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4"><Link className="font-bold" href={`/ordenes/${order.id}`}>Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
