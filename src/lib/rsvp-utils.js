/**
 * RSVP utility functions for text processing and display calculations
 */

/**
 * Parse text into an array of words, preserving line break information
 * Words that follow line breaks are marked with a special suffix
 * @param {string} text - The input text to parse
 * @returns {string[]} Array of words (words after line breaks end with '\n')
 */
export function parseText(text) {
  if (!text || typeof text !== "string") return [];

  // Split by line breaks first to preserve line structure
  const lines = text.split(/\n/);
  const words = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    const lineWords = line.split(/\s+/).filter(w => w.length > 0);

    // Insert a blank marker between paragraphs (after the first paragraph)
    if (words.length > 0 && lineWords.length > 0) {
      words.push('\n'); // This will display as blank with a pause

      // Mark the first word of the new paragraph so it displays longer
      if (lineWords.length > 0) {
        lineWords[0] = '⟩' + lineWords[0]; // ⟩ marker for first word after line break
      }
    }

    // Use loop instead of spread operator to avoid stack overflow on large PDFs
    for (let j = 0; j < lineWords.length; j++) {
      words.push(lineWords[j]);
    }
  }

  return words;
}

/**
 * Calculate the Optimal Recognition Point (ORP) index for a word.
 * The ORP is the character position where the eye naturally focuses when reading.
 * Based on word length, this determines which letter should be highlighted.
 * Supports all Unicode letters (Latin, Cyrillic, CJK, Arabic, etc.)
 *
 * ORP Guidelines:
 * - 1-3 letter words: 1st letter
 * - 4-5 letter words: 2nd letter
 * - 6-9 letter words: 3rd letter
 * - 10-11 letter words: 4th letter
 * - 12-14 letters: 5th letter
 * - 15-17 letter words: 6th letter
 * - 18+ letter words: 7th letter
 *
 * @param {string} word - The word to calculate ORP for
 * @returns {number} The index of the letter that should be highlighted
 */
export function getORPIndex(word) {
  if (!word || typeof word !== "string") return 0;

  // Strip first-word-after-break marker if present
  const cleanWord = word.startsWith('⟩') ? word.substring(1) : word;

  const len = cleanWord.replace(/[^\p{L}]/gu, "").length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;  // 1-3 letters: 1st letter
  if (len <= 5) return 1;  // 4-5 letters: 2nd letter
  if (len <= 9) return 2;  // 6-9 letters: 3rd letter
  if (len <= 11) return 3; // 10-11 letters: 4th letter
  if (len <= 14) return 4; // 12-14 letters: 5th letter
  if (len <= 17) return 5; // 15-17 letters: 6th letter
  return 6;                // 18+ letters: 7th letter
}

/**
 * Get the actual character index for ORP, accounting for leading punctuation.
 * This adjusts the ORP index to skip over non-letter characters.
 * Supports all Unicode letters.
 *
 * @param {string} word - The word to calculate actual ORP for
 * @returns {number} The actual character index in the word
 */
// Pre-compiled regex for performance
const unicodeLetterRegex = /\p{L}/u

export function getActualORPIndex(word) {
  if (!word || typeof word !== "string") return 0;

  // Strip first-word-after-break marker if present
  const cleanWord = word.startsWith('⟩') ? word.substring(1) : word;

  const orpIndex = getORPIndex(cleanWord);
  let letterCount = 0;

  for (let i = 0; i < cleanWord.length; i++) {
    if (unicodeLetterRegex.test(cleanWord[i])) {
      if (letterCount === orpIndex) return i
      letterCount++
    }
  }

  return Math.min(orpIndex, cleanWord.length - 1);
}

/**
 * Calculate the display delay for a word based on WPM, punctuation, and line breaks.
 * Words ending with sentence punctuation or line breaks get a longer pause.
 *
 * @param {string} word - The word to calculate delay for (may include '\n' marker)
 * @param {number} wordsPerMinute - Reading speed in WPM
 * @param {boolean} pauseOnPunctuation - Whether to add extra pause on punctuation
 * @param {number} punctuationMultiplier - Multiplier for sentence-ending punctuation
 * @param {number} wordLengthWPMMultiplier - Percentage increase per character for long words
 * @param {number} lineBreakMultiplier - Multiplier for line breaks
 * @returns {number} Delay in milliseconds
 */
export function getWordDelay(
  word,
  wordsPerMinute,
  pauseOnPunctuation = true,
  punctuationMultiplier = 2,
  wordLengthWPMMultiplier = 0,
  lineBreakMultiplier = 3,
) {
  if (!word || typeof word !== "string") return 60000 / wordsPerMinute;
  if (!wordsPerMinute || wordsPerMinute <= 0) return 200; // Default fallback

  var baseDelay = 60000 / wordsPerMinute;

  // Check if this is a line break marker (blank pause)
  if (word === '\n') {
    return baseDelay * lineBreakMultiplier;
  }

  // Check if this is the first word after a line break (marked with ⟩)
  const isFirstAfterBreak = word.startsWith('⟩');
  const cleanWord = isFirstAfterBreak ? word.substring(1) : word;

  // Extra time for first word after line break to help reader reorient
  if (isFirstAfterBreak) {
    baseDelay *= 1.5; // 50% longer to help with reorientation
  }

  // Longer pause for long words (12+ characters is roughly 2 standard deviations above average English word length)
  if (wordLengthWPMMultiplier > 0 && cleanWord.length >= 12) {
    // For every character above 12, add wordLengthWPMMultiplier percentage points to delay
    baseDelay *= 1 + ((wordLengthWPMMultiplier / 100) * (cleanWord.length - 12));
  }

  if (pauseOnPunctuation) {
    // Longer pause for sentence-ending punctuation
    if (/[.!?;:]$/.test(cleanWord)) {
      return baseDelay * punctuationMultiplier;
    }
    // Shorter pause for commas
    if (/[,]$/.test(cleanWord)) {
      return baseDelay * 1.5;
    }
  }

  return baseDelay;
}

/**
 * Format remaining reading time as MM:SS
 *
 * @param {number} remainingWords - Number of words remaining
 * @param {number} wordsPerMinute - Reading speed in WPM
 * @returns {string} Formatted time string (e.g., "2:30")
 */
export function formatTimeRemaining(remainingWords, wordsPerMinute) {
  if (remainingWords <= 0 || !wordsPerMinute || wordsPerMinute <= 0) {
    return "0:00";
  }

  const seconds = Math.ceil((remainingWords / wordsPerMinute) * 60);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Split a word into parts for ORP display (before, ORP letter, after)
 *
 * @param {string} word - The word to split
 * @returns {{ before: string, orp: string, after: string }} Word parts
 */
export function splitWordForDisplay(word) {
  if (!word || typeof word !== "string") {
    return { before: "", orp: "", after: "" };
  }

  // Strip first-word-after-break marker if present
  const cleanWord = word.startsWith('⟩') ? word.substring(1) : word;

  const orpIndex = getActualORPIndex(cleanWord);

  return {
    before: cleanWord.slice(0, orpIndex),
    orp: cleanWord[orpIndex] || "",
    after: cleanWord.slice(orpIndex + 1),
  };
}

/**
 * Check if a word should trigger a pause based on pause-every-N-words setting
 *
 * @param {number} wordIndex - Current word index (0-based)
 * @param {number} pauseAfterWords - Pause after every N words (0 = disabled)
 * @returns {boolean} Whether to pause
 */
export function shouldPauseAtWord(wordIndex, pauseAfterWords) {
  if (pauseAfterWords <= 0) return false;
  if (wordIndex <= 0) return false;
  return wordIndex % pauseAfterWords === 0;
}

/**
 * Extract a subset of words centered on current position
 * @param {string[]} allWords - Complete word array
 * @param {number} centerIdx - Index to center on
 * @param {number} frameSize - Total words to display (odd numbers recommended)
 * @returns {{ subset: string[], centerOffset: number }}
 */
export function extractWordFrame(allWords, centerIdx, frameSize) {
  if (frameSize <= 1 || centerIdx >= allWords.length) {
    const word = allWords[centerIdx] || "";
    // Strip first-word-after-break marker for display
    const cleanWord = word.startsWith('⟩') ? word.substring(1) : word;
    return { subset: [cleanWord], centerOffset: 0 };
  }

  const radius = Math.floor(frameSize / 2);
  const leftBound = Math.max(0, centerIdx - radius);
  const rightBound = Math.min(allWords.length, centerIdx + radius + 1);

  // Strip markers from all words in the subset for display
  const subset = allWords.slice(leftBound, rightBound).map(word =>
    word.startsWith('⟩') ? word.substring(1) : word
  );
  const centerOffset = centerIdx - leftBound;

  return { subset, centerOffset };
}
