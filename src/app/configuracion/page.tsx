"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Template = { id: string; name: string; body: string; active: boolean };
type WhatsappSenderStatus = {
  key: string;
  name: string;
  phoneSuffix: string;
  configured: boolean;
  missing: string[];
};

export default function ConfiguracionPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState("Comprobando configuración...");
  const [whatsappSenders, setWhatsappSenders] = useState<WhatsappSenderStatus[]>([]);

  useEffect(() => {
    void fetch("/api/whatsapp/templates")
      .then((response) => response.json())
      .then((data) => setTemplates(data.templates ?? []));
    void fetch("/api/whatsapp/status")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          setWhatsappStatus(data.error ?? "No fue posible consultar la configuración.");
          return;
        }
        setWhatsappStatus(`Configuración de credenciales revisada (${data.apiVersion}); conexión con Meta no verificada.`);
        setWhatsappSenders(data.senders ?? []);
      })
      .catch(() => setWhatsappStatus("No fue posible consultar la configuración."));
  }, []);

  async function save(template: Template) {
    setMessage("");
    const response = await fetch("/api/whatsapp/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    const data = await response.json();
    setMessage(response.ok ? "Plantilla guardada." : data.error);
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Configuración</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>
        <section className="mb-6 rounded-2xl bg-white p-5">
          <h2 className="font-black">WhatsApp Business</h2>
          <p className="mt-2 text-sm text-gray-600">
            Estado: {whatsappStatus}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {whatsappSenders.map((sender) => (
              <li key={sender.key}>
                {sender.name} (•••• {sender.phoneSuffix}):{" "}
                {sender.configured
                  ? "credenciales configuradas"
                  : `sin configurar; faltan ${sender.missing.join(", ")}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-600">
            Los mensajes solo se intentan al pulsar un botón en una orden. La API puede
            aceptar el mensaje sin confirmar su entrega. Los mensajes de texto suelen
            requerir una ventana de atención abierta; fuera de ella se necesita una
            plantilla aprobada en Meta.
          </p>
        </section>
        {message ? <p className="mb-4 rounded-xl bg-white px-4 py-3 font-bold">{message}</p> : null}
        <div className="space-y-4">
          {templates.map((template) => (
            <section key={template.id} className="rounded-2xl bg-white p-5">
              <h2 className="font-black">{template.name}</h2>
              <textarea
                value={template.body}
                onChange={(event) => setTemplates((current) => current.map((item) => item.id === template.id ? { ...item, body: event.target.value } : item))}
                className="mt-3 min-h-32 w-full rounded-xl border border-gray-200 p-3"
              />
              <button onClick={() => save(template)} className="mt-3 rounded-xl bg-yellow-400 px-4 py-2 font-black">
                Guardar plantilla
              </button>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
