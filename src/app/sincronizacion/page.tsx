import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SincronizacionPage() {
  if (!(await getSession())) redirect("/login");
  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black">Sincronización</h1>
          <Link href="/" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">Dashboard</Link>
        </div>
        <section className="rounded-2xl bg-white p-6">
          <p className="font-black">CP Reparaciones no está conectado.</p>
          <p className="mt-2 text-sm text-gray-600">
            Esta fase comenzará solamente después de analizar una copia de seguridad
            de CPRepair.mdb. El original no será modificado.
          </p>
        </section>
        <section className="mt-6 overflow-hidden rounded-2xl bg-white">
          <h2 className="px-6 pt-6 font-black">Historial de sincronizaciones</h2>
          {runs.length === 0 ? (
            <p className="p-6 text-gray-500">Todavía no existen ejecuciones registradas.</p>
          ) : runs.map((run) => (
            <div key={run.id} className="grid gap-2 border-t border-gray-100 px-6 py-4 md:grid-cols-6">
              <p><b>Estado:</b> {run.status}</p>
              <p><b>Inicio:</b> {run.startedAt.toLocaleString("es-DO")}</p>
              <p><b>Nuevos:</b> {run.newRecords}</p>
              <p><b>Actualizados:</b> {run.updatedRecords}</p>
              <p><b>Duplicados:</b> {run.duplicateRecords}</p>
              <p><b>Errores:</b> {run.errors}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
