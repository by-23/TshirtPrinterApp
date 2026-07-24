const DB_NAME = "kiosk-operator";
const DB_VERSION = 1;
const STORE_NAME = "image-overrides";
export const LEGACY_LOCAL_STORAGE_KEY = "kiosk-image-overrides";

type BlobSource = Blob | File | string;

let dbPromise: Promise<IDBDatabase> | null = null;
let readyPromise: Promise<void> | null = null;

/** key → blob: URL for overrides; built-in assets stay as bundled paths. */
const urlCache = new Map<string, string>();
const overrideKeys = new Set<string>();

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });

  return dbPromise;
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDatabase().then(
    (db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header = "", payload = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function toBlob(source: BlobSource): Blob {
  if (typeof source === "string") return dataUrlToBlob(source);
  return source;
}

function setCacheEntry(key: string, blob: Blob) {
  const previous = urlCache.get(key);
  if (previous?.startsWith("blob:")) {
    URL.revokeObjectURL(previous);
  }
  urlCache.set(key, URL.createObjectURL(blob));
  overrideKeys.add(key);
}

function clearCacheEntry(key: string) {
  const previous = urlCache.get(key);
  if (previous?.startsWith("blob:")) {
    URL.revokeObjectURL(previous);
  }
  urlCache.delete(key);
  overrideKeys.delete(key);
}

function clearCache() {
  for (const url of urlCache.values()) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
  urlCache.clear();
  overrideKeys.clear();
}

async function readAllEntries(db: IDBDatabase): Promise<Array<[string, Blob]>> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const entries: Array<[string, Blob]> = [];
    const request = store.openCursor();

    request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(entries);
        return;
      }
      entries.push([String(cursor.key), cursor.value as Blob]);
      cursor.continue();
    };
  });
}

async function migrateLegacyLocalStorage(db: IDBDatabase, allowedKeys: ReadonlySet<string>): Promise<void> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    return;
  }

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  for (const [key, dataUrl] of Object.entries(parsed)) {
    if (!allowedKeys.has(key) || typeof dataUrl !== "string" || !dataUrl.trim()) continue;
    store.put(dataUrlToBlob(dataUrl.trim()), key);
  }

  await transactionComplete(transaction);
  window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
}

async function hydrateCache(allowedKeys: ReadonlySet<string>): Promise<void> {
  const db = await openDatabase();
  await migrateLegacyLocalStorage(db, allowedKeys);

  clearCache();
  const entries = await readAllEntries(db);
  const junkKeys: string[] = [];

  for (const [key, blob] of entries) {
    if (!allowedKeys.has(key) || !(blob instanceof Blob)) {
      junkKeys.push(key);
      continue;
    }
    // Empty / tiny / non-image blobs produce broken <img> icons and must not
    // shadow bundled defaults (common after a theme-panel wipe left junk).
    const type = blob.type || "";
    if (blob.size < 256 || (type && !type.startsWith("image/") && type !== "application/octet-stream")) {
      junkKeys.push(key);
      continue;
    }
    setCacheEntry(key, blob);
  }

  if (junkKeys.length > 0) {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const key of junkKeys) {
      store.delete(key);
    }
    await transactionComplete(transaction);
  }
}

export function ensureKioskImageStoreReady(allowedKeys: ReadonlySet<string>): Promise<void> {
  if (!readyPromise) {
    readyPromise = hydrateCache(allowedKeys);
  }
  return readyPromise;
}

export function getCachedImageUrl(key: string, defaultUrl = ""): string {
  return urlCache.get(key) ?? defaultUrl.trim();
}

export function getOverrideKeys(): ReadonlySet<string> {
  return overrideKeys;
}

export function hasCachedOverride(key: string): boolean {
  return overrideKeys.has(key);
}

export async function saveImageOverride(key: string, source: BlobSource): Promise<boolean> {
  try {
    const blob = toBlob(source);
    const store = await getStore("readwrite");
    await new Promise<void>((resolve, reject) => {
      const request = store.put(blob, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB write failed"));
    });
    setCacheEntry(key, blob);
    return true;
  } catch {
    return false;
  }
}

export async function deleteImageOverride(key: string): Promise<void> {
  try {
    const store = await getStore("readwrite");
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB delete failed"));
    });
  } catch {
    // Best-effort delete; still drop from cache so UI stays consistent.
  }
  clearCacheEntry(key);
}

export async function clearAllImageOverrides(): Promise<void> {
  try {
    const store = await getStore("readwrite");
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB clear failed"));
    });
  } catch {
    // Best-effort clear.
  }
  clearCache();
}

/** Delete overrides for the given keys only — leaves everything else intact. */
export async function clearImageOverridesForKeys(keys: ReadonlySet<string>): Promise<void> {
  if (keys.size === 0) return;
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const key of keys) {
      store.delete(key);
    }
    await transactionComplete(transaction);
  } catch {
    // Best-effort delete; still drop from cache so UI stays consistent.
  }
  for (const key of keys) {
    clearCacheEntry(key);
  }
}
