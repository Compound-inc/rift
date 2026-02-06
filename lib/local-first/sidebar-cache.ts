import { openDB, type IDBPDatabase } from "idb";

export type SidebarThread = {
  threadId: string;
  title: string;
  pinned: boolean;
  _creationTime: number;
  lastMessageAt: number;
  generationStatus: "pending" | "generation" | "completed" | "failed";
  updatedAt?: number;
  shareId?: string;
  shareStatus?: "active" | "revoked";
  sharedAt?: number;
};

export type SidebarProfile = {
  displayName: string;
  profilePictureUrl?: string;
  plan?: import("@/lib/plan-ids").PlanId;
};

type Cached<T> = { userKey: string; value: T; savedAt: number };

const DB_NAME = "rift-ui-cache";
const DB_VERSION = 1;
const STORE_THREADS = "sidebarThreads";
const STORE_PROFILE = "sidebarProfile";
const LAST_USER_KEY_STORAGE = "rift:lastUserKey";

let dbPromise: Promise<IDBPDatabase> | null = null;
const memThreads = new Map<string, Cached<SidebarThread[]>>();
const memProfile = new Map<string, Cached<SidebarProfile>>();

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_THREADS)) {
          db.createObjectStore(STORE_THREADS, { keyPath: "userKey" });
        }
        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: "userKey" });
        }
      },
    });
  }
  return dbPromise;
}

export function getLastUserKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_USER_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setLastUserKey(userKey: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_USER_KEY_STORAGE, userKey);
  } catch {
    // ignore
  }
}

export function peekSidebarThreads(userKey: string): SidebarThread[] | null {
  return memThreads.get(userKey)?.value ?? null;
}

export function peekSidebarProfile(userKey: string): SidebarProfile | null {
  return memProfile.get(userKey)?.value ?? null;
}

export async function loadSidebarThreads(userKey: string): Promise<SidebarThread[] | null> {
  const fromMem = memThreads.get(userKey);
  if (fromMem) return fromMem.value;
  const db = await getDb();
  const record = (await db.get(STORE_THREADS, userKey)) as Cached<SidebarThread[]> | undefined;
  if (!record) return null;
  memThreads.set(userKey, record);
  return record.value;
}

export async function saveSidebarThreads(
  userKey: string,
  threads: SidebarThread[],
  limit: number = 15,
): Promise<void> {
  const trimmed = threads.slice(0, limit);
  const record: Cached<SidebarThread[]> = { userKey, value: trimmed, savedAt: Date.now() };
  memThreads.set(userKey, record);
  const db = await getDb();
  await db.put(STORE_THREADS, record);
}

export async function loadSidebarProfile(userKey: string): Promise<SidebarProfile | null> {
  const fromMem = memProfile.get(userKey);
  if (fromMem) return fromMem.value;
  const db = await getDb();
  const record = (await db.get(STORE_PROFILE, userKey)) as Cached<SidebarProfile> | undefined;
  if (!record) return null;
  memProfile.set(userKey, record);
  return record.value;
}

export async function saveSidebarProfile(userKey: string, profile: SidebarProfile): Promise<void> {
  const record: Cached<SidebarProfile> = { userKey, value: profile, savedAt: Date.now() };
  memProfile.set(userKey, record);
  const db = await getDb();
  await db.put(STORE_PROFILE, record);
}


