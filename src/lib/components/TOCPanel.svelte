<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let toc = [];
  export let currentChapterIndex = 0;

  const dispatch = createEventDispatcher();
  let tocListEl;
  let lastScrolledChapterIndex = -1;

  function handleTOCClick(item) {
    dispatch('navigate', { chapter: item, index: item.chapterIndex });
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event, item) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTOCClick(item);
    }
  }

  function scrollToActiveChapter() {
    if (!tocListEl) return;

    // Find the active TOC item
    const activeItem = tocListEl.querySelector('.toc-item.active');
    if (activeItem) {
      // Scroll the active item to the center of the visible area
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      lastScrolledChapterIndex = currentChapterIndex;
    }
  }

  // Scroll to active chapter when panel first opens
  onMount(() => {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      scrollToActiveChapter();
    }, 50);
  });

  // Scroll when active chapter changes
  $: if (tocListEl && currentChapterIndex !== lastScrolledChapterIndex) {
    setTimeout(() => {
      scrollToActiveChapter();
    }, 50);
  }
</script>

<div class="toc-panel">
  <div class="panel-header">
    <h3>Table of Contents</h3>
    <button class="close-btn" on:click={handleClose} title="Close (Esc)">
      ✕
    </button>
  </div>

  <div class="toc-list" bind:this={tocListEl}>
    {#if toc.length === 0}
      <p class="no-toc">No table of contents available</p>
    {:else}
      {#each toc as item, i}
        <button
          class="toc-item level-{item.level}"
          class:active={item.chapterIndex === currentChapterIndex}
          on:click={() => handleTOCClick(item)}
          on:keydown={(e) => handleKeydown(e, item)}
          tabindex="0"
        >
          <span class="toc-title">{item.title}</span>
          {#if item.wordCount}
            <span class="toc-words">{item.wordCount.toLocaleString()} words</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .toc-panel {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #222;
    flex-shrink: 0;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #fff;
  }

  .close-btn {
    background: transparent;
    border: 1px solid #333;
    color: #888;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all 0.2s ease;
    line-height: 1;
  }

  .close-btn:hover {
    border-color: #ff4444;
    color: #ff4444;
    background: rgba(255, 68, 68, 0.1);
  }

  .toc-list {
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem;
  }

  .toc-list::-webkit-scrollbar {
    width: 8px;
  }

  .toc-list::-webkit-scrollbar-track {
    background: #0a0a0a;
  }

  .toc-list::-webkit-scrollbar-thumb {
    background: #222;
    border-radius: 4px;
  }

  .toc-list::-webkit-scrollbar-thumb:hover {
    background: #333;
  }

  .toc-item {
    width: 100%;
    background: transparent;
    border: none;
    padding: 0.75rem 1rem;
    text-align: left;
    cursor: pointer;
    color: #ccc;
    font-size: 0.95rem;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .toc-item:hover {
    background: rgba(255, 68, 68, 0.1);
    color: #fff;
    border-left-color: #ff4444;
  }

  .toc-item:focus {
    outline: none;
    background: rgba(255, 68, 68, 0.15);
    border-left-color: #ff4444;
  }

  .toc-item.active {
    background: rgba(255, 68, 68, 0.2);
    color: #fff;
    border-left-color: #ff4444;
    font-weight: 500;
  }

  /* Indentation for nested levels */
  .toc-item.level-1 {
    padding-left: 1rem;
  }

  .toc-item.level-2 {
    padding-left: 2rem;
    font-size: 0.9rem;
  }

  .toc-item.level-3 {
    padding-left: 3rem;
    font-size: 0.85rem;
  }

  .toc-item.level-4 {
    padding-left: 4rem;
    font-size: 0.8rem;
  }

  .toc-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toc-words {
    color: #666;
    font-size: 0.8rem;
    font-family: 'SF Mono', monospace;
    flex-shrink: 0;
  }

  .no-toc {
    padding: 2rem;
    text-align: center;
    color: #555;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .toc-panel {
      width: 95%;
      max-height: 90vh;
    }

    .panel-header {
      padding: 1rem;
    }

    .panel-header h3 {
      font-size: 1.1rem;
    }

    .toc-item {
      padding: 0.6rem 0.8rem;
      font-size: 0.9rem;
    }

    .toc-item.level-2 {
      padding-left: 1.5rem;
    }

    .toc-item.level-3 {
      padding-left: 2rem;
    }

    .toc-item.level-4 {
      padding-left: 2.5rem;
    }

    .toc-words {
      display: none;
    }
  }
</style>
