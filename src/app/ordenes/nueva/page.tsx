"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Customer = { id: string; name: string };
type Equipment = { id: string; type: string; brand: string | null; model: string | null };

export default function NuevaOrdenPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [problem, setProblem] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/customers").then((response) => response.json()).then((data) => setCustomers(data.customers ?? []));
  }, []);

  useEffect(() => {
    if (!customerId) return;
    void fetch(`/api/equipment?customerId=${customerId}`).then((response) => response.json()).then((data) => setEquipment(data.equipment ?? []));
  }, [customerId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        equipmentId,
        reportedProblem: problem,
        diagnosis,
        estimatedDate,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No fue posible crear la orden.");
      return;
    }
    router.push(`/ordenes/${data.order.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Nueva orden</h1>
          <Link href="/ordenes" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Cancelar</Link>
        </div>
        <form onSubmit={create} className="grid gap-4 rounded-2xl bg-white p-6 sm:grid-cols-2">
          <label className="font-bold">Cliente
            <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3">
              <option value="">Seleccionar cliente</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="font-bold">Equipo
            <select required value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3">
              <option value="">Seleccionar equipo</option>
              {equipment.map((item) => <option key={item.id} value={item.id}>{item.type} {item.brand} {item.model}</option>)}
            </select>
          </label>
          <label className="font-bold sm:col-span-2">Problema reportado
            <textarea required value={problem} onChange={(event) => setProblem(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-gray-200 p-3" />
          </label>
          <label className="font-bold sm:col-span-2">Diagnóstico inicial
            <textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-gray-200 p-3" />
          </label>
          <label className="font-bold">Fecha probable
            <input type="date" value={estimatedDate} onChange={(event) => setEstimatedDate(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-3" />
          </label>
          <button className="mt-7 h-12 rounded-xl bg-yellow-400 font-black">Crear orden</button>
          {message ? <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-red-700">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}
