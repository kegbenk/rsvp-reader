/**
 * Enhanced EPUB parsing with TOC extraction and chapter boundaries
 */

import { parseText } from './rsvp-utils.js';

/**
 * Parse EPUB with structure, TOC, and HTML content
 * @param {File} file - The EPUB file to parse
 * @returns {Promise<{text: string, words: string[], contentStructure: Object}>}
 */
export async function parseEPUBWithStructure(file) {
  const ePub = (await import('epubjs')).default;
  const book = ePub(await file.arrayBuffer());

  await book.ready;
  await book.loaded.spine;
  await book.loaded.navigation;

  // Extract TOC
  const tocData = await extractTOC(book);

  // Parse chapters with HTML content and text
  const chapters = await extractChapters(book, tocData);

  // Build word boundaries for each chapter
  const { words, chaptersWithBoundaries } = buildWordBoundaries(chapters);

  // Build flattened TOC for navigation
  const flatTOC = flattenTOC(chaptersWithBoundaries);

  return {
    text: words.join(' '),
    words,
    contentStructure: {
      chapters: chaptersWithBoundaries,
      toc: flatTOC,
      hasStructure: tocData.length > 0
    }
  };
}

/**
 * Extract table of contents from EPUB
 * Uses book.navigation.toc with fallback to spine items
 * @param {Object} book - The epubjs book object
 * @returns {Array} TOC items with title, href, level, and subitems
 */
async function extractTOC(book) {
  try {
    // Try to get structured TOC from navigation
    const tocItems = book.navigation?.toc || [];

    if (tocItems.length > 0) {
      return processTOCItems(tocItems, 1);
    }

    // Fallback: Create TOC from spine items
    return createTOCFromSpine(book.spine);
  } catch (error) {
    console.warn('Error extracting TOC:', error);
    return createTOCFromSpine(book.spine);
  }
}

/**
 * Process TOC items recursively to extract hierarchy
 * @param {Array} items - TOC items from epubjs
 * @param {number} level - Current hierarchy level
 * @returns {Array} Processed TOC items
 */
function processTOCItems(items, level = 1) {
  const processed = [];

  for (const item of items) {
    const tocItem = {
      id: item.id || item.href,
      title: item.label || item.title || 'Untitled',
      href: item.href,
      level: level,
      subitems: []
    };

    // Recursively process subitems
    if (item.subitems && item.subitems.length > 0) {
      tocItem.subitems = processTOCItems(item.subitems, level + 1);
    }

    processed.push(tocItem);
  }

  return processed;
}

/**
 * Create TOC from spine items when no TOC is available
 * @param {Object} spine - The book spine object
 * @returns {Array} Generated TOC items
 */
function createTOCFromSpine(spine) {
  const spineItems = spine?.spineItems || spine?.items || [];

  return spineItems.map((item, index) => {
    const href = item.href || item.url;
    // Extract filename without path and extension
    const filename = href ? href.split('/').pop().replace(/\.[^/.]+$/, '') : '';
    const title = item.title || filename || `Chapter ${index + 1}`;

    return {
      id: href || `spine-${index}`,
      title: title,
      href: href,
      level: 1,
      subitems: []
    };
  });
}

/**
 * Extract chapters with HTML content and plain text
 * @param {Object} book - The epubjs book object
 * @param {Array} tocData - TOC items
 * @returns {Promise<Array>} Chapters with HTML and text
 */
async function extractChapters(book, tocData) {
  const spineItems = book.spine?.spineItems || book.spine?.items || [];
  const chapters = [];

  // Map TOC items to spine items by href
  const tocMap = new Map();
  const flatTOC = [];

  function flattenTOCData(items, parent = null) {
    for (const item of items) {
      tocMap.set(item.href, { ...item, parent });
      flatTOC.push(item);
      if (item.subitems && item.subitems.length > 0) {
        flattenTOCData(item.subitems, item);
      }
    }
  }

  flattenTOCData(tocData);

  // Process each spine item
  for (let i = 0; i < spineItems.length; i++) {
    const item = spineItems[i];
    const href = item.href || item.url;

    if (!href) continue;

    try {
      // Load the section content
      const contents = await book.load(href);

      let htmlContent = '';
      let plainText = '';

      if (typeof contents === 'string') {
        htmlContent = contents;
        const doc = new DOMParser().parseFromString(contents, 'text/html');
        plainText = doc.body?.textContent || '';
      } else if (contents.body) {
        htmlContent = contents.body.innerHTML || '';
        plainText = contents.body.textContent || '';
      } else if (contents.documentElement) {
        htmlContent = contents.documentElement.innerHTML || '';
        plainText = contents.documentElement.textContent || '';
      }

      // Get TOC info if available
      const tocInfo = tocMap.get(href) || {
        id: href,
        title: `Chapter ${i + 1}`,
        level: 1
      };

      chapters.push({
        id: tocInfo.id,
        title: tocInfo.title,
        level: tocInfo.level,
        href: href,
        htmlContent: cleanHTML(htmlContent),
        plainText: cleanText(plainText)
      });
    } catch (error) {
      console.warn(`Could not load section ${href}:`, error);
    }
  }

  return chapters;
}

/**
 * Clean and sanitize HTML content
 * @param {string} html - Raw HTML
 * @returns {string} Cleaned HTML
 */
function cleanHTML(html) {
  if (!html) return '';

  // Remove script tags and dangerous attributes
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

  return cleaned;
}

/**
 * Clean and normalize text
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\1+/g, '$1')
    .trim();
}

/**
 * Build word boundaries for each chapter
 * @param {Array} chapters - Chapters with plain text
 * @returns {Object} { words, chaptersWithBoundaries }
 */
function buildWordBoundaries(chapters) {
  const allWords = [];
  const chaptersWithBoundaries = [];
  let currentWordIndex = 0;

  for (const chapter of chapters) {
    const chapterWords = parseText(chapter.plainText);
    const startWordIndex = currentWordIndex;
    const endWordIndex = currentWordIndex + chapterWords.length;

    chaptersWithBoundaries.push({
      ...chapter,
      plainText: chapter.plainText, // Keep plainText for accurate word counting in ReaderDisplay
      startWordIndex,
      endWordIndex,
      wordCount: chapterWords.length
    });

    allWords.push(...chapterWords);
    currentWordIndex = endWordIndex;
  }

  return {
    words: allWords,
    chaptersWithBoundaries
  };
}

/**
 * Flatten TOC hierarchy for navigation panel
 * @param {Array} chapters - Chapters with boundaries
 * @returns {Array} Flattened TOC items
 */
function flattenTOC(chapters) {
  return chapters.map((chapter, index) => ({
    id: chapter.id,
    title: chapter.title,
    level: chapter.level,
    chapterIndex: index,
    wordCount: chapter.wordCount,
    startWordIndex: chapter.startWordIndex
  }));
}
