import { db as firestore } from '../firebase.config';
import {
    collection,
    getDocs,
    setDoc,
    doc,
    deleteDoc,
    query,
    orderBy
} from "firebase/firestore";

const DB_NAME = 'LuluCakeDB';
const DB_VERSION = 2;

// Check if Firebase is actually configured
const isCloudEnabled = !!import.meta.env.VITE_FIREBASE_API_KEY;

export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts', { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllItems = async (storeName) => {
    // 1. Try Cloud first if enabled
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            const q = query(collection(firestore, storeName), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map(doc => doc.data());

            // Sync current cloud data to local for offline use
            await syncLocal(storeName, items);
            return items;
        } catch (err) {
            console.warn(`Cloud fetch failed for ${storeName}, falling back to local:`, err);
        }
    }

    // 2. Fallback to Local
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const syncLocal = async (storeName, items) => {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    items.forEach(item => store.add(item));
};

export const saveAllItems = async (storeName, items) => {
    // Save to Cloud
    if (isCloudEnabled && storeName !== 'drafts') {
        for (const item of items) {
            await setDoc(doc(firestore, storeName, item.id), item);
        }
    }

    // Save to Local
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        store.clear();
        items.forEach(item => store.add(item));

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const saveItem = async (storeName, item) => {
    // Save to Cloud
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            await setDoc(doc(firestore, storeName, item.id), item);
        } catch (err) {
            console.error("Cloud save failed:", err);
        }
    }

    // Save to Local
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const deleteItem = async (storeName, id) => {
    // Delete from Cloud
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            await deleteDoc(doc(firestore, storeName, id));
        } catch (err) {
            console.error("Cloud delete failed:", err);
        }
    }

    // Delete from Local
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
