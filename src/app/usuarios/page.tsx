"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMINISTRADOR" | "RECEPCION" | "TECNICO";

type User = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
};

export default function UsuariosPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("RECEPCION");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/users");
      if (response.status === 403) {
        router.push("/login");
        return;
      }
      const data = await response.json();
      if (response.ok) setUsers(data.users);
      setLoading(false);
    })();
  }, [router]);

  async function updateUser(id: string, data: Record<string, unknown>) {
    setMessage("");
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "No fue posible actualizar.");
      return;
    }
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, ...result.user } : user)),
    );
    setMessage("Usuario actualizado.");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, password, role }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "No fue posible crear el usuario.");
      return;
    }

    setUsers((current) => [result.user, ...current]);
    setName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("RECEPCION");
    setMessage("Usuario creado.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f4f5f7] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">
              Administración
            </p>
            <h1 className="mt-1 text-3xl font-black text-gray-950">Usuarios y claves</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold"
          >
            Cerrar sesión
          </button>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Crear usuario</h2>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6"
            onSubmit={handleCreate}
          >
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre completo"
              className="h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-yellow-400"
            />
            <input
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nombre de usuario"
              className="h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-yellow-400"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Correo (opcional)"
              className="h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-yellow-400"
            />
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña, mínimo 8 caracteres"
              className="h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-yellow-400"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="h-11 rounded-xl border border-gray-200 px-3 outline-none focus:border-yellow-400"
            >
              <option value="ADMINISTRADOR">Administrador</option>
              <option value="RECEPCION">Recepción</option>
              <option value="TECNICO">Técnico</option>
            </select>
            <button
              type="submit"
              className="h-11 rounded-xl bg-yellow-400 text-sm font-black text-black"
            >
              Crear usuario
            </button>
          </form>
        </section>

        {message ? (
          <p className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold">
            {message}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Correo</th>
                  <th className="px-5 py-3">Rol</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Clave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-5 py-6 text-gray-500" colSpan={6}>
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : null}
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4 font-bold">{user.name}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.username}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextUsername = window.prompt("Nuevo nombre de usuario:", user.username);
                            if (nextUsername) updateUser(user.id, { username: nextUsername });
                          }}
                          className="text-xs font-bold text-yellow-700"
                        >
                          Cambiar
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">{user.email ?? "-"}</td>
                    <td className="px-5 py-4">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          updateUser(user.id, { role: event.target.value })
                        }
                        className="h-9 rounded-lg border border-gray-200 px-2"
                      >
                        <option value="ADMINISTRADOR">Administrador</option>
                        <option value="RECEPCION">Recepción</option>
                        <option value="TECNICO">Técnico</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => updateUser(user.id, { active: !user.active })}
                        className={`rounded-full px-3 py-2 text-xs font-bold ${
                          user.active
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {user.active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          const password = window.prompt(
                            "Nueva contraseña (mínimo 8 caracteres):",
                          );
                          if (password) updateUser(user.id, { password });
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold"
                      >
                        Cambiar clave
                      </button>
                    </td>
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
