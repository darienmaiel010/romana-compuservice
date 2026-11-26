"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Customer = { id: string; name: string };

export default function EquiposPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/customers")
      .then((response) => response.json())
      .then((data) => setCustomers(data.customers ?? []));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, type, brand, model, serialNumber }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No fue posible registrar el equipo.");
      return;
    }
    setType("");
    setBrand("");
    setModel("");
    setSerialNumber("");
    setMessage("Equipo registrado.");
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Equipos</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>
        <form onSubmit={create} className="grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-3">
          <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="h-11 rounded-xl border border-gray-200 px-3">
            <option value="">Cliente</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <input required value={type} onChange={(event) => setType(event.target.value)} placeholder="Tipo: Laptop, PC, Impresora..." className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Marca" className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Modelo" className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Número de serie" className="h-11 rounded-xl border border-gray-200 px-3" />
          <button className="h-11 rounded-xl bg-yellow-400 font-black">Registrar equipo</button>
        </form>
        {message ? <p className="mt-4 rounded-xl bg-white px-4 py-3 font-bold">{message}</p> : null}
      </div>
    </main>
  );
}
