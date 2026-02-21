/**
 * File parsing utilities for PDF and EPUB files
 */

import { parseEPUBWithStructure } from './epub-structure-parser.js';
import { parseText } from './rsvp-utils.js';

/**
 * Parse a PDF file with structure (outline/TOC) and extract text
 * @param {File} file - The PDF file to parse
 * @returns {Promise<{text: string, words: string[], contentStructure: Object}>}
 */
export async function parsePDFWithStructure(file) {
  const pdfjsLib = await import('pdfjs-dist');

  // Set up the worker - use unpkg which mirrors npm directly
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Extract text page-by-page to track page boundaries
  // Keep paragraph structure by detecting significant vertical gaps
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // First pass: calculate average line height
    const yPositions = [];
    for (const item of textContent.items) {
      if ('str' in item && item.transform) {
        yPositions.push(item.transform[5]);
      }
    }
    yPositions.sort((a, b) => b - a); // Sort descending (top to bottom)

    // Calculate typical line spacing (distance between consecutive lines)
    const lineSpacings = [];
    for (let j = 0; j < yPositions.length - 1; j++) {
      const spacing = Math.abs(yPositions[j] - yPositions[j + 1]);
      if (spacing > 1 && spacing < 50) { // Ignore tiny adjustments and huge gaps
        lineSpacings.push(spacing);
      }
    }
    const avgLineSpacing = lineSpacings.length > 0
      ? lineSpacings.reduce((a, b) => a + b) / lineSpacings.length
      : 12; // Default to ~12pt line spacing

    // Paragraph break threshold: 1.5x the normal line spacing
    const paragraphBreakThreshold = avgLineSpacing * 1.5;

    // Second pass: build text with paragraph breaks only
    let lastY = null;
    let pageText = '';

    for (const item of textContent.items) {
      if (!('str' in item)) continue;

      const str = /** @type {{ str: string, transform: number[] }} */ (item).str;
      const y = item.transform ? item.transform[5] : null;

      // Check if this is a paragraph break (large vertical gap)
      if (lastY !== null && y !== null) {
        const verticalGap = Math.abs(lastY - y);
        if (verticalGap > paragraphBreakThreshold) {
          pageText += '\n\n'; // Paragraph break
        } else if (verticalGap > avgLineSpacing * 0.5) {
          pageText += ' '; // Just a space for normal line continuation
        }
      }

      pageText += str + ' ';
      lastY = y;
    }

    pageTexts.push(pageText.trim());
  }

  // Try to get PDF outline/bookmarks
  let outline = null;
  try {
    outline = await pdf.getOutline();
  } catch (e) {
    console.log('[PDF] No outline available');
  }

  // Build chapters from outline or fall back to page-based navigation
  let chapters = [];
  let toc = [];

  if (outline && outline.length > 0) {
    // PDF has a built-in outline/TOC
    chapters = await buildChaptersFromOutline(pdf, outline, pageTexts, file.name);
    toc = buildTOCFromChapters(chapters);
  } else {
    // No outline - create page-based navigation
    chapters = buildPageBasedChapters(pageTexts, file.name);
    toc = buildTOCFromChapters(chapters);
  }

  // Combine all text and parse into words (join with double newlines to preserve page breaks)
  const fullText = pageTexts.join('\n\n');
  const words = parseText(fullText);

  // Calculate word boundaries for each chapter
  const chaptersWithBoundaries = calculateWordBoundaries(chapters, words);

  return {
    text: fullText,
    words,
    contentStructure: {
      chapters: chaptersWithBoundaries,
      toc,
      hasStructure: outline && outline.length > 0,
      images: []
    }
  };
}

/**
 * Build chapters from PDF outline entries
 */
async function buildChaptersFromOutline(pdf, outline, pageTexts, fileName) {
  const chapters = [];

  // Get the page number of the first outline entry
  const firstOutlinePageNum = await getOutlinePageNumber(pdf, outline[0]);

  // If the first chapter doesn't start at page 1, create a "Front Matter" chapter
  if (firstOutlinePageNum > 1) {
    const frontMatterText = pageTexts.slice(0, firstOutlinePageNum - 1).join('\n\n');
    chapters.push({
      id: 'pdf-front-matter',
      title: 'Front Matter',
      level: 1,
      href: null,
      htmlContent: `<p>${frontMatterText.replace(/\n+/g, '</p><p>')}</p>`,
      plainText: frontMatterText,
      pageStart: 1,
      pageEnd: firstOutlinePageNum - 1,
      images: []
    });
  }

  for (let i = 0; i < outline.length; i++) {
    const item = outline[i];
    let pageNum = await getOutlinePageNumber(pdf, item);

    // Determine end page (start of next chapter or last page)
    const nextPageNum = i < outline.length - 1
      ? await getOutlinePageNumber(pdf, outline[i + 1])
      : pageTexts.length + 1;

    // Collect text from this chapter's pages
    const chapterText = pageTexts.slice(pageNum - 1, nextPageNum - 1).join('\n\n');

    chapters.push({
      id: `pdf-chapter-${i}`,
      title: item.title || `Chapter ${i + 1}`,
      level: 1,
      href: null,
      htmlContent: `<p>${chapterText.replace(/\n+/g, '</p><p>')}</p>`,
      plainText: chapterText,
      pageStart: pageNum,
      pageEnd: nextPageNum - 1,
      images: []
    });
  }

  return chapters;
}

/**
 * Get page number from outline item
 */
async function getOutlinePageNumber(pdf, item) {
  try {
    if (item.dest) {
      const dest = typeof item.dest === 'string'
        ? await pdf.getDestination(item.dest)
        : item.dest;

      if (dest) {
        const pageRef = dest[0];
        return await pdf.getPageIndex(pageRef) + 1;
      }
    }
  } catch (e) {
    console.warn('[PDF] Could not resolve page number:', e);
  }
  return 1;
}

/**
 * Create page-based chapters when no outline exists
 */
function buildPageBasedChapters(pageTexts, fileName) {
  const chapters = [];
  const chunkSize = Math.ceil(pageTexts.length / Math.max(1, Math.floor(pageTexts.length / 10))); // ~10 pages per chunk

  for (let i = 0; i < pageTexts.length; i += chunkSize) {
    const endIdx = Math.min(i + chunkSize, pageTexts.length);
    const chapterText = pageTexts.slice(i, endIdx).join('\n\n');
    const pageStart = i + 1;
    const pageEnd = endIdx;

    chapters.push({
      id: `pdf-page-${pageStart}`,
      title: pageTexts.length <= 20 ? `Page ${pageStart}` : `Pages ${pageStart}-${pageEnd}`,
      level: 1,
      href: null,
      htmlContent: `<p>${chapterText.replace(/\n+/g, '</p><p>')}</p>`,
      plainText: chapterText,
      pageStart,
      pageEnd,
      images: []
    });
  }

  // If we ended up with just one chapter, name it after the file
  if (chapters.length === 1) {
    chapters[0].title = fileName.replace('.pdf', '');
  }

  return chapters;
}

/**
 * Calculate word boundaries for chapters
 */
function calculateWordBoundaries(chapters, words) {
  let currentWordIndex = 0;
  const chaptersWithBoundaries = [];

  for (const chapter of chapters) {
    const chapterWords = parseText(chapter.plainText);
    const startWordIndex = currentWordIndex;
    const endWordIndex = currentWordIndex + chapterWords.length;

    chaptersWithBoundaries.push({
      ...chapter,
      startWordIndex,
      endWordIndex,
      wordCount: chapterWords.length
    });

    currentWordIndex = endWordIndex;
  }

  return chaptersWithBoundaries;
}

/**
 * Build TOC array from chapters
 */
function buildTOCFromChapters(chapters) {
  return chapters.map((chapter, index) => ({
    id: chapter.id,
    title: chapter.title,
    level: chapter.level,
    chapterIndex: index
  }));
}

/**
 * Parse an EPUB file and extract its text content
 * @param {File} file - The EPUB file to parse
 * @returns {Promise<string>} The extracted text
 */
export async function parseEPUB(file) {
  const ePub = (await import('epubjs')).default

  const arrayBuffer = await file.arrayBuffer()
  const book = ePub(arrayBuffer)

  await book.ready
  await book.loaded.spine

  let fullText = ''

  // Get spine items - the API varies between versions
  const spineItems = book.spine?.spineItems || book.spine?.items || []

  for (const item of spineItems) {
    try {
      // Load the section content using the book's load method
      const href = item.href || item.url
      if (!href) continue

      const contents = await book.load(href)
      if (contents) {
        let text = ''
        // contents can be a Document, string, or XML document
        if (typeof contents === 'string') {
          const doc = new DOMParser().parseFromString(contents, 'text/html')
          text = doc.body?.textContent || ''
        } else if (contents.body) {
          text = contents.body.textContent || ''
        } else if (contents.documentElement) {
          text = contents.documentElement.textContent || ''
        }
        fullText += text + ' '
      }
    } catch (e) {
      console.warn('Could not load section:', e)
    }
  }

  // Clean up the text
  return cleanText(fullText)
}

/**
 * Clean and normalize extracted text
 * @param {string} text - The raw text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return text
    // Replace multiple spaces/newlines with single space
    .replace(/\s+/g, ' ')
    // Remove excessive punctuation
    .replace(/([.!?])\1+/g, '$1')
    // Trim
    .trim()
}

/**
 * Detect file type and parse accordingly
 * @param {File} file - The file to parse
 * @returns {Promise<{text: string, words?: string[], contentStructure?: Object, fileType: 'pdf' | 'epub'}>} The parsed content
 */
export async function parseFile(file) {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.pdf')) {
    // Parse PDF with structure (outline/TOC) extraction
    const result = await parsePDFWithStructure(file);
    return {
      ...result,
      fileType: 'pdf'
    };
  } else if (fileName.endsWith('.epub')) {
    // Note: EPUB image display is not currently supported due to epubjs API limitations
    // Use structured parser for EPUBs to extract TOC and chapters
    const result = await parseEPUBWithStructure(file);
    return {
      ...result,
      fileType: 'epub'
    };
  } else {
    throw new Error(`Unsupported file type: ${fileName}`)
  }
}

/**
 * Get supported file extensions
 * @returns {string} Comma-separated list of supported extensions
 */
export function getSupportedExtensions() {
  return '.pdf,.epub'
}
