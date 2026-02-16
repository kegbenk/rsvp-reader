/**
 * Progress storage utilities for persisting reading sessions
 */

import {
  saveSessionToIndexedDB,
  loadSessionFromIndexedDB,
  hasSessionInIndexedDB,
  clearSessionFromIndexedDB
} from './indexed-db-storage.js';

const STORAGE_KEY = 'rsvp-reading-session';
const USE_INDEXEDDB_KEY = 'rsvp-use-indexeddb';

/**
 * Save the current reading session to localStorage
 * @param {Object} session - The session data to save
 * @param {string} session.text - The full text being read
 * @param {number} session.currentWordIndex - Current position in the text
 * @param {number} session.totalWords - Total word count
 * @param {Object} session.settings - Reader settings
 * @param {string} session.readingMode - Reading mode ('rsvp' or 'reader')
 * @param {number} session.currentChapterIndex - Current chapter index
 * @param {number} session.readerScrollPosition - Reader mode scroll position (0-100)
 * @param {Object} session.contentStructure - Content structure (TOC and chapters, without HTML)
 * @returns {boolean} Whether the save was successful
 */
export function saveSession(session) {
  console.log('[saveSession] Starting save...');

  // Check if we should use IndexedDB (flag set from previous quota error)
  const useIndexedDB = localStorage.getItem(USE_INDEXEDDB_KEY) === 'true';

  if (useIndexedDB) {
    console.log('[saveSession] Using IndexedDB (flagged for large files)');
    return saveSessionToIndexedDB(session);
  }

  // Check if localStorage is available
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    console.log('[saveSession] localStorage is accessible');
  } catch (e) {
    console.error('[saveSession] localStorage is NOT accessible:', e);
    console.error('[saveSession] You may be in Private Browsing mode or localStorage is disabled');
    // Switch to IndexedDB
    console.log('[saveSession] Switching to IndexedDB...');
    localStorage.setItem(USE_INDEXEDDB_KEY, 'true');
    return saveSessionToIndexedDB(session);
  }

  try {
    const data = {
      text: session.text,
      currentWordIndex: session.currentWordIndex,
      totalWords: session.totalWords,
      readingMode: session.readingMode || 'rsvp',
      currentChapterIndex: session.currentChapterIndex || 0,
      readerScrollPosition: session.readerScrollPosition || 0,
      // Store lightweight contentStructure (omit htmlContent to save space)
      contentStructure: session.contentStructure ? {
        chapters: session.contentStructure.chapters.map(ch => ({
          id: ch.id,
          title: ch.title,
          level: ch.level,
          href: ch.href,
          startWordIndex: ch.startWordIndex,
          endWordIndex: ch.endWordIndex,
          wordCount: ch.wordCount,
          plainText: ch.plainText // Keep plainText for accurate highlighting
          // htmlContent omitted - will be re-parsed on load
        })),
        toc: session.contentStructure.toc,
        hasStructure: session.contentStructure.hasStructure
      } : null,
      settings: session.settings,
      savedAt: Date.now()
    };

    const serialized = JSON.stringify(data);

    // Check size (warn if > 2MB - iOS localStorage is limited)
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    console.log(`[saveSession] Session size: ${sizeInMB.toFixed(2)}MB`);

    if (sizeInMB > 2) {
      console.warn(`[saveSession] Session size is ${sizeInMB.toFixed(2)}MB, switching to IndexedDB`);
      // Flag to use IndexedDB for future saves
      localStorage.setItem(USE_INDEXEDDB_KEY, 'true');
      return saveSessionToIndexedDB(session);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    console.log('[saveSession] Save successful to localStorage!');
    return true;
  } catch (error) {
    console.error('[saveSession] Failed to save session:', error);
    console.error('[saveSession] Error name:', error.name);
    console.error('[saveSession] Error code:', error.code);

    // Handle quota exceeded error - switch to IndexedDB
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.log('[saveSession] Quota exceeded, switching to IndexedDB...');
      localStorage.setItem(USE_INDEXEDDB_KEY, 'true');
      return saveSessionToIndexedDB(session);
    }

    return false;
  }
}

/**
 * Load a saved reading session from localStorage or IndexedDB
 * @returns {Promise<Object|null>} The saved session data or null if none exists
 */
export async function loadSession() {
  // Check if we're using IndexedDB
  const useIndexedDB = localStorage.getItem(USE_INDEXEDDB_KEY) === 'true';

  if (useIndexedDB) {
    console.log('[loadSession] Loading from IndexedDB...');
    return await loadSessionFromIndexedDB();
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // Check IndexedDB as fallback
      console.log('[loadSession] No localStorage session, checking IndexedDB...');
      return await loadSessionFromIndexedDB();
    }
    console.log('[loadSession] Loaded from localStorage');
    return JSON.parse(data);
  } catch (error) {
    console.error('[loadSession] Failed to load from localStorage:', error);
    // Try IndexedDB as fallback
    console.log('[loadSession] Trying IndexedDB fallback...');
    return await loadSessionFromIndexedDB();
  }
}

/**
 * Check if a saved session exists
 * @returns {Promise<boolean>} Whether a saved session exists
 */
export async function hasSession() {
  try {
    const hasLocalStorage = localStorage.getItem(STORAGE_KEY) !== null;
    if (hasLocalStorage) return true;

    // Check IndexedDB too
    return await hasSessionInIndexedDB();
  } catch {
    return await hasSessionInIndexedDB();
  }
}

/**
 * Clear the saved session from localStorage and IndexedDB
 * @returns {Promise<boolean>} Whether the clear was successful
 */
export async function clearSession() {
  let success = true;

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USE_INDEXEDDB_KEY);
  } catch (error) {
    console.error('Failed to clear localStorage session:', error);
    success = false;
  }

  try {
    await clearSessionFromIndexedDB();
  } catch (error) {
    console.error('Failed to clear IndexedDB session:', error);
    success = false;
  }

  return success;
}

/**
 * Get a summary of the saved session without loading full text
 * @returns {Object|null} Summary with wordIndex, totalWords, savedAt, or null
 */
export function getSessionSummary() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    return {
      currentWordIndex: parsed.currentWordIndex,
      totalWords: parsed.totalWords,
      savedAt: parsed.savedAt,
      hasText: !!parsed.text,
      readingMode: parsed.readingMode || 'rsvp',
      currentChapterIndex: parsed.currentChapterIndex || 0,
      hasStructure: !!parsed.contentStructure
    };
  } catch {
    return null;
  }
}

/**
 * Calculate word index from a percentage
 * @param {number} percentage - Percentage (0-100)
 * @param {number} totalWords - Total word count
 * @returns {number} The word index
 */
export function percentageToWordIndex(percentage, totalWords) {
  if (!totalWords || totalWords <= 0) return 0;
  const clamped = Math.max(0, Math.min(100, percentage));
  return Math.floor((clamped / 100) * totalWords);
}

/**
 * Calculate percentage from word index
 * @param {number} wordIndex - Current word index
 * @param {number} totalWords - Total word count
 * @returns {number} The percentage (0-100)
 */
export function wordIndexToPercentage(wordIndex, totalWords) {
  if (!totalWords || totalWords <= 0) return 0;
  return Math.round((wordIndex / totalWords) * 100);
}
