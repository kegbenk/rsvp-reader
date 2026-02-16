/**
 * Position mapping and content navigation utilities
 * for syncing between RSVP and Reader modes
 */

/**
 * Find chapter index containing a word index
 * @param {Object} contentStructure - The content structure with chapters
 * @param {number} wordIndex - Word index to find
 * @returns {number} Chapter index, or 0 if not found
 */
export function getChapterAtWordIndex(contentStructure, wordIndex) {
  if (!contentStructure || !contentStructure.chapters) return 0;

  const index = contentStructure.chapters.findIndex(
    ch => wordIndex >= ch.startWordIndex && wordIndex < ch.endWordIndex
  );

  return index >= 0 ? index : 0;
}

/**
 * Calculate word index from chapter and scroll percentage
 * @param {Object} chapter - The chapter object
 * @param {number} scrollPercentage - Scroll percentage (0-100)
 * @returns {number} Word index
 */
export function getWordIndexFromScroll(chapter, scrollPercentage) {
  if (!chapter) return 0;

  const chapterWordCount = chapter.endWordIndex - chapter.startWordIndex;
  const offset = Math.floor(chapterWordCount * (scrollPercentage / 100));

  return chapter.startWordIndex + offset;
}

/**
 * Get scroll percentage within chapter for a word index
 * @param {Object} chapter - The chapter object
 * @param {number} wordIndex - Word index within chapter
 * @returns {number} Scroll percentage (0-100)
 */
export function getScrollPercentageInChapter(chapter, wordIndex) {
  if (!chapter) return 0;

  const offset = wordIndex - chapter.startWordIndex;
  const total = chapter.endWordIndex - chapter.startWordIndex;

  if (total === 0) return 0;

  return (offset / total) * 100;
}

/**
 * Calculate chapter progress (0-100%)
 * @param {Object} chapter - The chapter object
 * @param {number} wordIndex - Current word index
 * @returns {number} Progress percentage
 */
export function getChapterProgress(chapter, wordIndex) {
  if (!chapter) return 0;

  const offset = Math.max(0, wordIndex - chapter.startWordIndex);
  const total = chapter.endWordIndex - chapter.startWordIndex;

  if (total === 0) return 0;

  return Math.min(100, (offset / total) * 100);
}

/**
 * Get the next chapter index
 * @param {Object} contentStructure - The content structure
 * @param {number} currentChapterIndex - Current chapter index
 * @returns {number} Next chapter index, or current if at end
 */
export function getNextChapterIndex(contentStructure, currentChapterIndex) {
  if (!contentStructure || !contentStructure.chapters) return currentChapterIndex;

  const nextIndex = currentChapterIndex + 1;
  return nextIndex < contentStructure.chapters.length ? nextIndex : currentChapterIndex;
}

/**
 * Get the previous chapter index
 * @param {number} currentChapterIndex - Current chapter index
 * @returns {number} Previous chapter index, or 0 if at start
 */
export function getPreviousChapterIndex(currentChapterIndex) {
  return Math.max(0, currentChapterIndex - 1);
}
