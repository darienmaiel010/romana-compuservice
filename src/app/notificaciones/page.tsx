"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  orderId: string | null;
  createdAt: string;
};

type NotificationSummary = {
  critical: number;
  approval: number;
  ready: number;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>({
    critical: 0,
    approval: 0,
    ready: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadNotifications() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      if (response.status === 403) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        setMessage(data.error ?? "No fue posible cargar los avisos.");
        return;
      }
      setNotifications(data.notifications);
      setSummary(data.summary);
    } catch {
      setMessage("No se pudo conectar para cargar los avisos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.status === 403) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          setMessage(data.error ?? "No fue posible cargar los avisos.");
          return;
        }
        setNotifications(data.notifications);
        setSummary(data.summary);
      })
      .catch(() => {
        if (active) setMessage("No se pudo conectar para cargar los avisos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/notifications/refresh", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "No fue posible actualizar los avisos.");
        return;
      }
      await loadNotifications();
      setMessage(`Avisos actualizados. Nuevos avisos creados: ${data.created}.`);
    } catch {
      setMessage("No se pudo conectar para actualizar los avisos.");
    } finally {
      setBusy(false);
    }
  }

  async function markAsRead(id: string) {
    setMessage("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "No fue posible marcar el aviso como leído.");
        return;
      }
      setNotifications((current) => current.filter((item) => item.id !== id));
    } catch {
      setMessage("No se pudo conectar para actualizar el aviso.");
    }
  }

  const summaryCards = [
    { label: "Equipos con más de 15 días", value: summary.critical },
    { label: "Esperando aprobación", value: summary.approval },
    { label: "Listos para entregar", value: summary.ready },
  ];

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-yellow-600">Taller</p>
            <h1 className="text-3xl font-black">Avisos y alertas</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={refreshNotifications}
              disabled={busy}
              className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black disabled:opacity-60"
            >
              {busy ? "Actualizando..." : "Actualizar avisos"}
            </button>
            <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">
              Inicio
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          {summaryCards.map((card) => (
            <article key={card.label} className="rounded-2xl bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">{card.label}</p>
              <p className="mt-3 text-3xl font-black">{card.value}</p>
            </article>
          ))}
        </section>

        {message ? <p role="status" className="mt-4 rounded-xl bg-white px-4 py-3 font-bold">{message}</p> : null}

        <section className="mt-6 overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-black">Avisos pendientes</h2>
            <p className="mt-1 text-sm text-gray-500">Se muestran hasta los 20 avisos pendientes más recientes.</p>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-gray-500">Cargando avisos...</p>
          ) : notifications.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No hay avisos pendientes.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {item.title}
                      {item.severity === "CRITICO" ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">Crítico</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleString("es-DO")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    {item.orderId ? (
                      <Link href={`/ordenes/${item.orderId}`} className="self-center text-sm font-bold">
                        Ver orden
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => markAsRead(item.id)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold"
                    >
                      Marcar leído
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
