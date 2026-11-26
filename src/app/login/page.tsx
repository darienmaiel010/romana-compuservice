"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "No fue posible iniciar sesión.");
        return;
      }

      router.push("/usuarios");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#111111] px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
        <div className="mx-auto mb-5 grid w-fit place-items-center rounded-2xl bg-[#111111] p-3">
          <Image
            src="/brand/romana-logo.jpeg"
            alt="ROMANA COMPUSERVICE"
            width={768}
            height={768}
            priority
            className="h-[140px] w-[140px] object-contain"
          />
        </div>

        <h1 className="text-center text-2xl font-black text-gray-950">
          Iniciar sesión
        </h1>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">Usuario</span>
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Escribe tu usuario"
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-700">Contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10"
            />
            <span className="mt-1 block text-xs text-gray-500">Mínimo 8 caracteres</span>
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-yellow-400 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
