import type { IDBPDatabase } from 'idb'
import { openDB } from 'idb'

const STORE_NAME = 'easy-chat-store'
const DB_NAME = 'eesy-chat-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME)
                }
            }
        })
    }
    return dbPromise
}

export const idbStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const db = await initDB()
            const value = await db.get(STORE_NAME, name)
            return value || null
        } catch (error) {
            console.error('Failed to get item from IndexedDB:', error)
            return null
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            const db = await initDB()
            await db.put(STORE_NAME, value, name)
        } catch (error) {
            console.error('Failed to set item in IndexedDB:', error)
        }
    },
    removeItem: async (name: string): Promise<void> => {
        try {
            const db = await initDB()
            await db.delete(STORE_NAME, name)
        } catch (error) {
            console.error('Failed to remove item from IndexedDB:', error)
        }
    }
}
