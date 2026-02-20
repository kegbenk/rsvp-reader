/**
 * IndexedDB storage for large EPUB files (fallback when localStorage is too small)
 */

const DB_NAME = 'rsvp-reader-db';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';
const EPUB_STORE_NAME = 'epub-files';
const SESSION_KEY = 'current-session';
const EPUB_KEY = 'current-epub';

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
      if (!db.objectStoreNames.contains(EPUB_STORE_NAME)) {
        db.createObjectStore(EPUB_STORE_NAME);
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
    const tx = db.transaction([STORE_NAME, EPUB_STORE_NAME], 'readwrite');
    const sessionStore = tx.objectStore(STORE_NAME);
    const epubStore = tx.objectStore(EPUB_STORE_NAME);

    await Promise.all([
      new Promise((resolve, reject) => {
        const request = sessionStore.delete(SESSION_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = epubStore.delete(EPUB_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    db.close();
    console.log('[IndexedDB] Session and EPUB cleared');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to clear session:', error);
    return false;
  }
}

/**
 * Save EPUB file ArrayBuffer to IndexedDB
 * @param {ArrayBuffer} epubArrayBuffer - The EPUB file as ArrayBuffer
 * @param {string} fileName - Original file name
 * @returns {Promise<boolean>} Whether the save was successful
 */
export async function saveEPUBToIndexedDB(epubArrayBuffer, fileName) {
  try {
    console.log('[IndexedDB] Saving EPUB file...', fileName);
    const db = await openDB();
    const tx = db.transaction(EPUB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(EPUB_STORE_NAME);

    const data = {
      arrayBuffer: epubArrayBuffer,
      fileName: fileName,
      savedAt: Date.now()
    };

    await new Promise((resolve, reject) => {
      const request = store.put(data, EPUB_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log('[IndexedDB] EPUB file saved successfully');
    return true;
  } catch (error) {
    console.error('[IndexedDB] Failed to save EPUB file:', error);
    return false;
  }
}

/**
 * Load EPUB file ArrayBuffer from IndexedDB
 * @returns {Promise<Object|null>} The EPUB data {arrayBuffer, fileName} or null
 */
export async function loadEPUBFromIndexedDB() {
  try {
    console.log('[IndexedDB] Loading EPUB file...');
    const db = await openDB();
    const tx = db.transaction(EPUB_STORE_NAME, 'readonly');
    const store = tx.objectStore(EPUB_STORE_NAME);

    const data = await new Promise((resolve, reject) => {
      const request = store.get(EPUB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (data) {
      console.log('[IndexedDB] EPUB file loaded successfully:', data.fileName);
      return data;
    } else {
      console.log('[IndexedDB] No EPUB file found');
      return null;
    }
  } catch (error) {
    console.error('[IndexedDB] Failed to load EPUB file:', error);
    return null;
  }
}
