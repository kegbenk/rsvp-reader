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
  const { words, chaptersWithBoundaries, images } = buildWordBoundaries(chapters);

  // Build flattened TOC for navigation
  const flatTOC = flattenTOC(chaptersWithBoundaries);

  return {
    text: words.join(' '),
    words,
    contentStructure: {
      chapters: chaptersWithBoundaries,
      toc: flatTOC,
      hasStructure: tocData.length > 0,
      images: images // Global image list for RSVP mode
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
      // Store TOC item with both full href and base href (without fragment)
      const fullHref = item.href;
      const baseHref = fullHref ? fullHref.split('#')[0] : '';

      tocMap.set(fullHref, { ...item, parent });
      if (baseHref && baseHref !== fullHref) {
        // Also map the base href if different (for spine matching)
        if (!tocMap.has(baseHref)) {
          tocMap.set(baseHref, { ...item, parent });
        }
      }

      flatTOC.push(item);
      if (item.subitems && item.subitems.length > 0) {
        flattenTOCData(item.subitems, item);
      }
    }
  }

  flattenTOCData(tocData);

  console.log('[extractChapters] TOC map entries:', Array.from(tocMap.entries()).map(([k, v]) => ({ href: k, title: v.title })));

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
        plainText = doc.body ? htmlToTextWithLineBreaks(doc.body) : '';
      } else if (contents.body) {
        htmlContent = contents.body.innerHTML || '';
        plainText = htmlToTextWithLineBreaks(contents.body);
      } else if (contents.documentElement) {
        htmlContent = contents.documentElement.innerHTML || '';
        plainText = htmlToTextWithLineBreaks(contents.documentElement);
      }

      // Resolve image URLs and extract image data
      const { html: resolvedHtml, images } = await resolveAndExtractImages(book, htmlContent, href, item);
      htmlContent = resolvedHtml;

      // Get TOC info if available - try direct match first, then base href
      let tocInfo = tocMap.get(href);

      if (!tocInfo) {
        // Try matching without path prefix (in case TOC uses relative paths)
        const hrefFilename = href.split('/').pop();
        for (const [key, value] of tocMap.entries()) {
          const keyFilename = key.split('/').pop();
          if (keyFilename === hrefFilename) {
            tocInfo = value;
            break;
          }
        }
      }

      if (!tocInfo) {
        console.warn(`[extractChapters] No TOC match for spine item: ${href}`);
        tocInfo = {
          id: href,
          title: `Chapter ${i + 1}`,
          level: 1
        };
      } else {
        console.log(`[extractChapters] Matched "${href}" to TOC item: "${tocInfo.title}"`);
      }

      chapters.push({
        id: tocInfo.id,
        title: tocInfo.title,
        level: tocInfo.level,
        href: href,
        htmlContent: cleanHTML(htmlContent),
        plainText: cleanText(plainText),
        images: images // Store images for RSVP mode
      });
    } catch (error) {
      console.warn(`Could not load section ${href}:`, error);
    }
  }

  return chapters;
}

/**
 * Resolve image paths in HTML to data URLs and extract image data
 * @param {Object} book - The epubjs book object
 * @param {string} html - HTML content
 * @param {string} baseHref - Base href for resolving relative paths
 * @param {Object} spineItem - The spine item for this section
 * @returns {Promise<{html: string, images: Array}>} HTML with resolved URLs and image data
 */
async function resolveAndExtractImages(book, html, baseHref, spineItem) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imageElements = doc.querySelectorAll('img');
  const images = [];

  console.log(`[resolveAndExtractImages] Found ${imageElements.length} images in chapter ${baseHref}`);

  // Note: Image display in EPUB traditional reader is not currently supported due to
  // epubjs API limitations. Images are tracked for RSVP mode position detection only.

  for (const img of imageElements) {
    const src = img.getAttribute('src');
    const alt = img.getAttribute('alt') || 'Image';

    if (!src) continue;

    try {
      // Track image position for RSVP mode (even though images won't display)
      const textBeforeImage = getTextBeforeElement(img);
      const wordsBefore = parseText(textBeforeImage);

      images.push({
        src: src, // Keep original src (won't display in traditional reader)
        alt: alt,
        wordPosition: wordsBefore.length,
        unavailable: true // Flag to indicate image couldn't be loaded
      });

      console.log(`[resolveAndExtractImages] Tracked image position for RSVP mode: ${src} at word ${wordsBefore.length}`);
    } catch (error) {
      console.warn(`[resolveAndExtractImages] Error tracking image ${src}:`, error);
    }
  }

  console.log(`[resolveAndExtractImages] Tracked ${images.length} image positions for RSVP mode`);

  return {
    html: doc.body.innerHTML,
    images: images
  };
}

/**
 * Convert HTML to plain text while preserving line breaks from block elements
 * @param {Element} element - The HTML element to convert
 * @returns {string} Plain text with line breaks preserved
 */
function htmlToTextWithLineBreaks(element) {
  if (!element) return '';

  let text = '';

  // Block-level elements that should add line breaks
  const blockElements = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'TR', 'BLOCKQUOTE', 'PRE', 'HR', 'BR',
    'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'ASIDE'
  ]);

  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName;

      // Skip script and style tags
      if (tagName === 'SCRIPT' || tagName === 'STYLE') {
        return;
      }

      // Process children
      for (const child of node.childNodes) {
        traverse(child);
      }

      // Add line break after block elements
      if (blockElements.has(tagName)) {
        text += '\n';
      }
    }
  }

  traverse(element);
  return text;
}

/**
 * Get all text content before an element in DOM order
 * @param {Element} element - The element to get text before
 * @returns {string} Text content
 */
function getTextBeforeElement(element) {
  let text = '';
  const walker = document.createTreeWalker(
    element.ownerDocument.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    if (node.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
      text += node.textContent;
    }
  }

  return text;
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
 * Clean and normalize text while preserving line breaks
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    // Replace multiple spaces/tabs with single space, but preserve newlines
    .replace(/[ \t]+/g, ' ')
    // Replace multiple newlines with single newline
    .replace(/\n\n+/g, '\n')
    // Remove spaces at start/end of lines
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
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
  const allImages = [];
  let currentWordIndex = 0;

  for (const chapter of chapters) {
    const chapterWords = parseText(chapter.plainText);
    const startWordIndex = currentWordIndex;
    const endWordIndex = currentWordIndex + chapterWords.length;

    // Convert chapter-relative image positions to global positions
    const globalImages = (chapter.images || []).map(img => ({
      ...img,
      wordPosition: startWordIndex + img.wordPosition
    }));

    chaptersWithBoundaries.push({
      ...chapter,
      plainText: chapter.plainText, // Keep plainText for accurate word counting in ReaderDisplay
      startWordIndex,
      endWordIndex,
      wordCount: chapterWords.length,
      images: globalImages
    });

    allImages.push(...globalImages);
    allWords.push(...chapterWords);
    currentWordIndex = endWordIndex;
  }

  return {
    words: allWords,
    chaptersWithBoundaries,
    images: allImages // Global image list
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
