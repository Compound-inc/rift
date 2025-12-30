import { openDB, type IDBPDatabase } from "idb";
import type { UIMessage } from "@ai-sdk-tools/store";

type CachedThreadMessages = {
  threadId: string;
  messages: UIMessage[];
  savedAt: number;
};

const DB_NAME = "rift-chat-cache";
const DB_VERSION = 1;
const STORE = "threadMessages";

let dbPromise: Promise<IDBPDatabase> | null = null;
const memoryCache = new Map<string, CachedThreadMessages>();

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "threadId" });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadCachedThreadMessages(
  threadId: string,
): Promise<CachedThreadMessages | null> {
  const fromMemory = memoryCache.get(threadId);
  if (fromMemory) return fromMemory;

  const db = await getDb();
  const record = (await db.get(STORE, threadId)) as CachedThreadMessages | undefined;
  if (record) {
    memoryCache.set(threadId, record);
    return record;
  }
  return null;
}

export function getMemoryCachedThreadMessages(
  threadId: string,
): CachedThreadMessages | null {
  return memoryCache.get(threadId) ?? null;
}

export function prefetchCachedThreadMessages(threadId: string): void {
  // Fire-and-forget: warm memoryCache by reading from IndexedDB.
  void loadCachedThreadMessages(threadId);
}

export async function saveCachedThreadMessages(
  threadId: string,
  messages: UIMessage[],
): Promise<void> {
  const db = await getDb();
  const record: CachedThreadMessages = {
    threadId,
    messages,
    savedAt: Date.now(),
  };
  memoryCache.set(threadId, record);
  await db.put(STORE, record);
}

/**
 * Reconciles the cache with server data.
 * Server is the source of truth - replaces cached messages with server messages.
 */
export async function reconcileCacheWithServer(
  threadId: string,
  serverMessages: UIMessage[],
): Promise<void> {
  if (!serverMessages || serverMessages.length === 0) return;
  await saveCachedThreadMessages(threadId, serverMessages);
}
