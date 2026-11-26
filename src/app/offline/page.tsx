"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  listOfflineConflicts,
  listOfflineOperations,
  readOfflineSnapshot,
  removeOfflineConflict,
  removeOfflineOperation,
  saveOfflineConflict,
  saveOfflineOperation,
  writeOfflineSnapshot,
  type OfflineConflict,
  type OfflineOperation,
  type OfflineSnapshot,
} from "@/lib/offline-store";

type Row = Record<string, unknown>;
type Form = Record<string, string>;

const panelClass = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const buttonClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRows(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseSnapshot(value: unknown): OfflineSnapshot {
  if (
    !isRecord(value) ||
    !Array.isArray(value.customers) ||
    !Array.isArray(value.equipment) ||
    !Array.isArray(value.orders) ||
    typeof value.serverTime !== "string"
  ) {
    throw new Error("El servidor devolvió datos offline incompletos.");
  }
  return {
    customers: readRows(value.customers),
    equipment: readRows(value.equipment),
    orders: readRows(value.orders),
    serverTime: value.serverTime,
  };
}

function apiMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function LabelInput({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function LabelSelect({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        <option value="">Selecciona…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function rowId(row: Row) {
  return text(row.id);
}

function rowLabel(row: Row) {
  return (
    text(row.name) ||
    text(row.orderNumber) ||
    [text(row.type), text(row.brand), text(row.model)].filter(Boolean).join(" ") ||
    rowId(row)
  );
}

function associatedOrderId(operation: OfflineOperation) {
  return text(operation.payload.orderId) || operation.entityId;
}

function overlayPendingOperations(
  snapshot: OfflineSnapshot,
  operations: OfflineOperation[],
): OfflineSnapshot {
  const next = {
    ...snapshot,
    customers: [...snapshot.customers],
    equipment: [...snapshot.equipment],
    orders: [...snapshot.orders],
  };
  for (const operation of operations) {
    const payload = operation.payload;
    if (operation.kind.startsWith("customer.")) {
      const current = next.customers.find((row) => text(row.id) === operation.entityId);
      const customer = {
        ...current,
        ...payload,
        id: operation.entityId,
        updatedAt: operation.createdAt,
        ...(operation.kind === "customer.create" ? { createdAt: operation.createdAt } : {}),
        pendingSync: true,
      };
      next.customers = [
        customer,
        ...next.customers.filter((row) => text(row.id) !== operation.entityId),
      ];
    } else if (operation.kind.startsWith("equipment.")) {
      const current = next.equipment.find((row) => text(row.id) === operation.entityId);
      const equipment = {
        ...current,
        ...payload,
        id: operation.entityId,
        updatedAt: operation.createdAt,
        ...(operation.kind === "equipment.create" ? { createdAt: operation.createdAt } : {}),
        pendingSync: true,
      };
      next.equipment = [
        equipment,
        ...next.equipment.filter((row) => text(row.id) !== operation.entityId),
      ];
    } else if (operation.kind === "order.create") {
      const customer = next.customers.find((row) => text(row.id) === text(payload.customerId));
      const equipment = next.equipment.find((row) => text(row.id) === text(payload.equipmentId));
      const order = {
        id: operation.entityId,
        ...payload,
        orderNumber: "Pendiente de sincronizar",
        status: "RECIBIDO",
        receivedAt: operation.createdAt,
        createdAt: operation.createdAt,
        updatedAt: operation.createdAt,
        customer,
        equipment,
        history: [],
        budgets: [],
        payments: [],
        pendingSync: true,
      };
      next.orders = [
        order,
        ...next.orders.filter((row) => text(row.id) !== operation.entityId),
      ];
    } else if (operation.kind === "order.update") {
      next.orders = next.orders.map((order) =>
        text(order.id) === operation.entityId
          ? { ...order, ...payload, updatedAt: operation.createdAt, pendingSync: true }
          : order,
      );
    } else if (operation.kind === "budget.create" || operation.kind === "payment.create") {
      next.orders = next.orders.map((order) => {
        if (text(order.id) !== associatedOrderId(operation)) return order;
        const collection = operation.kind === "budget.create" ? "budgets" : "payments";
        const values =
          operation.kind === "budget.create"
            ? {
                total:
                  Number(payload.labor ?? 0) +
                  Number(payload.parts ?? 0) +
                  Number(payload.other ?? 0) -
                  Number(payload.discount ?? 0),
              }
            : {};
        const record = {
          ...payload,
          ...values,
          id: operation.id,
          createdAt: operation.createdAt,
          pendingSync: true,
        };
        return {
          ...order,
          [collection]: [
            record,
            ...readRows(order[collection]).filter((row) => text(row.id) !== operation.id),
          ],
        };
      });
    }
  }
  return next;
}

export default function OfflinePage() {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([]);
  const networkAvailable = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    () => false,
  );
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const online = networkAvailable && serverReachable !== false;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customerForm, setCustomerForm] = useState<Form>({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    notes: "",
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerEdit, setCustomerEdit] = useState<Form>({});
  const [equipmentForm, setEquipmentForm] = useState<Form>({
    customerId: "",
    type: "",
    brand: "",
    model: "",
    serialNumber: "",
    accessories: "",
    physicalState: "",
  });
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [equipmentEdit, setEquipmentEdit] = useState<Form>({});
  const [orderForm, setOrderForm] = useState<Form>({
    customerId: "",
    equipmentId: "",
    reportedProblem: "",
    diagnosis: "",
    estimatedDate: "",
  });
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderEdit, setOrderEdit] = useState<Form>({
    status: "RECIBIDO",
    diagnosis: "",
    workDone: "",
    comment: "",
  });
  const [budgetForm, setBudgetForm] = useState<Form>({
    orderId: "",
    labor: "0",
    parts: "0",
    other: "0",
    discount: "0",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState<Form>({
    orderId: "",
    amount: "",
    method: "",
    note: "",
  });

  const refreshStoredState = useCallback(async () => {
    const [storedSnapshot, storedOperations, storedConflicts] = await Promise.all([
      readOfflineSnapshot(),
      listOfflineOperations(),
      listOfflineConflicts(),
    ]);
    setSnapshot(storedSnapshot);
    setOperations(storedOperations);
    setConflicts(storedConflicts);
  }, []);

  const refreshSnapshot = useCallback(async () => {
    let response: Response;
    try {
      response = await fetch("/api/offline/snapshot", { cache: "no-store" });
    } catch (fetchError) {
      setServerReachable(false);
      throw fetchError;
    }
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(apiMessage(body, "No se pudo actualizar la información."));
    setServerReachable(true);
    const baseSnapshot = parseSnapshot(body);
    const pending = await listOfflineOperations();
    const nextSnapshot = overlayPendingOperations(baseSnapshot, pending);
    await writeOfflineSnapshot(nextSnapshot);
    setSnapshot(nextSnapshot);
    setMessage(`Datos actualizados: ${new Date(nextSnapshot.serverTime).toLocaleString("es-DO")}.`);
    return nextSnapshot;
  }, []);

  const mergeRecord = useCallback(
    async (operation: OfflineOperation, record: Row) => {
      const current = await readOfflineSnapshot();
      if (!current) return;
      const next = { ...current };
      if (operation.kind.startsWith("customer.")) {
        next.customers = [
          ...next.customers.filter((item) => text(item.id) !== operation.entityId),
          record,
        ];
      } else if (operation.kind.startsWith("equipment.")) {
        next.equipment = [
          ...next.equipment.filter((item) => text(item.id) !== operation.entityId),
          record,
        ];
      } else if (operation.kind.startsWith("order.")) {
        next.orders = [
          ...next.orders.filter((item) => text(item.id) !== operation.entityId),
          record,
        ];
      } else {
        const orderId = associatedOrderId(operation);
        next.orders = next.orders.map((order) => {
          if (text(order.id) !== orderId) return order;
          const collection = operation.kind === "budget.create" ? "budgets" : "payments";
          const records = readRows(order[collection]).filter(
            (item) => text(item.id) !== text(record.id),
          );
          return { ...order, [collection]: [record, ...records] };
        });
      }
      await writeOfflineSnapshot(next);
      setSnapshot(next);
    },
    [],
  );

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) {
      setMessage("Sin conexión: los cambios quedan guardados en este dispositivo.");
      return;
    }
    const [pending, currentConflicts] = await Promise.all([
      listOfflineOperations(),
      listOfflineConflicts(),
    ]);
    if (!pending.length) {
      setMessage("No hay cambios pendientes.");
      return;
    }
    const conflictIds = new Set(currentConflicts.map((conflict) => conflict.id));
    const blockedIndex = pending.findIndex((operation) => conflictIds.has(operation.id));
    const batch = blockedIndex < 0 ? pending : pending.slice(0, blockedIndex);
    if (!batch.length) {
      setMessage("Resuelve el conflicto pendiente antes de continuar con la cola.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: batch }),
      });
      setServerReachable(true);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiMessage(body, "No se pudo sincronizar."));
      if (!isRecord(body) || !Array.isArray(body.results)) {
        throw new Error("El servidor devolvió una respuesta de sincronización no válida.");
      }

      let completed = 0;
      let foundConflict = false;
      let foundError = false;
      for (const result of body.results) {
        if (!isRecord(result) || typeof result.id !== "string") {
          throw new Error("El servidor devolvió un resultado de sincronización no válido.");
        }
        const operation = batch.find((item) => item.id === result.id);
        if (!operation) continue;
        if (result.status === "synced") {
          if (!isRecord(result.record)) {
            throw new Error("Falta el registro confirmado en la respuesta del servidor.");
          }
          await mergeRecord(operation, result.record);
          await removeOfflineOperation(operation.id);
          await removeOfflineConflict(operation.id);
          completed += 1;
        } else if (result.status === "conflict") {
          foundConflict = true;
          await saveOfflineConflict({
            id: operation.id,
            operation,
            reason: typeof result.reason === "string" ? result.reason : "Cambio incompatible.",
            serverRecord: isRecord(result.serverRecord) ? result.serverRecord : null,
            detectedAt: new Date().toISOString(),
          });
        } else if (result.status === "error") {
          foundError = true;
          setError(
            typeof result.message === "string"
              ? result.message
              : "No se pudo sincronizar el primer cambio pendiente.",
          );
          break;
        } else {
          throw new Error("El servidor devolvió un estado de sincronización no reconocido.");
        }
      }
      await refreshStoredState();
      if (completed) {
        setMessage(`${completed} cambio(s) sincronizado(s).`);
        try {
          await refreshSnapshot();
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? `Cambios guardados, pero no se pudo actualizar la copia local: ${refreshError.message}`
              : "Cambios guardados, pero no se pudo actualizar la copia local.",
          );
        }
      } else if (foundConflict) {
        setMessage("La sincronización requiere revisar el primer cambio pendiente.");
      } else if (!foundError) {
        setMessage("No se recibió ningún resultado de sincronización.");
      }
    } catch (syncError) {
      if (syncError instanceof TypeError) {
        setServerReachable(false);
        setMessage("No se pudo contactar al servidor. Los cambios siguen guardados para reintentar.");
      } else {
        setError(syncError instanceof Error ? syncError.message : "Falló la sincronización.");
      }
    } finally {
      try {
        await refreshStoredState();
      } catch (storageError) {
        setError(
          storageError instanceof Error
            ? `No se pudo actualizar la cola local: ${storageError.message}`
            : "No se pudo actualizar la cola local.",
        );
      }
      setBusy(false);
    }
  }, [mergeRecord, refreshSnapshot, refreshStoredState]);

  useEffect(() => {
    const handleOnline = () => {
      void refreshSnapshot()
        .then(() => syncPending())
        .catch((loadError: unknown) => {
          setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los datos.");
        });
    };
    const handleOffline = () => {
      setServerReachable(false);
      setMessage("Sin conexión: puedes seguir trabajando con la copia descargada.");
    };
    void Promise.resolve()
      .then(() => refreshStoredState())
      .then(() => {
        if (navigator.onLine) {
          return refreshSnapshot().then(() => syncPending());
        }
        return null;
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof TypeError) {
          setMessage("No se pudo contactar al servidor. Puedes trabajar con los datos ya descargados.");
        } else {
          setError(loadError instanceof Error ? loadError.message : "No se pudo abrir la copia local.");
        }
      });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshSnapshot, refreshStoredState, syncPending]);

  function selectCustomer(id: string) {
    setSelectedCustomerId(id);
    const customer = snapshot?.customers.find((row) => text(row.id) === id);
    if (!customer) return;
    setCustomerEdit({
      name: text(customer.name),
      phone: text(customer.phone),
      whatsapp: text(customer.whatsapp),
      address: text(customer.address),
      notes: text(customer.notes),
    });
  }

  function selectEquipment(id: string) {
    setSelectedEquipmentId(id);
    const equipment = snapshot?.equipment.find((row) => text(row.id) === id);
    if (!equipment) return;
    setEquipmentEdit({
      customerId: text(equipment.customerId),
      type: text(equipment.type),
      brand: text(equipment.brand),
      model: text(equipment.model),
      serialNumber: text(equipment.serialNumber),
      accessories: text(equipment.accessories),
      physicalState: text(equipment.physicalState),
    });
  }

  function selectOrder(id: string) {
    setSelectedOrderId(id);
    const order = snapshot?.orders.find((row) => text(row.id) === id);
    if (!order) return;
    setOrderEdit({
      status: text(order.status) || "RECIBIDO",
      diagnosis: text(order.diagnosis),
      workDone: text(order.workDone),
      comment: "",
    });
  }

  async function enqueue(
    kind: OfflineOperation["kind"],
    entityId: string,
    payload: Row,
    baseUpdatedAt?: string,
  ) {
    if (!snapshot) throw new Error("Conéctate y actualiza la copia local antes de trabajar offline.");
    const queued = await listOfflineOperations();
    const createKind =
      kind.endsWith(".update") &&
      (kind.startsWith("customer.") || kind.startsWith("equipment."))
        ? `${kind.slice(0, -".update".length)}.create`
        : null;
    const queuedCreate = createKind
      ? queued.find((item) => item.kind === createKind && item.entityId === entityId)
      : undefined;
    const queuedUpdate = kind.endsWith(".update")
      ? queued.find((item) => item.kind === kind && item.entityId === entityId)
      : undefined;
    if (queuedCreate || queuedUpdate) {
      const existing = queuedCreate ?? queuedUpdate!;
      const updated = {
        ...existing,
        payload: { ...existing.payload, ...payload },
      };
      await saveOfflineOperation(updated);
      const currentConflict = (await listOfflineConflicts()).find(
        (conflict) => conflict.id === existing.id,
      );
      if (currentConflict) {
        await saveOfflineConflict({ ...currentConflict, operation: updated });
      }
      await refreshStoredState();
      return updated;
    }
    const operation: OfflineOperation = {
      id: crypto.randomUUID(),
      kind,
      entityId,
      baseUpdatedAt,
      snapshotAt: snapshot.serverTime,
      createdAt: new Date().toISOString(),
      payload,
    };
    await saveOfflineOperation(operation);
    await refreshStoredState();
    return operation;
  }

  async function saveOptimisticSnapshot(transform: (current: OfflineSnapshot) => OfflineSnapshot) {
    if (!snapshot) throw new Error("No hay una copia local disponible.");
    const next = transform(snapshot);
    await writeOfflineSnapshot(next);
    setSnapshot(next);
  }

  async function handleForm(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      if (navigator.onLine) await syncPending();
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : "No se pudo guardar el cambio.");
    }
  }

  const customers = snapshot?.customers ?? [];
  const equipmentList = snapshot?.equipment ?? [];
  const orders = snapshot?.orders ?? [];
  const equipmentForOrder = equipmentList.filter(
    (equipment) => text(equipment.customerId) === orderForm.customerId,
  );
  const orderOptions = orders.map((order) => ({
    value: rowId(order),
    label: `${text(order.orderNumber) || "Pendiente"} · ${rowLabel(
      customers.find((customer) => text(customer.id) === text(order.customerId)) ?? order,
    )}`,
  }));
  const customerOptions = customers.map((customer) => ({
    value: rowId(customer),
    label: rowLabel(customer),
  }));
  const equipmentOptions = equipmentList.map((equipment) => ({
    value: rowId(equipment),
    label: `${rowLabel(equipment)} · ${
      rowLabel(customers.find((customer) => text(customer.id) === text(equipment.customerId)) ?? {})
    }`,
  }));

  async function resolveConflict(conflict: OfflineConflict, choice: "server" | "local") {
    setError("");
    if (choice === "local" && !navigator.onLine) {
      setError("Necesitas conexión para confirmar y sincronizar tus cambios.");
      return;
    }
    setBusy(true);
    try {
      if (choice === "server") {
        const serverRecord = conflict.serverRecord;
        if (serverRecord) {
          const operation = conflict.operation;
          if (operation.kind.startsWith("customer.")) {
            const replacementId =
              operation.kind === "customer.create" ? text(serverRecord.id) : "";
            if (replacementId && replacementId !== operation.entityId) {
              const pending = await listOfflineOperations();
              for (const queuedOperation of pending) {
                if (queuedOperation.id === operation.id) continue;
                if (text(queuedOperation.payload.customerId) !== operation.entityId) continue;
                await saveOfflineOperation({
                  ...queuedOperation,
                  payload: { ...queuedOperation.payload, customerId: replacementId },
                });
              }
            }
            await saveOptimisticSnapshot((current) => ({
              ...current,
              customers: [
                ...current.customers.filter((item) => text(item.id) !== conflict.operation.entityId),
                serverRecord,
              ],
              equipment: current.equipment.map((item) =>
                text(item.customerId) === conflict.operation.entityId
                  ? { ...item, customerId: text(serverRecord.id) }
                  : item,
              ),
              orders: current.orders.map((item) =>
                text(item.customerId) === conflict.operation.entityId
                  ? { ...item, customerId: text(serverRecord.id), customer: serverRecord }
                  : item,
              ),
            }));
          } else if (operation.kind.startsWith("equipment.")) {
            await saveOptimisticSnapshot((current) => ({
              ...current,
              equipment: [
                ...current.equipment.filter((item) => text(item.id) !== conflict.operation.entityId),
                serverRecord,
              ],
            }));
          } else if (operation.kind.startsWith("order.")) {
            await saveOptimisticSnapshot((current) => ({
              ...current,
              orders: [
                ...current.orders.filter((item) => text(item.id) !== conflict.operation.entityId),
                serverRecord,
              ],
            }));
          } else {
            const collection = operation.kind === "budget.create" ? "budgets" : "payments";
            await saveOptimisticSnapshot((current) => ({
              ...current,
              orders: current.orders.map((order) =>
                text(order.id) === associatedOrderId(operation)
                  ? {
                      ...order,
                      [collection]: [
                        serverRecord,
                        ...readRows(order[collection]).filter(
                          (item) => text(item.id) !== text(serverRecord.id),
                        ),
                      ],
                    }
                  : order,
              ),
            }));
          }
        } else {
          const operation = conflict.operation;
          if (operation.kind.startsWith("customer.")) {
            await saveOptimisticSnapshot((current) => ({
            ...current,
            customers: current.customers.filter((row) => text(row.id) !== operation.entityId),
            }));
          } else if (operation.kind.startsWith("equipment.")) {
            await saveOptimisticSnapshot((current) => ({
            ...current,
            equipment: current.equipment.filter((row) => text(row.id) !== operation.entityId),
            }));
          } else if (operation.kind.startsWith("order.")) {
            await saveOptimisticSnapshot((current) => ({
            ...current,
            orders: current.orders.filter((row) => text(row.id) !== operation.entityId),
            }));
          } else {
            const collection = operation.kind === "budget.create" ? "budgets" : "payments";
            await saveOptimisticSnapshot((current) => ({
            ...current,
            orders: current.orders.map((order) =>
              text(order.id) === associatedOrderId(operation)
                ? {
                    ...order,
                    [collection]: readRows(order[collection]).filter(
                      (row) => text(row.id) !== operation.id,
                    ),
                  }
                : order,
            ),
            }));
          }
        }
        await removeOfflineOperation(conflict.id);
        await removeOfflineConflict(conflict.id);
        await refreshStoredState();
        setMessage("Se conservaron los datos del servidor.");
        return;
      }

      const fresh = await refreshSnapshot();
      const operation = { ...conflict.operation, snapshotAt: fresh.serverTime };
      if (operation.kind === "customer.create" && conflict.reason.includes("teléfono")) {
        operation.payload = { ...operation.payload, allowDuplicate: true };
      } else if (
        operation.kind === "budget.create" ||
        operation.kind === "payment.create"
      ) {
        operation.payload = { ...operation.payload, confirmed: true };
      } else if (operation.kind.endsWith(".update")) {
        const collection = operation.kind.startsWith("customer.")
          ? fresh.customers
          : operation.kind.startsWith("equipment.")
            ? fresh.equipment
            : fresh.orders;
        const current = collection.find((row) => text(row.id) === operation.entityId);
        if (!current) throw new Error("El registro ya no existe en el servidor.");
        const updatedAt = text(current.updatedAt);
        if (!updatedAt) throw new Error("No se pudo determinar la versión actual del registro.");
        operation.baseUpdatedAt = updatedAt;
      } else {
        throw new Error("Este conflicto no puede aplicarse localmente sin crear un registro duplicado.");
      }
      await saveOfflineOperation(operation);
      await removeOfflineConflict(conflict.id);
      await refreshStoredState();
      setMessage("Cambio local confirmado; sincronizando…");
      await syncPending();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "No se pudo resolver el conflicto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-6 rounded-2xl bg-slate-900 p-5 text-white">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          ROMANA COMPUSERVICE
        </p>
        <h1 className="mt-1 text-2xl font-bold">Trabajo sin conexión</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          Los cambios se guardan en este dispositivo. Al recuperar conexión se envían al PC;
          cualquier conflicto requiere tu revisión antes de continuar.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              online ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-950"
            }`}
          >
            {online ? "Con conexión" : "Sin conexión"}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {operations.length} pendiente(s)
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {conflicts.length} conflicto(s)
          </span>
          <button
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            disabled={busy || !networkAvailable}
            onClick={() =>
              void refreshSnapshot()
                .then(() => syncPending())
                .catch((refreshError: unknown) =>
                  setError(
                    refreshError instanceof Error
                      ? refreshError.message
                      : "No se pudieron actualizar los datos.",
                  ),
                )
            }
          >
            Actualizar y sincronizar
          </button>
        </div>
      </header>

      {message && <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!snapshot && (
        <section className={`${panelClass} mb-5`}>
          <h2 className="font-semibold">Preparar el dispositivo</h2>
          <p className="mt-2 text-sm text-slate-600">
            {online
              ? "Actualiza los datos mientras tienes conexión para poder trabajar después sin Internet."
              : "Todavía no hay una copia descargada. Conéctate al sistema del taller para prepararla."}
          </p>
        </section>
      )}

      {snapshot && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={panelClass}>
              <h2 className="mb-3 text-lg font-bold">Clientes</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleForm(async () => {
                    const id = crypto.randomUUID();
                    const now = new Date().toISOString();
                    const payload = { ...customerForm };
                    await enqueue("customer.create", id, payload);
                    await saveOptimisticSnapshot((current) => ({
                      ...current,
                      customers: [
                        { id, ...payload, active: true, createdAt: now, updatedAt: now },
                        ...current.customers,
                      ],
                    }));
                    setCustomerForm({ name: "", phone: "", whatsapp: "", address: "", notes: "" });
                  });
                }}
              >
                <LabelInput label="Nombre" value={customerForm.name} required onChange={(name) => setCustomerForm({ ...customerForm, name })} />
                <LabelInput label="Teléfono" value={customerForm.phone} onChange={(phone) => setCustomerForm({ ...customerForm, phone })} />
                <LabelInput label="WhatsApp" value={customerForm.whatsapp} onChange={(whatsapp) => setCustomerForm({ ...customerForm, whatsapp })} />
                <LabelInput label="Dirección" value={customerForm.address} onChange={(address) => setCustomerForm({ ...customerForm, address })} />
                <div className="sm:col-span-2">
                  <LabelInput label="Notas" value={customerForm.notes} onChange={(notes) => setCustomerForm({ ...customerForm, notes })} />
                </div>
                <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar cliente</button>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <LabelSelect
                  label="Editar cliente guardado"
                  value={selectedCustomerId}
                  onChange={selectCustomer}
                  options={customerOptions}
                />
                {selectedCustomerId && (
                  <form
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleForm(async () => {
                        const current = customers.find((row) => text(row.id) === selectedCustomerId);
                        if (!current) throw new Error("Selecciona un cliente disponible.");
                        const payload = { ...customerEdit };
                        await enqueue(
                          "customer.update",
                          selectedCustomerId,
                          payload,
                          text(current.updatedAt),
                        );
                        const now = new Date().toISOString();
                        await saveOptimisticSnapshot((stored) => ({
                          ...stored,
                          customers: stored.customers.map((row) =>
                            text(row.id) === selectedCustomerId
                              ? { ...row, ...payload, updatedAt: now }
                              : row,
                          ),
                        }));
                      });
                    }}
                  >
                    {(["name", "phone", "whatsapp", "address", "notes"] as const).map((field) => (
                      <LabelInput
                        key={field}
                        label={{ name: "Nombre", phone: "Teléfono", whatsapp: "WhatsApp", address: "Dirección", notes: "Notas" }[field]}
                        value={customerEdit[field] ?? ""}
                        required={field === "name"}
                        onChange={(value) => setCustomerEdit({ ...customerEdit, [field]: value })}
                      />
                    ))}
                    <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar cambios del cliente</button>
                  </form>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">{customers.length} cliente(s) en la copia local.</p>
            </section>

            <section className={panelClass}>
              <h2 className="mb-3 text-lg font-bold">Equipos</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleForm(async () => {
                    const id = crypto.randomUUID();
                    const now = new Date().toISOString();
                    const payload = { ...equipmentForm };
                    await enqueue("equipment.create", id, payload);
                    await saveOptimisticSnapshot((current) => ({
                      ...current,
                      equipment: [
                        { id, ...payload, active: true, createdAt: now, updatedAt: now },
                        ...current.equipment,
                      ],
                    }));
                    setEquipmentForm({ customerId: "", type: "", brand: "", model: "", serialNumber: "", accessories: "", physicalState: "" });
                  });
                }}
              >
                <LabelSelect label="Cliente" value={equipmentForm.customerId} required onChange={(customerId) => setEquipmentForm({ ...equipmentForm, customerId })} options={customerOptions} />
                <LabelInput label="Tipo de equipo" value={equipmentForm.type} required onChange={(type) => setEquipmentForm({ ...equipmentForm, type })} />
                <LabelInput label="Marca" value={equipmentForm.brand} onChange={(brand) => setEquipmentForm({ ...equipmentForm, brand })} />
                <LabelInput label="Modelo" value={equipmentForm.model} onChange={(model) => setEquipmentForm({ ...equipmentForm, model })} />
                <LabelInput label="Número de serie" value={equipmentForm.serialNumber} onChange={(serialNumber) => setEquipmentForm({ ...equipmentForm, serialNumber })} />
                <LabelInput label="Accesorios" value={equipmentForm.accessories} onChange={(accessories) => setEquipmentForm({ ...equipmentForm, accessories })} />
                <div className="sm:col-span-2">
                  <LabelInput label="Estado físico" value={equipmentForm.physicalState} onChange={(physicalState) => setEquipmentForm({ ...equipmentForm, physicalState })} />
                </div>
                <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar equipo</button>
              </form>
              <div className="mt-6 border-t border-slate-200 pt-4">
                <LabelSelect
                  label="Editar equipo guardado"
                  value={selectedEquipmentId}
                  onChange={selectEquipment}
                  options={equipmentOptions}
                />
                {selectedEquipmentId && (
                  <form
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleForm(async () => {
                        const current = equipmentList.find((row) => text(row.id) === selectedEquipmentId);
                        if (!current) throw new Error("Selecciona un equipo disponible.");
                        const payload = { ...equipmentEdit };
                        await enqueue("equipment.update", selectedEquipmentId, payload, text(current.updatedAt));
                        await saveOptimisticSnapshot((stored) => ({
                          ...stored,
                          equipment: stored.equipment.map((row) =>
                            text(row.id) === selectedEquipmentId
                              ? { ...row, ...payload, updatedAt: new Date().toISOString() }
                              : row,
                          ),
                        }));
                      });
                    }}
                  >
                    <LabelSelect label="Cliente" value={equipmentEdit.customerId ?? ""} required onChange={(customerId) => setEquipmentEdit({ ...equipmentEdit, customerId })} options={customerOptions} />
                    {(["type", "brand", "model", "serialNumber", "accessories", "physicalState"] as const).map((field) => (
                      <LabelInput
                        key={field}
                        label={{ type: "Tipo", brand: "Marca", model: "Modelo", serialNumber: "Número de serie", accessories: "Accesorios", physicalState: "Estado físico" }[field]}
                        value={equipmentEdit[field] ?? ""}
                        required={field === "type"}
                        onChange={(value) => setEquipmentEdit({ ...equipmentEdit, [field]: value })}
                      />
                    ))}
                    <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar cambios del equipo</button>
                  </form>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">{equipmentList.length} equipo(s) en la copia local.</p>
            </section>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className={panelClass}>
              <h2 className="mb-3 text-lg font-bold">Órdenes</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleForm(async () => {
                    const id = crypto.randomUUID();
                    const now = new Date().toISOString();
                    const payload = { ...orderForm };
                    await enqueue("order.create", id, payload);
                    const customer = customers.find((row) => text(row.id) === payload.customerId);
                    const equipment = equipmentList.find((row) => text(row.id) === payload.equipmentId);
                    await saveOptimisticSnapshot((current) => ({
                      ...current,
                      orders: [
                        {
                          id,
                          ...payload,
                          orderNumber: "Pendiente de sincronizar",
                          status: "RECIBIDO",
                          receivedAt: now,
                          createdAt: now,
                          updatedAt: now,
                          customer,
                          equipment,
                          history: [],
                          budgets: [],
                          payments: [],
                        },
                        ...current.orders,
                      ],
                    }));
                    setOrderForm({ customerId: "", equipmentId: "", reportedProblem: "", diagnosis: "", estimatedDate: "" });
                  });
                }}
              >
                <LabelSelect label="Cliente" value={orderForm.customerId} required onChange={(customerId) => setOrderForm({ ...orderForm, customerId, equipmentId: "" })} options={customerOptions} />
                <LabelSelect label="Equipo" value={orderForm.equipmentId} required onChange={(equipmentId) => setOrderForm({ ...orderForm, equipmentId })} options={equipmentForOrder.map((row) => ({ value: rowId(row), label: rowLabel(row) }))} />
                <div className="sm:col-span-2">
                  <LabelInput label="Problema reportado" value={orderForm.reportedProblem} required onChange={(reportedProblem) => setOrderForm({ ...orderForm, reportedProblem })} />
                </div>
                <LabelInput label="Diagnóstico inicial" value={orderForm.diagnosis} onChange={(diagnosis) => setOrderForm({ ...orderForm, diagnosis })} />
                <LabelInput label="Fecha estimada" type="date" value={orderForm.estimatedDate} onChange={(estimatedDate) => setOrderForm({ ...orderForm, estimatedDate })} />
                <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Crear orden</button>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <LabelSelect label="Actualizar orden" value={selectedOrderId} onChange={selectOrder} options={orderOptions} />
                {selectedOrderId && (
                  <form
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleForm(async () => {
                        const current = orders.find((row) => text(row.id) === selectedOrderId);
                        if (!current) throw new Error("Selecciona una orden disponible.");
                        const payload = { ...orderEdit };
                        await enqueue("order.update", selectedOrderId, payload, text(current.updatedAt));
                        await saveOptimisticSnapshot((stored) => ({
                          ...stored,
                          orders: stored.orders.map((row) =>
                            text(row.id) === selectedOrderId
                              ? { ...row, ...payload, updatedAt: new Date().toISOString() }
                              : row,
                          ),
                        }));
                      });
                    }}
                  >
                    <LabelSelect
                      label="Estado"
                      value={orderEdit.status}
                      required
                      onChange={(status) => setOrderEdit({ ...orderEdit, status })}
                      options={[
                        ["RECIBIDO", "Recibido"],
                        ["PENDIENTE_DIAGNOSTICO", "Pendiente de diagnóstico"],
                        ["DIAGNOSTICO_COMPLETADO", "Diagnóstico completado"],
                        ["ESPERANDO_APROBACION", "Esperando aprobación"],
                        ["APROBADO", "Aprobado"],
                        ["EN_REPARACION", "En reparación"],
                        ["ESPERANDO_REPUESTOS", "Esperando repuestos"],
                        ["LISTO_PARA_ENTREGAR", "Listo para entregar"],
                        ["ENTREGADO", "Entregado"],
                        ["CANCELADO", "Cancelado"],
                      ].map(([value, label]) => ({ value, label }))}
                    />
                    <LabelInput label="Diagnóstico" value={orderEdit.diagnosis} onChange={(diagnosis) => setOrderEdit({ ...orderEdit, diagnosis })} />
                    <LabelInput label="Trabajo realizado" value={orderEdit.workDone} onChange={(workDone) => setOrderEdit({ ...orderEdit, workDone })} />
                    <LabelInput label="Comentario" value={orderEdit.comment} onChange={(comment) => setOrderEdit({ ...orderEdit, comment })} />
                    <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar cambios de la orden</button>
                  </form>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">{orders.length} orden(es) en la copia local.</p>
            </section>

            <div className="grid content-start gap-4">
              <section className={panelClass}>
                <h2 className="mb-3 text-lg font-bold">Presupuestos</h2>
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleForm(async () => {
                      const operation = await enqueue("budget.create", budgetForm.orderId, { ...budgetForm });
                      const budget = {
                        id: operation.id,
                        ...budgetForm,
                        total:
                          Number(budgetForm.labor) +
                          Number(budgetForm.parts) +
                          Number(budgetForm.other) -
                          Number(budgetForm.discount),
                        createdAt: new Date().toISOString(),
                        pendingSync: true,
                      };
                      await saveOptimisticSnapshot((current) => ({
                        ...current,
                        orders: current.orders.map((order) =>
                          text(order.id) === budgetForm.orderId
                            ? { ...order, budgets: [budget, ...readRows(order.budgets)] }
                            : order,
                        ),
                      }));
                      setBudgetForm({ ...budgetForm, labor: "0", parts: "0", other: "0", discount: "0", notes: "" });
                    });
                  }}
                >
                  <LabelSelect label="Orden" value={budgetForm.orderId} required onChange={(orderId) => setBudgetForm({ ...budgetForm, orderId })} options={orderOptions} />
                  <LabelInput label="Mano de obra" type="number" value={budgetForm.labor} onChange={(labor) => setBudgetForm({ ...budgetForm, labor })} />
                  <LabelInput label="Piezas" type="number" value={budgetForm.parts} onChange={(parts) => setBudgetForm({ ...budgetForm, parts })} />
                  <LabelInput label="Otros" type="number" value={budgetForm.other} onChange={(other) => setBudgetForm({ ...budgetForm, other })} />
                  <LabelInput label="Descuento" type="number" value={budgetForm.discount} onChange={(discount) => setBudgetForm({ ...budgetForm, discount })} />
                  <LabelInput label="Notas" value={budgetForm.notes} onChange={(notes) => setBudgetForm({ ...budgetForm, notes })} />
                  <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar presupuesto</button>
                </form>
              </section>

              <section className={panelClass}>
                <h2 className="mb-3 text-lg font-bold">Pagos</h2>
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleForm(async () => {
                      const operation = await enqueue("payment.create", paymentForm.orderId, { ...paymentForm });
                      const payment = {
                        id: operation.id,
                        ...paymentForm,
                        createdAt: new Date().toISOString(),
                        pendingSync: true,
                      };
                      await saveOptimisticSnapshot((current) => ({
                        ...current,
                        orders: current.orders.map((order) =>
                          text(order.id) === paymentForm.orderId
                            ? { ...order, payments: [payment, ...readRows(order.payments)] }
                            : order,
                        ),
                      }));
                      setPaymentForm({ ...paymentForm, amount: "", method: "", note: "" });
                    });
                  }}
                >
                  <LabelSelect label="Orden" value={paymentForm.orderId} required onChange={(orderId) => setPaymentForm({ ...paymentForm, orderId })} options={orderOptions} />
                  <LabelInput label="Monto" type="number" value={paymentForm.amount} required onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} />
                  <LabelInput label="Método" value={paymentForm.method} onChange={(method) => setPaymentForm({ ...paymentForm, method })} />
                  <LabelInput label="Nota" value={paymentForm.note} onChange={(note) => setPaymentForm({ ...paymentForm, note })} />
                  <button className={`${buttonClass} sm:col-span-2`} disabled={busy}>Guardar pago</button>
                </form>
              </section>
            </div>
          </div>
        </>
      )}

      {conflicts.length > 0 && (
        <section className={`${panelClass} mt-5 border-amber-300`}>
          <h2 className="text-lg font-bold text-amber-950">Revisión manual de conflictos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Compara el cambio con el servidor. No se sobrescribe ningún dato hasta que confirmes.
          </p>
          <div className="mt-4 space-y-3">
            {conflicts.map((conflict) => (
              <article key={conflict.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold">{conflict.operation.kind}</h3>
                <p className="mt-1 text-sm">{conflict.reason}</p>
                {conflict.serverRecord && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-white p-2 text-xs">
                    {JSON.stringify(conflict.serverRecord, null, 2)}
                  </pre>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => void resolveConflict(conflict, "server")}
                  >
                    Conservar servidor
                  </button>
                  <button
                    className={buttonClass}
                    disabled={busy || !online}
                    onClick={() => void resolveConflict(conflict, "local")}
                  >
                    Confirmar mis cambios
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-6 rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
        <strong>Privacidad:</strong> la copia y la cola quedan en el almacenamiento del navegador y no están
        cifradas por la aplicación; permanecen incluso después de cerrar sesión. Usa solo un iPhone personal
        protegido con código/Face ID. WhatsApp y los avisos no se envían sin conexión.
      </footer>
    </main>
  );
}
