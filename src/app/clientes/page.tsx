"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWhatsAppLink } from "@/lib/phone";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
};

export default function ClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  async function load(value = "") {
    const response = await fetch(`/api/customers${value ? `?search=${encodeURIComponent(value)}` : ""}`);
    if (response.status === 403) {
      router.push("/login");
      return;
    }
    const data = await response.json();
    if (response.ok) setCustomers(data.customers);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/customers");
      if (response.status === 403) {
        router.push("/login");
        return;
      }
      const data = await response.json();
      if (response.ok) setCustomers(data.customers);
    })();
  }, [router]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, whatsapp, address }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No fue posible crear el cliente.");
      return;
    }
    setName("");
    setPhone("");
    setWhatsapp("");
    setAddress("");
    await load(search);
    setMessage("Cliente creado correctamente. Ya puedes abrir su WhatsApp desde la lista.");
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Clientes</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>

        <form onSubmit={create} className="mb-6 grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-5">
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono" className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="WhatsApp (opcional)" className="h-11 rounded-xl border border-gray-200 px-3" />
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Dirección" className="h-11 rounded-xl border border-gray-200 px-3" />
          <button className="h-11 rounded-xl bg-yellow-400 font-black">Agregar cliente</button>
        </form>

        <p className="mb-4 text-sm text-gray-600">
          Para contactar por WhatsApp, guarda su número en WhatsApp o Teléfono. El botón abre el chat con un saludo listo; revísalo y envíalo desde WhatsApp.
        </p>
        {message ? <p role="status" className="mb-4 rounded-xl bg-white px-4 py-3 font-bold">{message}</p> : null}

        <div className="mb-4 flex gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyUp={(event) => event.key === "Enter" && load(search)} placeholder="Buscar cliente, teléfono..." className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4" />
          <button onClick={() => load(search)} className="rounded-xl bg-[#111111] px-4 font-bold text-white">Buscar</button>
        </div>

        <section className="overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Teléfono</th><th className="px-5 py-3">WhatsApp</th><th className="px-5 py-3">Dirección</th><th className="px-5 py-3">Acción</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-5 py-4 font-bold">{customer.name}</td>
                    <td className="px-5 py-4">{customer.phone ?? "-"}</td>
                    <td className="px-5 py-4">{customer.whatsapp ?? "-"}</td>
                    <td className="px-5 py-4">{customer.address ?? "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Link href={`/clientes/${customer.id}`} className="font-bold">Ver historial</Link>
                        {buildWhatsAppLink(customer.whatsapp ?? customer.phone, customer.name) ? (
                          <a
                            href={buildWhatsAppLink(customer.whatsapp ?? customer.phone, customer.name) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-green-700"
                          >
                            Escribir WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">Sin número válido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                      {search ? "No se encontraron clientes." : "Aún no hay clientes; agrega uno en el formulario."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
