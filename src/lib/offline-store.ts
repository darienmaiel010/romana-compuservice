export type OfflineSnapshot = {
  customers: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  serverTime: string;
};

export type OfflineOperation = {
  id: string;
  kind:
    | "customer.create"
    | "customer.update"
    | "equipment.create"
    | "equipment.update"
    | "order.create"
    | "order.update"
    | "budget.create"
    | "payment.create";
  entityId: string;
  baseUpdatedAt?: string;
  snapshotAt: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type OfflineConflict = {
  id: string;
  operation: OfflineOperation;
  reason: string;
  serverRecord: Record<string, unknown> | null;
  detectedAt: string;
};

const DATABASE_NAME = "romana-compuservice-offline";
const DATABASE_VERSION = 1;
const SNAPSHOT_KEY = "latest";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("snapshots")) {
        database.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("operations")) {
        database.createObjectStore("operations", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("conflicts")) {
        database.createObjectStore("conflicts", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la base local."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falló una operación local."));
  });
}

async function storeRequest<T>(
  storeName: "snapshots" | "operations" | "conflicts",
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    return await requestResult(request(transaction.objectStore(storeName)));
  } finally {
    database.close();
  }
}

export async function readOfflineSnapshot() {
  const record = await storeRequest<{ key: string; value: OfflineSnapshot } | undefined>(
    "snapshots",
    "readonly",
    (store) => store.get(SNAPSHOT_KEY),
  );
  return record?.value ?? null;
}

export async function writeOfflineSnapshot(value: OfflineSnapshot) {
  await storeRequest("snapshots", "readwrite", (store) =>
    store.put({ key: SNAPSHOT_KEY, value }),
  );
}

export async function listOfflineOperations() {
  const operations = await storeRequest<OfflineOperation[]>(
    "operations",
    "readonly",
    (store) => store.getAll(),
  );
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function saveOfflineOperation(operation: OfflineOperation) {
  await storeRequest("operations", "readwrite", (store) => store.put(operation));
}

export async function removeOfflineOperation(id: string) {
  await storeRequest("operations", "readwrite", (store) => store.delete(id));
}

export async function listOfflineConflicts() {
  return storeRequest<OfflineConflict[]>("conflicts", "readonly", (store) => store.getAll());
}

export async function saveOfflineConflict(conflict: OfflineConflict) {
  await storeRequest("conflicts", "readwrite", (store) => store.put(conflict));
}

export async function removeOfflineConflict(id: string) {
  await storeRequest("conflicts", "readwrite", (store) => store.delete(id));
}
