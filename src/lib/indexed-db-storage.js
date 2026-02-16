/**
 * IndexedDB storage for large EPUB files (fallback when localStorage is too small)
 */

const DB_NAME = 'rsvp-reader-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current-session';

/**
 * Open IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save session to IndexedDB
 * @param {Object} session - The session data to save
 * @returns {Promise<boolean>} Whether the save was successful
 */
export async function saveSessionToIndexedDB(session) {
  try {
    console.log('[IndexedDB] Saving session...');
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const data = {
      ...session,
      savedAt: Date.now()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(data, SESSION_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log('[IndexedDB] Save successful!');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to save session:', error);
    return false;
  }
}

/**
 * Load session from IndexedDB
 * @returns {Promise<Object|null>} The saved session data or null
 */
export async function loadSessionFromIndexedDB() {
  try {
    console.log('[IndexedDB] Loading session...');
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const data = await new Promise((resolve, reject) => {
      const request = store.get(SESSION_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (data) {
      console.log('[IndexedDB] Session loaded successfully');
      return data;
    } else {
      console.log('[IndexedDB] No session found');
      return null;
    }
  } catch (error) {
    console.error('[IndexedDB] Failed to load session:', error);
    return null;
  }
}

/**
 * Check if a session exists in IndexedDB
 * @returns {Promise<boolean>} Whether a session exists
 */
export async function hasSessionInIndexedDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const exists = await new Promise((resolve, reject) => {
      const request = store.get(SESSION_KEY);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return exists;
  } catch (error) {
    console.error('[IndexedDB] Failed to check session:', error);
    return false;
  }
}

/**
 * Clear session from IndexedDB
 * @returns {Promise<boolean>} Whether the clear was successful
 */
export async function clearSessionFromIndexedDB() {
  try {
    console.log('[IndexedDB] Clearing session...');
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(SESSION_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log('[IndexedDB] Session cleared');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to clear session:', error);
    return false;
  }
}
