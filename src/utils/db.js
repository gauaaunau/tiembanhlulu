import { db as firestore } from '../firebase.config';
import {
    collection,
    getDocs,
    setDoc,
    doc,
    deleteDoc,
    query,
    orderBy,
    writeBatch,
    onSnapshot
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

export const subscribeToItems = (storeName, callback) => {
    // 1. Initial Local Load
    getAllItems(storeName).then(callback);

    // 2. Setup Cloud Listener if enabled
    if (isCloudEnabled && storeName !== 'drafts') {
        const q = query(collection(firestore, storeName), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const items = querySnapshot.docs.map(doc => doc.data());
            // Sync current cloud data to local for offline use
            syncLocal(storeName, items);
            // Trigger callback for UI update
            callback(items);
        }, (err) => {
            console.error(`Real-time subscription failed for ${storeName}:`, err);
        });
        return unsubscribe;
    }

    // Return dummy unsubscribe if cloud not enabled
    return () => { };
};

const syncLocal = async (storeName, items) => {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    items.forEach(item => store.add(item));
};

export const saveAllItems = async (storeName, items) => {
    // Save to Cloud - Using Batching to avoid rate limits
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            // Products have images (heavy), so we use a TINY batch size to be safe
            const batchSize = storeName === 'products' ? 5 : 400;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = writeBatch(firestore);
                const chunk = items.slice(i, i + batchSize);

                chunk.forEach(item => {
                    batch.set(doc(firestore, storeName, item.id), item);
                });

                await batch.commit();
                console.log(`Cloud batch for ${storeName} committed: ${i + chunk.length}/${items.length}`);
                // Long rest between batches to let the stream drain
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.error(`Cloud batch commit failed for ${storeName}:`, err);
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

export const addItemsBulk = async (storeName, items) => {
    if (!items || items.length === 0) return;

    // Save to Cloud (Batch)
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            // Smaller batch size for products to avoid 10MB payload limit
            const batchSize = storeName === 'products' ? 5 : 400;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = writeBatch(firestore);
                const chunk = items.slice(i, i + batchSize);

                chunk.forEach(item => {
                    batch.set(doc(firestore, storeName, item.id), item, { merge: true });
                });

                await batch.commit();
                console.log(`Cloud bulk add for ${storeName}: ${i + chunk.length}/${items.length}`);
                await new Promise(r => setTimeout(r, 1000)); // Throttle 1s
            }
        } catch (err) {
            console.error(`Cloud bulk add failed for ${storeName}:`, err);
        }
    }

    // Save to Local (Transaction)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        items.forEach(item => store.put(item));

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const deleteAllItems = async (storeName) => {
    // Delete from Cloud (Firestore)
    if (isCloudEnabled && storeName !== 'drafts') {
        try {
            const q = query(collection(firestore, storeName));
            // We need to fetch all docs to delete them
            const snapshot = await getDocs(q);
            const batchSize = 400; // Firestore limit is 500
            const docs = snapshot.docs;

            // Process in batches
            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(firestore);
                const chunk = docs.slice(i, i + batchSize);

                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                console.log(`Deleted batch of ${chunk.length} items from ${storeName}`);
            }
        } catch (err) {
            console.error(`Cloud delete all failed for ${storeName}:`, err);
        }
    }

    // Delete from Local (IndexedDB)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
