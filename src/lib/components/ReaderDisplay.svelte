<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { getNextChapterIndex, getPreviousChapterIndex } from '../content-utils.js';

  export let chapter = null;
  export let contentStructure = null;
  export let currentChapterIndex = 0;
  export let scrollPosition = 0;
  export let autoScroll = false;
  export let scrollSpeed = 200; // WPM
  export let highlightWordIndex = null; // Word index to highlight in the chapter

  const dispatch = createEventDispatcher();

  import { parseText } from '../rsvp-utils.js';

  let containerEl;
  let autoScrollIntervalId = null;
  let userScrolled = false;
  let scrollTimeout;
  let processedHTML = '';
  let currentHighlightEl = null;

  /**
   * Process HTML to add highlight marker at target word
   * @param {string} html - Original HTML content
   * @param {number} targetWordIndex - Word index within this chapter (0-based)
   * @returns {string} HTML with highlight marker
   */
  function addHighlightToHTML(html, targetWordIndex) {
    if (!html || targetWordIndex === null || targetWordIndex < 0) {
      return html;
    }

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    let wordCount = 0;
    let found = false;

    // Recursively walk through text nodes and count words
    function walkNodes(node) {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        for (let i = 0; i < words.length; i++) {
          if (wordCount === targetWordIndex) {
            // Found the target word! Wrap it in a highlight span
            const beforeWords = words.slice(0, i);
            const targetWord = words[i];
            const afterWords = words.slice(i + 1);

            // Reconstruct the text with highlight
            const beforeText = beforeWords.join(' ') + (beforeWords.length > 0 ? ' ' : '');
            const afterText = (afterWords.length > 0 ? ' ' : '') + afterWords.join(' ');

            const span = document.createElement('span');
            span.className = 'highlighted-word';
            span.id = 'highlight-target';
            span.textContent = targetWord;

            const parentNode = node.parentNode;
            if (parentNode) {
              // Split the text node
              if (beforeText) {
                parentNode.insertBefore(document.createTextNode(beforeText), node);
              }
              parentNode.insertBefore(span, node);
              if (afterText) {
                parentNode.insertBefore(document.createTextNode(afterText), node);
              }
              parentNode.removeChild(node);
            }

            found = true;
            return;
          }
          wordCount++;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip script, style tags
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          for (let child of Array.from(node.childNodes)) {
            walkNodes(child);
            if (found) return;
          }
        }
      }
    }

    walkNodes(tempDiv);

    return tempDiv.innerHTML;
  }

  // Process HTML when chapter changes (not on every highlight update for performance)
  $: if (chapter && chapter.htmlContent) {
    processedHTML = chapter.htmlContent;
  } else {
    processedHTML = '';
  }

  // Update highlight when highlightWordIndex changes (more efficient)
  $: if (containerEl && highlightWordIndex !== null && chapter && chapter.startWordIndex !== undefined) {
    updateHighlight(highlightWordIndex);
  } else if (containerEl && highlightWordIndex === null) {
    clearHighlight();
  }

  function clearHighlight() {
    if (currentHighlightEl) {
      const textContent = currentHighlightEl.textContent;
      const textNode = document.createTextNode(textContent);
      currentHighlightEl.parentNode?.replaceChild(textNode, currentHighlightEl);
      currentHighlightEl = null;
    }
  }

  function updateHighlight(globalWordIndex) {
    if (!chapter || !containerEl) return;

    // Calculate word index within this chapter
    const chapterWordIndex = globalWordIndex - chapter.startWordIndex;
    if (chapterWordIndex < 0 || chapterWordIndex >= chapter.wordCount) {
      clearHighlight();
      return;
    }

    console.log('[ReaderDisplay] Highlighting word index:', chapterWordIndex, 'of', chapter.wordCount, 'in chapter');

    // Clear previous highlight
    clearHighlight();

    // Find and highlight the new word
    const contentEl = containerEl.querySelector('.chapter-body');
    if (!contentEl) return;

    // Use chapter's plainText to get the exact target word (same source used for word counting)
    if (!chapter.plainText) {
      console.error('[ReaderDisplay] Chapter missing plainText - cannot highlight accurately');
      return;
    }

    // Parse plainText the same way the EPUB parser does
    const plainTextWords = parseText(chapter.plainText);

    // Also parse the actual rendered DOM text
    const domText = contentEl.textContent || '';
    const domTextCleaned = domText.replace(/\s+/g, ' ').trim();
    const domWords = parseText(domTextCleaned);

    console.log('[ReaderDisplay] PlainText has', plainTextWords.length, 'words');
    console.log('[ReaderDisplay] DOM text has', domWords.length, 'words');
    console.log('[ReaderDisplay] Chapter reports', chapter.wordCount, 'words');

    if (chapterWordIndex >= plainTextWords.length) {
      console.warn('[ReaderDisplay] Word index', chapterWordIndex, 'out of range for', plainTextWords.length, 'words');
      return;
    }

    const targetWord = plainTextWords[chapterWordIndex];
    console.log('[ReaderDisplay] Target word from plainText:', targetWord, 'at index', chapterWordIndex);

    // Calculate which occurrence of this word we need
    // Count how many times this word appears BEFORE our target position in plainText
    let occurrenceNeeded = 0;
    for (let i = 0; i < chapterWordIndex; i++) {
      if (plainTextWords[i] === targetWord) {
        occurrenceNeeded++;
      }
    }
    occurrenceNeeded++; // We want the Nth occurrence (1-indexed)

    console.log('[ReaderDisplay] Looking for occurrence #', occurrenceNeeded, 'of word:', targetWord);

    // Now walk DOM to find the Nth occurrence of this word
    let currentOccurrence = 0;
    let found = false;

    function walkNodes(node) {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        for (let i = 0; i < words.length; i++) {
          if (words[i] === targetWord) {
            currentOccurrence++;

            if (currentOccurrence === occurrenceNeeded) {
              // Found the right occurrence!
              console.log('[ReaderDisplay] Found occurrence', currentOccurrence, 'of word:', targetWord);

              // Find word in original text preserving whitespace
              const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              // Find all occurrences in this text node
              const wordPattern = new RegExp(`(^|\\s)(${escapedWord})(\\s|$)`, 'gi');
              let match;
              let matchCount = 0;
              let targetMatch = null;

              // Count how many times target word appears in previous nodes
              const textBeforeNode = contentEl.textContent.substring(0,
                Array.from(contentEl.childNodes).indexOf(node.parentNode) * 1000); // Rough estimate

              while ((match = wordPattern.exec(text)) !== null) {
                matchCount++;
                if (!targetMatch) {
                  // Use first match in this node (since we're walking in order)
                  targetMatch = match;
                  break;
                }
              }

              if (targetMatch) {
                const beforeText = text.substring(0, targetMatch.index + targetMatch[1].length);
                const matchedWord = targetMatch[2];
                const afterText = text.substring(targetMatch.index + targetMatch[1].length + targetMatch[2].length);

                const span = document.createElement('span');
                span.className = 'highlighted-word';
                span.id = 'highlight-target';
                span.textContent = matchedWord;

                const parentNode = node.parentNode;
                if (parentNode) {
                  if (beforeText) {
                    parentNode.insertBefore(document.createTextNode(beforeText), node);
                  }
                  parentNode.insertBefore(span, node);
                  if (afterText) {
                    parentNode.insertBefore(document.createTextNode(afterText), node);
                  }
                  parentNode.removeChild(node);

                  currentHighlightEl = span;
                  console.log('[ReaderDisplay] Successfully highlighted:', matchedWord);
                }
              }

              found = true;
              return;
            }
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          for (let child of Array.from(node.childNodes)) {
            walkNodes(child);
            if (found) return;
          }
        }
      }
    }

    walkNodes(contentEl);

    if (!found) {
      console.warn('[ReaderDisplay] Could not find occurrence', occurrenceNeeded, 'of word:', targetWord);
    }

    if (!found) {
      console.warn('[ReaderDisplay] Could not find word at index', chapterWordIndex);
    }
  }

  // Restore scroll position when chapter changes or scrollPosition prop updates
  $: if (containerEl && scrollPosition !== undefined) {
    const scrollTop = (containerEl.scrollHeight - containerEl.clientHeight) * (scrollPosition / 100);
    containerEl.scrollTop = scrollTop;
  }

  // Handle auto-scroll
  $: if (autoScroll && containerEl) {
    startAutoScroll();
  } else {
    stopAutoScroll();
  }

  function startAutoScroll() {
    if (autoScrollIntervalId) return;

    // Calculate pixels per second based on WPM
    // Assuming ~5 characters per word, ~800px of text per screen
    // This is a rough approximation
    const pixelsPerMinute = scrollSpeed * 8; // Adjust multiplier as needed
    const pixelsPerSecond = pixelsPerMinute / 60;
    const intervalMs = 50; // Update every 50ms for smooth scrolling
    const pixelsPerInterval = (pixelsPerSecond * intervalMs) / 1000;

    autoScrollIntervalId = setInterval(() => {
      if (!containerEl || userScrolled) return;

      const newScrollTop = containerEl.scrollTop + pixelsPerInterval;
      const maxScroll = containerEl.scrollHeight - containerEl.clientHeight;

      if (newScrollTop >= maxScroll) {
        // Reached end of chapter
        stopAutoScroll();
        handleChapterEnd();
      } else {
        containerEl.scrollTop = newScrollTop;
        updateScrollPosition();
      }
    }, intervalMs);
  }

  function stopAutoScroll() {
    if (autoScrollIntervalId) {
      clearInterval(autoScrollIntervalId);
      autoScrollIntervalId = null;
    }
  }

  function handleChapterEnd() {
    if (!contentStructure) return;

    const nextIndex = getNextChapterIndex(contentStructure, currentChapterIndex);

    if (nextIndex !== currentChapterIndex) {
      // Auto-advance to next chapter
      dispatch('chapterChange', { index: nextIndex });
      // Reset scroll to top
      if (containerEl) {
        containerEl.scrollTop = 0;
      }
      // Restart auto-scroll after a brief pause
      setTimeout(() => {
        if (autoScroll) startAutoScroll();
      }, 500);
    }
  }

  function handleScroll() {
    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Mark as user-scrolled (pause auto-scroll)
    if (autoScroll && !autoScrollIntervalId) {
      // If auto-scroll is on but not running, this is user scroll
      userScrolled = true;
    }

    // Reset user scrolled flag after 2 seconds
    scrollTimeout = setTimeout(() => {
      userScrolled = false;
    }, 2000);

    updateScrollPosition();
  }

  function updateScrollPosition() {
    if (!containerEl) return;

    const maxScroll = containerEl.scrollHeight - containerEl.clientHeight;
    const percentage = maxScroll > 0 ? (containerEl.scrollTop / maxScroll) * 100 : 0;

    dispatch('scroll', { percentage });
  }

  function handleWordClick(event) {
    // Only handle clicks on actual text, not on buttons or other UI elements
    if (event.target.closest('.chapter-nav')) return;
    if (event.target.tagName === 'BUTTON') return;

    const contentEl = containerEl?.querySelector('.chapter-body');
    if (!contentEl || !chapter || !chapter.plainText) return;

    // Get the clicked element - if it's the highlighted word, use that directly
    let clickedElement = event.target;
    if (clickedElement.classList && clickedElement.classList.contains('highlighted-word')) {
      // Clicked on already highlighted word - use current highlight index
      if (highlightWordIndex !== null) {
        dispatch('wordClick', { wordIndex: highlightWordIndex });
        return;
      }
    }

    // Get text content up to the click point using caretRangeFromPoint
    // Note: iOS Safari supports this but touch position may differ from visual position
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!range || !range.startContainer) {
      console.warn('[Click] Could not get caret range from click point');
      return;
    }

    // Parse plainText to get total word list for this chapter
    const plainTextWords = parseText(chapter.plainText);

    // Count words from the beginning of chapter to the clicked position
    let wordCount = 0;
    let foundClickPosition = false;

    function walkAndCount(node, targetNode, targetOffset) {
      if (foundClickPosition) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';

        // Split text preserving original positions (don't use parseText which trims)
        // Find all word boundaries in the original text
        const wordMatches = [];
        const wordRegex = /\S+/g;
        let match;
        while ((match = wordRegex.exec(text)) !== null) {
          wordMatches.push({
            word: match[0],
            start: match.index,
            end: match.index + match[0].length
          });
        }

        // Check if this is the clicked text node
        if (node === targetNode) {
          // Find which word contains the click offset
          let wordIndexInNode = 0;
          for (let i = 0; i < wordMatches.length; i++) {
            const m = wordMatches[i];
            // Check if offset is within this word or in whitespace leading to next word
            const nextWordStart = (i + 1 < wordMatches.length) ? wordMatches[i + 1].start : text.length;

            if (targetOffset >= m.start && targetOffset < nextWordStart) {
              // Clicked on or near this word
              wordIndexInNode = i;
              break;
            }

            // If offset is before first word, use first word
            if (i === 0 && targetOffset < m.start) {
              wordIndexInNode = 0;
              break;
            }

            // Default to last word if we got past all of them
            wordIndexInNode = i;
          }

          wordCount += wordIndexInNode;
          foundClickPosition = true;
          return;
        } else {
          // Add all words from this node
          wordCount += wordMatches.length;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          for (let child of Array.from(node.childNodes)) {
            walkAndCount(child, targetNode, targetOffset);
            if (foundClickPosition) return;
          }
        }
      }
    }

    walkAndCount(contentEl, range.startContainer, range.startOffset);

    if (foundClickPosition && wordCount >= 0 && wordCount < plainTextWords.length) {
      // Convert chapter-relative word index to global word index
      const globalWordIndex = chapter.startWordIndex + wordCount;

      // Dispatch event to update RSVP position
      dispatch('wordClick', { wordIndex: globalWordIndex });
    }
  }

  function handlePrevChapter() {
    const prevIndex = getPreviousChapterIndex(currentChapterIndex);
    if (prevIndex !== currentChapterIndex) {
      dispatch('chapterChange', { index: prevIndex });
      // Scroll to top of new chapter
      if (containerEl) {
        containerEl.scrollTop = 0;
      }
    }
  }

  function handleNextChapter() {
    if (!contentStructure) return;

    const nextIndex = getNextChapterIndex(contentStructure, currentChapterIndex);
    if (nextIndex !== currentChapterIndex) {
      dispatch('chapterChange', { index: nextIndex });
      // Scroll to top of new chapter
      if (containerEl) {
        containerEl.scrollTop = 0;
      }
    }
  }

  onMount(() => {
    return () => {
      stopAutoScroll();
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  });
</script>

<div class="reader-container">
  <div
    class="reader-content"
    bind:this={containerEl}
    on:scroll={handleScroll}
    on:click={handleWordClick}
  >
    {#if chapter}
      <div class="chapter-header">
        <h2 class="chapter-title">{chapter.title}</h2>
      </div>

      <div class="chapter-body">
        {@html processedHTML}
      </div>
    {:else}
      <div class="no-content">
        <p>No content loaded</p>
      </div>
    {/if}
  </div>

  <!-- Chapter navigation buttons -->
  {#if contentStructure && contentStructure.chapters.length > 1}
    <div class="chapter-nav">
      <button
        class="nav-btn prev"
        on:click={handlePrevChapter}
        disabled={currentChapterIndex === 0}
        title="Previous Chapter"
      >
        ← Prev
      </button>

      <span class="chapter-indicator">
        {currentChapterIndex + 1} / {contentStructure.chapters.length}
      </span>

      <button
        class="nav-btn next"
        on:click={handleNextChapter}
        disabled={currentChapterIndex === contentStructure.chapters.length - 1}
        title="Next Chapter"
      >
        Next →
      </button>
    </div>
  {/if}
</div>

<style>
  .reader-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #000;
  }

  .reader-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 1.1rem;
    line-height: 1.7;
    color: #fff;
    cursor: text;
  }

  .reader-content::-webkit-scrollbar {
    width: 8px;
  }

  .reader-content::-webkit-scrollbar-track {
    background: #111;
  }

  .reader-content::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 4px;
  }

  .reader-content::-webkit-scrollbar-thumb:hover {
    background: #444;
  }

  .chapter-header {
    max-width: 700px;
    margin: 0 auto 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #222;
  }

  .chapter-title {
    font-size: 1.8rem;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .chapter-body {
    max-width: 700px;
    margin: 0 auto;
  }

  /* Override EPUB styles to match dark theme */
  .chapter-body :global(p) {
    margin: 0 0 1rem;
    color: #fff;
  }

  .chapter-body :global(h1),
  .chapter-body :global(h2),
  .chapter-body :global(h3),
  .chapter-body :global(h4),
  .chapter-body :global(h5),
  .chapter-body :global(h6) {
    color: #fff;
    margin: 1.5rem 0 1rem;
    font-weight: 600;
  }

  .chapter-body :global(h1) { font-size: 2rem; }
  .chapter-body :global(h2) { font-size: 1.6rem; }
  .chapter-body :global(h3) { font-size: 1.3rem; }
  .chapter-body :global(h4) { font-size: 1.1rem; }

  .chapter-body :global(a) {
    color: #ff4444;
    text-decoration: none;
  }

  .chapter-body :global(a:hover) {
    text-decoration: underline;
  }

  .chapter-body :global(em),
  .chapter-body :global(i) {
    font-style: italic;
    color: #fff;
  }

  .chapter-body :global(strong),
  .chapter-body :global(b) {
    font-weight: 600;
    color: #fff;
  }

  .chapter-body :global(ul),
  .chapter-body :global(ol) {
    margin: 0 0 1rem;
    padding-left: 2rem;
    color: #fff;
  }

  .chapter-body :global(li) {
    margin: 0.5rem 0;
  }

  .chapter-body :global(blockquote) {
    margin: 1rem 0;
    padding: 1rem;
    border-left: 3px solid #ff4444;
    background: #111;
    color: #ccc;
  }

  .chapter-body :global(code) {
    font-family: 'SF Mono', monospace;
    background: #111;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    color: #ff4444;
  }

  .chapter-body :global(pre) {
    background: #111;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    margin: 1rem 0;
  }

  .chapter-body :global(pre code) {
    padding: 0;
    background: none;
  }

  .chapter-body :global(img) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem auto;
  }

  /* Force override any EPUB styles that conflict */
  .chapter-body :global(*) {
    background-color: transparent !important;
  }

  .no-content {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #555;
    font-size: 1.2rem;
  }

  .chapter-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: #111;
    border-top: 1px solid #222;
  }

  .nav-btn {
    background: #333;
    color: #fff;
    border: 1px solid #444;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: #444;
    border-color: #ff4444;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chapter-indicator {
    color: #888;
    font-size: 0.9rem;
    font-family: 'SF Mono', monospace;
  }

  /* Highlighted word from RSVP mode */
  .chapter-body :global(.highlighted-word) {
    background: rgba(255, 68, 68, 0.5);
    padding: 3px 6px;
    border-radius: 4px;
    border: 2px solid rgba(255, 68, 68, 0.9);
    box-shadow: 0 0 12px rgba(255, 68, 68, 0.6),
                inset 0 0 8px rgba(255, 68, 68, 0.3);
    font-weight: 600;
    color: #fff;
    transition: all 0.15s ease-out;
  }

  @media (max-width: 600px) {
    .reader-content {
      padding: 1rem;
      font-size: 1rem;
      line-height: 1.6;
    }

    .chapter-title {
      font-size: 1.4rem;
    }

    .chapter-body {
      max-width: 100%;
    }

    .nav-btn {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }
  }
</style>
