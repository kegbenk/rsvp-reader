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
  let chapterWords = []; // Parsed word array for direct rendering

  // Parse chapter text into words when chapter changes
  $: if (chapter && chapter.plainText) {
    chapterWords = parseText(chapter.plainText);
    console.log('[ReaderDisplay] Parsed', chapterWords.length, 'words from chapter plainText');
  } else {
    chapterWords = [];
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

    // Check if clicked element is a word span with data-index
    const wordSpan = event.target.closest('[data-word-index]');
    if (wordSpan) {
      const globalWordIndex = parseInt(wordSpan.getAttribute('data-word-index'), 10);
      if (!isNaN(globalWordIndex)) {
        console.log('[ReaderDisplay] Clicked word at index:', globalWordIndex);
        dispatch('wordClick', { wordIndex: globalWordIndex });
      }
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
        {#each chapterWords as word, i}
          {#if word === '\n'}
            <!-- Paragraph break marker -->
            <br/><br/>
          {:else}
            <span
              class="word"
              class:highlighted-word={chapter.startWordIndex + i === highlightWordIndex}
              data-word-index={chapter.startWordIndex + i}
            >{word.replace('⟩', '')}</span>{' '}
          {/if}
        {/each}
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

  /* Individual word spans */
  .chapter-body .word {
    cursor: pointer;
    display: inline;
    transition: background 0.1s ease;
  }

  .chapter-body .word:hover {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
  }

  /* Highlighted word from RSVP mode */
  .chapter-body .highlighted-word {
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
