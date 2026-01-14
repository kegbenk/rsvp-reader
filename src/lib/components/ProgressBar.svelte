<script>
  import { createEventDispatcher } from 'svelte';

  export let progress = 0;
  export let currentWord = 0;
  export let totalWords = 0;
  export let wpm = 300;
  export let timeRemaining = '0:00';
  export let minimal = false;
  export let clickable = false;

  const dispatch = createEventDispatcher();

  function handleClick(event) {
    if (!clickable) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    dispatch('seek', { percentage: Math.max(0, Math.min(100, percentage)) });
  }
</script>

<div class="progress-wrapper" class:minimal>
  <div
    class="progress-container"
    class:clickable
    on:click={handleClick}
  >
    <div class="progress-bar" style="width: {progress}%"></div>
  </div>

  {#if !minimal}
    <div class="stats">
      <span class="stat">{currentWord} / {totalWords}</span>
      <span class="stat wpm">{wpm} WPM</span>
      <span class="stat">{timeRemaining}</span>
    </div>
  {/if}
</div>

<style>
  .progress-wrapper {
    width: 100%;
  }

  .progress-container {
    height: 3px;
    background: #222;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-container.clickable {
    cursor: pointer;
    height: 6px;
    transition: height 0.2s ease;
  }

  .progress-container.clickable:hover {
    height: 10px;
  }

  .minimal .progress-container {
    height: 2px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #ff4444, #ff6666);
    transition: width 0.1s linear;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #555;
  }

  .stat {
    font-family: monospace;
  }

  .wpm {
    color: #ff4444;
  }

  @media (max-width: 600px) {
    .stats {
      font-size: 0.75rem;
      gap: 0.5rem;
    }
  }
</style>
