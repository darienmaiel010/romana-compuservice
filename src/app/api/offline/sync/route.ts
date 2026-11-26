import { NextResponse } from "next/server";
import type { OfflineOperation } from "@/lib/offline-store";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REPAIR_STATUSES = [
  "RECIBIDO",
  "PENDIENTE_DIAGNOSTICO",
  "DIAGNOSTICO_COMPLETADO",
  "ESPERANDO_APROBACION",
  "APROBADO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  "LISTO_PARA_ENTREGAR",
  "ENTREGADO",
  "CANCELADO",
] as const;

type SyncResult =
  | { id: string; status: "synced"; entityId: string; record: Record<string, unknown> }
  | {
      id: string;
      status: "conflict";
      entityId: string;
      reason: string;
      serverRecord: Record<string, unknown> | null;
    }
  | { id: string; status: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, required = false) {
  if (typeof value !== "string") {
    if (required) throw new Error(`${field} es obligatorio.`);
    return null;
  }
  const result = value.trim();
  if (!result && required) throw new Error(`${field} es obligatorio.`);
  return result || null;
}

function readMoney(value: unknown, field: string, allowZero = true) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(`${field} no es válido.`);
  }
  return amount;
}

function sameValues(record: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(([key, value]) => {
    const actual = record[key];
    if (value === null || value === undefined) return actual === null || actual === undefined;
    if (value instanceof Date) {
      return actual instanceof Date && actual.getTime() === value.getTime();
    }
    if (typeof value === "number") return Number(actual) === value;
    return String(actual) === String(value);
  });
}

function isNewerThan(value: Date, timestamp: string) {
  const time = new Date(timestamp).getTime();
  return Number.isFinite(time) && value.getTime() > time;
}

async function applyOperation(operation: OfflineOperation, userId: string): Promise<SyncResult> {
  const payload = operation.payload;
  const operationId = operation.id;
  const entityId = operation.entityId;

  return prisma.$transaction(async (transaction) => {
    if (operation.kind === "customer.create") {
      const data = {
        name: readString(payload.name, "El nombre", true)!,
        phone: readString(payload.phone, "El teléfono")?.replace(/\D/g, "") || null,
        whatsapp: readString(payload.whatsapp, "El WhatsApp"),
        address: readString(payload.address, "La dirección"),
        notes: readString(payload.notes, "Las notas"),
      };
      const current = await transaction.customer.findUnique({ where: { id: entityId } });
      if (current) {
        return sameValues(current, data)
          ? { id: operationId, status: "synced", entityId, record: current }
          : {
              id: operationId,
              status: "conflict",
              entityId,
              reason: "Ya existe otro cliente con este identificador.",
              serverRecord: current,
            };
      }
      if (data.phone || data.whatsapp) {
        const duplicate = await transaction.customer.findFirst({
          where: {
            OR: [
              ...(data.phone ? [{ phone: data.phone }, { whatsapp: data.phone }] : []),
              ...(data.whatsapp ? [{ phone: data.whatsapp }, { whatsapp: data.whatsapp }] : []),
            ],
          },
        });
        if (duplicate && payload.allowDuplicate !== true) {
          return {
            id: operationId,
            status: "conflict",
            entityId,
            reason: "Ya existe un cliente con ese teléfono o WhatsApp.",
            serverRecord: duplicate,
          };
        }
      }
      const customer = await transaction.customer.create({ data: { id: entityId, ...data } });
      return { id: operationId, status: "synced", entityId, record: customer };
    }

    if (operation.kind === "customer.update") {
      const current = await transaction.customer.findUnique({ where: { id: entityId } });
      if (!current) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El cliente ya no existe en el servidor.",
          serverRecord: null,
        };
      }
      const data = {
        name: readString(payload.name, "El nombre", true)!,
        phone: readString(payload.phone, "El teléfono")?.replace(/\D/g, "") || null,
        whatsapp: readString(payload.whatsapp, "El WhatsApp"),
        address: readString(payload.address, "La dirección"),
        notes: readString(payload.notes, "Las notas"),
      };
      if (sameValues(current, data)) {
        return { id: operationId, status: "synced", entityId, record: current };
      }
      if (!operation.baseUpdatedAt || current.updatedAt.toISOString() !== operation.baseUpdatedAt) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El cliente cambió en el servidor desde la última sincronización.",
          serverRecord: current,
        };
      }
      const update = await transaction.customer.updateMany({
        where: { id: entityId, updatedAt: current.updatedAt },
        data,
      });
      if (!update.count) {
        const latest = await transaction.customer.findUnique({ where: { id: entityId } });
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El cliente cambió en el servidor durante la sincronización.",
          serverRecord: latest,
        };
      }
      const customer = await transaction.customer.findUnique({ where: { id: entityId } });
      if (!customer) throw new Error("No se pudo recuperar el cliente actualizado.");
      return { id: operationId, status: "synced", entityId, record: customer };
    }

    if (operation.kind === "equipment.create") {
      const data = {
        customerId: readString(payload.customerId, "El cliente", true)!,
        type: readString(payload.type, "El tipo de equipo", true)!,
        brand: readString(payload.brand, "La marca"),
        model: readString(payload.model, "El modelo"),
        serialNumber: readString(payload.serialNumber, "El número de serie"),
        accessories: readString(payload.accessories, "Los accesorios"),
        physicalState: readString(payload.physicalState, "El estado físico"),
      };
      const current = await transaction.equipment.findUnique({ where: { id: entityId } });
      if (current) {
        return sameValues(current, data)
          ? { id: operationId, status: "synced", entityId, record: current }
          : {
              id: operationId,
              status: "conflict",
              entityId,
              reason: "Ya existe otro equipo con este identificador.",
              serverRecord: current,
            };
      }
      const customer = await transaction.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new Error("Sincroniza primero el cliente asociado al equipo.");
      const equipment = await transaction.equipment.create({
        data: { id: entityId, ...data },
      });
      return { id: operationId, status: "synced", entityId, record: equipment };
    }

    if (operation.kind === "equipment.update") {
      const current = await transaction.equipment.findUnique({ where: { id: entityId } });
      if (!current) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El equipo ya no existe en el servidor.",
          serverRecord: null,
        };
      }
      const data = {
        customerId: readString(payload.customerId, "El cliente", true)!,
        type: readString(payload.type, "El tipo de equipo", true)!,
        brand: readString(payload.brand, "La marca"),
        model: readString(payload.model, "El modelo"),
        serialNumber: readString(payload.serialNumber, "El número de serie"),
        accessories: readString(payload.accessories, "Los accesorios"),
        physicalState: readString(payload.physicalState, "El estado físico"),
      };
      if (sameValues(current, data)) {
        return { id: operationId, status: "synced", entityId, record: current };
      }
      if (!operation.baseUpdatedAt || current.updatedAt.toISOString() !== operation.baseUpdatedAt) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El equipo cambió en el servidor desde la última sincronización.",
          serverRecord: current,
        };
      }
      const update = await transaction.equipment.updateMany({
        where: { id: entityId, updatedAt: current.updatedAt },
        data,
      });
      if (!update.count) {
        const latest = await transaction.equipment.findUnique({ where: { id: entityId } });
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "El equipo cambió en el servidor durante la sincronización.",
          serverRecord: latest,
        };
      }
      const equipment = await transaction.equipment.findUnique({ where: { id: entityId } });
      if (!equipment) throw new Error("No se pudo recuperar el equipo actualizado.");
      return { id: operationId, status: "synced", entityId, record: equipment };
    }

    if (operation.kind === "order.create") {
      const data = {
        customerId: readString(payload.customerId, "El cliente", true)!,
        equipmentId: readString(payload.equipmentId, "El equipo", true)!,
        reportedProblem: readString(payload.reportedProblem, "El problema", true)!,
        diagnosis: readString(payload.diagnosis, "El diagnóstico"),
        estimatedDate: payload.estimatedDate ? new Date(String(payload.estimatedDate)) : null,
      };
      if (data.estimatedDate && !Number.isFinite(data.estimatedDate.getTime())) {
        throw new Error("La fecha estimada no es válida.");
      }
      const current = await transaction.repairOrder.findUnique({ where: { id: entityId } });
      if (current) {
        return sameValues(current, data)
          ? { id: operationId, status: "synced", entityId, record: current }
          : {
              id: operationId,
              status: "conflict",
              entityId,
              reason: "Ya existe otra orden con este identificador.",
              serverRecord: current,
            };
      }
      const equipment = await transaction.equipment.findUnique({
        where: { id: data.equipmentId },
      });
      if (!equipment || equipment.customerId !== data.customerId) {
        throw new Error("El equipo debe pertenecer al cliente seleccionado.");
      }
      const year = new Date().getFullYear();
      const latest = await transaction.repairOrder.findFirst({
        where: { orderNumber: { startsWith: `${year}-` } },
        orderBy: { orderNumber: "desc" },
      });
      const sequence = latest
        ? Number(latest.orderNumber.split("-")[1] ?? "0") + 1
        : 1771;
      const order = await transaction.repairOrder.create({
        data: {
          id: entityId,
          orderNumber: `${year}-${String(sequence).padStart(7, "0")}`,
          ...data,
          history: {
            create: {
              id: `${operationId}:history`,
              action: "Equipo recibido (sincronizado)",
              newStatus: "RECIBIDO",
              userId,
            },
          },
        },
      });
      return { id: operationId, status: "synced", entityId, record: order };
    }

    if (operation.kind === "order.update") {
      const current = await transaction.repairOrder.findUnique({ where: { id: entityId } });
      if (!current) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "La orden ya no existe en el servidor.",
          serverRecord: null,
        };
      }
      const status = readString(payload.status, "El estado", true)!;
      if (!REPAIR_STATUSES.includes(status as (typeof REPAIR_STATUSES)[number])) {
        throw new Error("El estado de la orden no es válido.");
      }
      const data = {
        status: status as (typeof REPAIR_STATUSES)[number],
        diagnosis: readString(payload.diagnosis, "El diagnóstico"),
        workDone: readString(payload.workDone, "El trabajo realizado"),
      };
      if (sameValues(current, data)) {
        return { id: operationId, status: "synced", entityId, record: current };
      }
      if (!operation.baseUpdatedAt || current.updatedAt.toISOString() !== operation.baseUpdatedAt) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "La orden cambió en el servidor desde la última sincronización.",
          serverRecord: current,
        };
      }
      const update = await transaction.repairOrder.updateMany({
        where: { id: entityId, updatedAt: current.updatedAt },
        data: {
          ...data,
          deliveredAt:
            data.status === "ENTREGADO" ? current.deliveredAt ?? new Date() : current.deliveredAt,
        },
      });
      if (!update.count) {
        const latest = await transaction.repairOrder.findUnique({ where: { id: entityId } });
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "La orden cambió en el servidor durante la sincronización.",
          serverRecord: latest,
        };
      }
      await transaction.orderHistory.create({
        data: {
          id: `${operationId}:history`,
          orderId: entityId,
          action: `Estado cambiado a ${data.status} (sincronizado)`,
          previousStatus: current.status,
          newStatus: data.status,
          comment: readString(payload.comment, "El comentario"),
          userId,
        },
      });
      const order = await transaction.repairOrder.findUnique({ where: { id: entityId } });
      if (!order) throw new Error("No se pudo recuperar la orden actualizada.");
      return { id: operationId, status: "synced", entityId, record: order };
    }

    if (operation.kind === "budget.create") {
      const current = await transaction.budget.findUnique({ where: { id: operationId } });
      const labor = readMoney(payload.labor, "La mano de obra");
      const parts = readMoney(payload.parts, "Las piezas");
      const other = readMoney(payload.other, "Otros gastos");
      const discount = readMoney(payload.discount, "El descuento");
      const data = {
        orderId: readString(payload.orderId, "La orden", true)!,
        labor,
        parts,
        other,
        discount,
        total: labor + parts + other - discount,
        notes: readString(payload.notes, "Las notas"),
      };
      if (current) {
        return sameValues(current, data)
          ? { id: operationId, status: "synced", entityId, record: current }
          : {
              id: operationId,
              status: "conflict",
              entityId,
              reason: "Ya existe un presupuesto diferente con este identificador.",
              serverRecord: current,
            };
      }
      const order = await transaction.repairOrder.findUnique({ where: { id: data.orderId } });
      if (!order) throw new Error("Sincroniza primero la orden relacionada con el presupuesto.");
      const latest = await transaction.budget.findFirst({
        where: { orderId: data.orderId },
        orderBy: { createdAt: "desc" },
      });
      if (latest && isNewerThan(latest.createdAt, operation.snapshotAt) && payload.confirmed !== true) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "Se agregó otro presupuesto a esta orden mientras el dispositivo estaba desconectado.",
          serverRecord: latest,
        };
      }
      const budget = await transaction.budget.create({
        data: { id: operationId, ...data, createdBy: userId },
      });
      await transaction.orderHistory.create({
        data: {
          id: `${operationId}:history`,
          orderId: data.orderId,
          userId,
          action: "Presupuesto creado (sincronizado)",
          comment: `Total RD$ ${data.total.toFixed(2)}`,
        },
      });
      return { id: operationId, status: "synced", entityId, record: budget };
    }

    if (operation.kind === "payment.create") {
      const current = await transaction.payment.findUnique({ where: { id: operationId } });
      const data = {
        orderId: readString(payload.orderId, "La orden", true)!,
        amount: readMoney(payload.amount, "El abono", false),
        method: readString(payload.method, "El método de pago"),
        note: readString(payload.note, "La nota"),
      };
      if (current) {
        return sameValues(current, data)
          ? { id: operationId, status: "synced", entityId, record: current }
          : {
              id: operationId,
              status: "conflict",
              entityId,
              reason: "Ya existe un pago diferente con este identificador.",
              serverRecord: current,
            };
      }
      const order = await transaction.repairOrder.findUnique({ where: { id: data.orderId } });
      if (!order) throw new Error("Sincroniza primero la orden relacionada con el pago.");
      const latest = await transaction.payment.findFirst({
        where: { orderId: data.orderId },
        orderBy: { createdAt: "desc" },
      });
      if (latest && isNewerThan(latest.createdAt, operation.snapshotAt) && payload.confirmed !== true) {
        return {
          id: operationId,
          status: "conflict",
          entityId,
          reason: "Se registró otro pago para esta orden mientras el dispositivo estaba desconectado.",
          serverRecord: latest,
        };
      }
      const payment = await transaction.payment.create({
        data: { id: operationId, ...data, createdBy: userId },
      });
      await transaction.orderHistory.create({
        data: {
          id: `${operationId}:history`,
          orderId: data.orderId,
          userId,
          action: "Pago registrado (sincronizado)",
          comment: `Abono RD$ ${data.amount.toFixed(2)}`,
        },
      });
      return { id: operationId, status: "synced", entityId, record: payment };
    }

    throw new Error("Tipo de operación offline no válido.");
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de sincronización no es JSON válido." }, { status: 400 });
  }
  const allowedKinds: OfflineOperation["kind"][] = [
    "customer.create",
    "customer.update",
    "equipment.create",
    "equipment.update",
    "order.create",
    "order.update",
    "budget.create",
    "payment.create",
  ];
  if (
    !isRecord(body) ||
    !Array.isArray(body.operations) ||
    body.operations.length > 100 ||
    !body.operations.every(
      (operation) =>
        isRecord(operation) &&
        typeof operation.id === "string" &&
        operation.id.length > 0 &&
        typeof operation.entityId === "string" &&
        allowedKinds.includes(operation.kind as OfflineOperation["kind"]) &&
        typeof operation.snapshotAt === "string" &&
        Number.isFinite(new Date(operation.snapshotAt).getTime()) &&
        typeof operation.createdAt === "string" &&
        Number.isFinite(new Date(operation.createdAt).getTime()) &&
        (operation.baseUpdatedAt === undefined ||
          (typeof operation.baseUpdatedAt === "string" &&
            Number.isFinite(new Date(operation.baseUpdatedAt).getTime()))) &&
        isRecord(operation.payload),
    )
  ) {
    return NextResponse.json({ error: "La cola de sincronización no es válida." }, { status: 400 });
  }

  const operations = body.operations as OfflineOperation[];
  const results: SyncResult[] = [];
  const createdEntityVersions = new Map<string, string>();
  const financialEventVersions = new Map<string, string>();
  for (const operation of operations) {
    try {
      const orderId =
        typeof operation.payload.orderId === "string" ? operation.payload.orderId : "";
      const financialVersion = financialEventVersions.get(orderId);
      const preparedOperation =
        operation.kind === "order.update" && createdEntityVersions.has(operation.entityId)
          ? {
              ...operation,
              baseUpdatedAt: createdEntityVersions.get(operation.entityId),
            }
          : (operation.kind === "budget.create" || operation.kind === "payment.create") &&
              financialVersion
            ? { ...operation, snapshotAt: financialVersion }
          : operation;
      const result = await applyOperation(preparedOperation, user.id);
      results.push(result);
      if (
        result.status === "synced" &&
        operation.kind === "order.create" &&
        result.record.updatedAt instanceof Date
      ) {
        createdEntityVersions.set(operation.entityId, result.record.updatedAt.toISOString());
      }
      if (
        result.status === "synced" &&
        (operation.kind === "budget.create" || operation.kind === "payment.create") &&
        result.record.createdAt instanceof Date
      ) {
        financialEventVersions.set(orderId, result.record.createdAt.toISOString());
      }
      if (result.status !== "synced") break;
    } catch (error) {
      console.error(`Falló la operación offline ${operation.id}.`, error);
      results.push({
        id: operation.id,
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo sincronizar la operación.",
      });
      break;
    }
  }

  return NextResponse.json(
    { results, serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
