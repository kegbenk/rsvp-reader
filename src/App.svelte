<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    parseText as parseTextUtil,
    getWordDelay as getWordDelayUtil,
    formatTimeRemaining,
    shouldPauseAtWord
  } from './lib/rsvp-utils.js';
  import { parseFile } from './lib/file-parsers.js';
  import {
    saveSession,
    loadSession,
    clearSession,
    hasSession
  } from './lib/progress-storage.js';
  import {
    getChapterAtWordIndex,
    getWordIndexFromScroll,
    getScrollPercentageInChapter
  } from './lib/content-utils.js';
  import RSVPDisplay from './lib/components/RSVPDisplay.svelte';
  import ReaderDisplay from './lib/components/ReaderDisplay.svelte';
  import TOCPanel from './lib/components/TOCPanel.svelte';
  import Controls from './lib/components/Controls.svelte';
  import Settings from './lib/components/Settings.svelte';
  import TextInput from './lib/components/TextInput.svelte';
  import ProgressBar from './lib/components/ProgressBar.svelte';
  import { extractWordFrame } from './lib/rsvp-utils.js';

  // Demo text constant
  const DEMO_TEXT = `Rapid serial visual presentation (RSVP) is a scientific method for studying the timing of vision. In RSVP, a sequence of stimuli is shown to an observer at one location in their visual field. This technique has been adapted for speed reading applications, where words are displayed one at a time at a fixed point, eliminating the need for eye movements and potentially increasing reading speed significantly.`;

  // State
  let frameWordCount = 1;
  let text = DEMO_TEXT;
  let words = parseTextUtil(text); // Parse demo text immediately for new users
  let currentWordIndex = 0;
  let isPlaying = false;
  let isPaused = false;
  let showSettings = false;
  let showTextInput = false;
  let textInputValue = ''; // Separate variable for text input modal (don't load entire book into textarea)
  let progress = 0;
  let isLoadingFile = false;
  let loadingMessage = '';
  let showJumpTo = false;
  let jumpToValue = '';

  // Dual-mode state
  let readingMode = 'rsvp'; // 'rsvp' | 'reader'
  let contentStructure = null;
  let currentChapterIndex = 0;
  let readerScrollPosition = 0; // Percentage (0-100)
  let showTOC = false;

  // Reader mode auto-scroll
  let readerAutoScroll = false;
  let readerScrollIntervalId = null;

  // Word highlight in reader mode (synced with RSVP position)
  let highlightWordIndex = null;

  // Device detection for platform-specific behavior
  let isIOS = false;

  function detectIOS() {
    // Check if iOS (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad on iOS 13+
  }

  // Rewind button state
  let isRewinding = false;
  let rewindIntervalId = null;
  let rewindStartTime = 0;
  let rewindHoldTimeout = null;

  // Settings
  let wordsPerMinute = 300;
  let fadeEnabled = true;
  let fadeDuration = 150;
  let pauseAfterWords = 0;
  let pauseDuration = 500;
  let pauseOnPunctuation = true;
  let punctuationPauseMultiplier = 2;
  let lineBreakPauseMultiplier = 3;
  let wordLengthWPMMultiplier = 50;
  let showImagesInRSVP = true;
  let imageDurationSeconds = 3;
  let chapterProgressDisplayMode = 'timer'; // 'timer' or 'percentage'

  // Animation
  let wordOpacity = 1;
  let intervalId = null;
  let fadeTimeoutId = null;
  let autoSaveIntervalId = null;

  // Image display
  let currentImage = null;
  let isShowingImage = false;

  // Derived state
  $: currentWord = (() => {
    const word = words[currentWordIndex - 1] || (words.length > 0 ? words[0] : '');
    // Strip the first-word-after-break marker (⟩) if present
    return word.startsWith('⟩') ? word.substring(1) : word;
  })();
  $: wordFrame = extractWordFrame(words, Math.max(0, currentWordIndex - 1), frameWordCount);
  $: timeRemaining = formatTimeRemaining(words.length - currentWordIndex, wordsPerMinute);
  $: isFocusMode = isPlaying || isPaused;

  // Chapter progress calculation
  $: chapterProgress = (() => {
    if (!contentStructure || !contentStructure.chapters.length) return 0;
    const chapter = contentStructure.chapters[currentChapterIndex];
    if (!chapter) return 0;
    const chapterWordCount = chapter.endWordIndex - chapter.startWordIndex;
    if (chapterWordCount === 0) return 0;
    const wordOffset = currentWordIndex - chapter.startWordIndex;
    return Math.min(100, Math.max(0, (wordOffset / chapterWordCount) * 100));
  })();

  // Chapter time remaining
  $: chapterTimeRemaining = (() => {
    if (!contentStructure || !contentStructure.chapters.length) return "0:00";
    const chapter = contentStructure.chapters[currentChapterIndex];
    if (!chapter) return "0:00";
    const wordsRemainingInChapter = chapter.endWordIndex - currentWordIndex;
    return formatTimeRemaining(wordsRemainingInChapter, wordsPerMinute);
  })();

  function parseText() {
    words = parseTextUtil(text);
    currentWordIndex = 0;
    progress = 0;
  }

  function getWordDelay(word) {
    return getWordDelayUtil(word, wordsPerMinute, pauseOnPunctuation, punctuationPauseMultiplier, wordLengthWPMMultiplier, lineBreakPauseMultiplier);
  }

  function showNextWord() {
    if (currentWordIndex >= words.length) {
      stop();
      return;
    }

    // Check if there's an image at this position (if images enabled in RSVP)
    if (showImagesInRSVP && contentStructure?.images) {
      const imageAtPosition = contentStructure.images.find(
        img => img.wordPosition === currentWordIndex
      );

      if (imageAtPosition) {
        showImage(imageAtPosition);
        return; // Will resume after image display
      }
    }

    if (shouldPauseAtWord(currentWordIndex, pauseAfterWords)) {
      isPaused = true;
      setTimeout(() => {
        if (isPlaying) {
          isPaused = false;
          scheduleNextWord();
        }
      }, pauseDuration);
      return;
    }

    if (fadeEnabled) {
      wordOpacity = 0;
      fadeTimeoutId = setTimeout(() => {
        wordOpacity = 1;
      }, 10);
    }

    progress = ((currentWordIndex + 1) / words.length) * 100;
    currentWordIndex++;

    // Update highlight in reader mode if needed
    if (readingMode === 'reader' && contentStructure) {
      highlightWordIndex = currentWordIndex;
      // Only log occasionally to avoid spam
      if (currentWordIndex % 50 === 0) {
        console.log('[RSVP Update] Word', currentWordIndex, ':', words[currentWordIndex - 1]);
      }
    }

    scheduleNextWord();
  }

  function showImage(image) {
    // Skip unavailable images (EPUBs don't support image display yet)
    if (image.unavailable) {
      console.log('[showImage] Skipping unavailable EPUB image, continuing playback');
      return;
    }

    currentImage = image;
    isShowingImage = true;
    isPaused = true;

    // Resume after configured duration
    setTimeout(() => {
      if (isPlaying) {
        currentImage = null;
        isShowingImage = false;
        isPaused = false;
        progress = ((currentWordIndex + 1) / words.length) * 100;
        currentWordIndex++;
        scheduleNextWord();
      }
    }, imageDurationSeconds * 1000);
  }

  function scheduleNextWord() {
    if (!isPlaying || currentWordIndex >= words.length) return;
    const word = words[currentWordIndex - 1] || '';
    intervalId = setTimeout(showNextWord, getWordDelay(word));
  }

  function start() {
    if (words.length === 0) parseText();
    if (words.length === 0) return;
    isPlaying = true;
    isPaused = false;
    showSettings = false;
    showTextInput = false;
    showNextWord();
    startAutoSave();
  }

  function pause() {
    isPlaying = false;
    isPaused = true;
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    stopAutoSave();
    // Save when pausing
    saveCurrentSession();
  }

  function resume() {
    if (currentWordIndex < words.length) {
      isPlaying = true;
      isPaused = false;
      scheduleNextWord();
      startAutoSave();
    }
  }

  function stop() {
    isPlaying = false;
    isPaused = false;
    wordOpacity = 1;
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    stopAutoSave();
    // Save one final time when stopping
    saveCurrentSession();
    // Position is preserved - only stop playback
  }

  function restart() {
    // Reset position to beginning
    currentWordIndex = 0;
    progress = 0;
    stop();
    start();
  }

  // Mode switching and reader controls
  function switchReadingMode(newMode) {
    if (newMode === readingMode) return;
    if (!contentStructure && newMode === 'reader') return; // Can't switch to reader without structure

    // Pause any playback
    if (isPlaying) pause();
    if (readerAutoScroll) stopReaderAutoScroll();

    if (readingMode === 'rsvp' && newMode === 'reader') {
      // RSVP → Reader: Map word index to chapter + scroll position
      currentChapterIndex = getChapterAtWordIndex(contentStructure, currentWordIndex);
      const chapter = contentStructure.chapters[currentChapterIndex];
      readerScrollPosition = getScrollPercentageInChapter(chapter, currentWordIndex);

      // Highlight the current word in reader mode
      highlightWordIndex = currentWordIndex;
      console.log('[Mode Switch] RSVP→Reader. Current word:', words[currentWordIndex - 1], 'at index:', currentWordIndex);
      console.log('[Mode Switch] Chapter:', chapter.title, 'Chapter word range:', chapter.startWordIndex, '-', chapter.endWordIndex);
    } else if (readingMode === 'reader' && newMode === 'rsvp') {
      // Keep current RSVP word position when switching modes
      // (scroll position is now decoupled from RSVP head position)
      progress = (currentWordIndex / words.length) * 100;

      // Clear any highlight when switching away
      highlightWordIndex = null;
    }

    readingMode = newMode;

    // Auto-play when switching to RSVP mode
    if (newMode === 'rsvp') {
      start();
    }
  }

  function handleTOCNavigate(event) {
    const { chapter, index } = event.detail;
    currentChapterIndex = index;

    if (readingMode === 'rsvp') {
      // Jump to chapter start in RSVP mode
      currentWordIndex = chapter.startWordIndex;
      progress = (currentWordIndex / words.length) * 100;
    } else {
      // Scroll to top of chapter in reader mode
      readerScrollPosition = 0;
    }

    showTOC = false;
  }

  function handleReaderScroll(event) {
    // Track scroll position for saving/restoring, but don't update RSVP head
    readerScrollPosition = event.detail.percentage;

    // RSVP reader head position is now decoupled from scroll position
    // It only updates via:
    // 1. RSVP playback advancing
    // 2. Clicking/tapping words in reader mode
  }

  function handleReaderChapterChange(event) {
    currentChapterIndex = event.detail.index;
    readerScrollPosition = 0;
    // Save chapter changes immediately
    saveCurrentSession();
  }

  function handleReaderWordClick(event) {
    const clickedWordIndex = event.detail.wordIndex;
    console.log('[App] Word clicked in reader, setting RSVP position to:', clickedWordIndex);

    // Update RSVP position
    currentWordIndex = clickedWordIndex;
    progress = (currentWordIndex / words.length) * 100;

    // Update highlight
    if (readingMode === 'reader') {
      highlightWordIndex = currentWordIndex;
    }
  }

  function startReaderAutoScroll() {
    readerAutoScroll = true;
    isPlaying = true;
    isPaused = false;
    startAutoSave();
  }

  function stopReaderAutoScroll() {
    readerAutoScroll = false;
    if (readerScrollIntervalId) {
      clearInterval(readerScrollIntervalId);
      readerScrollIntervalId = null;
    }
    stopAutoSave();
    saveCurrentSession();
  }

  function toggleReaderAutoScroll() {
    if (readerAutoScroll) {
      stopReaderAutoScroll();
      isPlaying = false;
    } else {
      startReaderAutoScroll();
    }
  }

  // Rewind button functions
  let wasHoldDown = false;

  function startRewind(event) {
    event.preventDefault(); // Prevent iOS touch scrolling

    // Pause playback during rewind
    if (isPlaying) {
      pause();
    }

    if (currentWordIndex === 0) return; // Already at beginning

    isRewinding = true;
    rewindStartTime = Date.now();
    wasHoldDown = false;

    // Single click fallback - go back 1 word if released quickly
    rewindHoldTimeout = setTimeout(() => {
      // User is holding - start progressive rewind
      wasHoldDown = true;
      startProgressiveRewind();
    }, 200);
  }

  function startProgressiveRewind() {
    // Clear single-click timeout
    if (rewindHoldTimeout) {
      clearTimeout(rewindHoldTimeout);
      rewindHoldTimeout = null;
    }

    // Initial rewind step
    rewindByAmount(1);

    // Start interval-based rewind with dynamic speed
    const updateRewindSpeed = () => {
      const elapsed = Date.now() - rewindStartTime;
      const intervalMs = getIntervalForSpeed(elapsed);

      if (rewindIntervalId) {
        clearInterval(rewindIntervalId);
      }

      rewindIntervalId = setInterval(() => {
        rewindByAmount(1);
      }, intervalMs);
    };

    updateRewindSpeed();

    // Update speed every 500ms as user continues holding
    const speedUpdateInterval = setInterval(() => {
      if (!isRewinding) {
        clearInterval(speedUpdateInterval);
        return;
      }
      updateRewindSpeed();
    }, 500);
  }

  function getIntervalForSpeed(elapsed) {
    if (elapsed < 500) return 200;  // 5 words/sec
    if (elapsed < 1000) return 133; // 7.5 words/sec
    return 100;                     // 10 words/sec (max)
  }

  function rewindByAmount(amount) {
    currentWordIndex = Math.max(0, currentWordIndex - amount);
    progress = (currentWordIndex / words.length) * 100;

    // Stop if at beginning
    if (currentWordIndex === 0) {
      stopRewind();
    }
  }

  function stopRewind() {
    // Handle single click (released within 200ms)
    if (rewindHoldTimeout && isRewinding) {
      clearTimeout(rewindHoldTimeout);
      rewindHoldTimeout = null;
      // Quick tap - go back 1 word
      rewindByAmount(1);
      // Single click = stay paused, don't resume
    } else if (wasHoldDown) {
      // Hold-down = always resume playback on release
      resume();
    }

    isRewinding = false;
    wasHoldDown = false;

    // Clear progressive rewind interval
    if (rewindIntervalId) {
      clearInterval(rewindIntervalId);
      rewindIntervalId = null;
    }

    // Clear timeout if still pending
    if (rewindHoldTimeout) {
      clearTimeout(rewindHoldTimeout);
      rewindHoldTimeout = null;
    }
  }

  function handleTextApply(event) {
    text = event.detail.text;
    stop();
    parseText();
    showTextInput = false;
    textInputValue = ''; // Clear the input for next time
  }

  async function handleFileSelect(event) {
    const file = event.detail.file;
    if (!file) return;

    // Stop playback and auto-save FIRST (before setting loading flag)
    if (isPlaying || isPaused) {
      isPlaying = false;
      isPaused = false;
      if (intervalId) {
        clearTimeout(intervalId);
        intervalId = null;
      }
    }
    stopAutoSave();

    isLoadingFile = true;
    loadingMessage = `Loading ${file.name}...`;

    // Clear old session to free memory (don't save - it will be overwritten anyway)
    console.log('[File Load] Clearing old session to free memory...');
    await clearSession();

    try {
      const result = await parseFile(file);

      // Handle structured content (EPUB with TOC) or plain text (PDF)
      if (result.contentStructure) {
        text = result.text;
        words = result.words || parseTextUtil(result.text);
        contentStructure = result.contentStructure;
      } else {
        text = result.text;
        words = parseTextUtil(result.text);
        contentStructure = null;
      }

      // Reset UI state (don't call stop() - it tries to save)
      wordOpacity = 1;
      showTextInput = false;
      loadingMessage = '';
      textInputValue = ''; // Clear text input

      // Initialize positions
      currentWordIndex = 0;
      currentChapterIndex = 0;
      readerScrollPosition = 0;
      progress = 0;

      console.log('[File Load] New content loaded successfully');
    } catch (error) {
      console.error('Error parsing file:', error);
      loadingMessage = `Error: ${error.message}`;
      setTimeout(() => { loadingMessage = ''; }, 3000);
    } finally {
      isLoadingFile = false;
    }
  }

  function saveCurrentSession() {
    if (words.length === 0) return false;

    return saveSession({
      text,
      currentWordIndex,
      totalWords: words.length,
      readingMode,
      currentChapterIndex,
      readerScrollPosition,
      contentStructure,
      settings: {
        wordsPerMinute,
        fadeEnabled,
        fadeDuration,
        pauseOnPunctuation,
        punctuationPauseMultiplier,
        lineBreakPauseMultiplier,
        wordLengthWPMMultiplier,
        pauseAfterWords,
        pauseDuration,
        frameWordCount,
        showImagesInRSVP,
        imageDurationSeconds,
        chapterProgressDisplayMode
      }
    });
  }

  async function loadSavedSession() {
    const session = await loadSession();
    if (!session) return false;

    // Check if this is a minimal session (text was too large to save)
    if (session.textTooLarge) {
      console.warn('Saved session contains position only (text was too large)');
      return false;
    }

    // Validate session has actual content before overwriting demo text
    if (!session.text || session.text.trim().length === 0) {
      console.warn('Saved session has empty text, keeping demo text');
      return false;
    }

    text = session.text;
    words = parseTextUtil(text);

    // Validate parsed words
    if (!words || words.length === 0) {
      console.error('Failed to parse saved session text, keeping demo text');
      // Restore demo text
      text = DEMO_TEXT;
      words = parseTextUtil(text);
      return false;
    }

    currentWordIndex = session.currentWordIndex || 0;
    progress = (currentWordIndex / words.length) * 100;

    // Load dual-mode state
    readingMode = session.readingMode || 'rsvp';
    currentChapterIndex = session.currentChapterIndex || 0;
    readerScrollPosition = session.readerScrollPosition || 0;
    contentStructure = session.contentStructure || null;

    if (session.settings) {
      wordsPerMinute = session.settings.wordsPerMinute ?? wordsPerMinute;
      fadeEnabled = session.settings.fadeEnabled ?? fadeEnabled;
      fadeDuration = session.settings.fadeDuration ?? fadeDuration;
      pauseOnPunctuation = session.settings.pauseOnPunctuation ?? pauseOnPunctuation;
      punctuationPauseMultiplier = session.settings.punctuationPauseMultiplier ?? punctuationPauseMultiplier;
      lineBreakPauseMultiplier = session.settings.lineBreakPauseMultiplier ?? lineBreakPauseMultiplier;
      wordLengthWPMMultiplier = session.settings.wordLengthWPMMultiplier ?? wordLengthWPMMultiplier;
      pauseAfterWords = session.settings.pauseAfterWords ?? pauseAfterWords;
      pauseDuration = session.settings.pauseDuration ?? pauseDuration;
      frameWordCount = session.settings.frameWordCount ?? frameWordCount;
      showImagesInRSVP = session.settings.showImagesInRSVP ?? showImagesInRSVP;
      imageDurationSeconds = session.settings.imageDurationSeconds ?? imageDurationSeconds;
      chapterProgressDisplayMode = session.settings.chapterProgressDisplayMode ?? chapterProgressDisplayMode;
    }

    return true;
  }

  function jumpToWord(value) {
    if (!value || words.length === 0) return;

    let targetIndex;
    const trimmed = value.trim();

    if (trimmed.endsWith('%')) {
      const percent = parseFloat(trimmed.slice(0, -1));
      if (!isNaN(percent)) {
        targetIndex = Math.floor((Math.max(0, Math.min(100, percent)) / 100) * words.length);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        targetIndex = Math.max(0, Math.min(words.length, num));
      }
    }

    if (targetIndex !== undefined) {
      currentWordIndex = targetIndex;
      progress = (currentWordIndex / words.length) * 100;
    }

    showJumpTo = false;
    jumpToValue = '';
  }

  function handleProgressClick(event) {
    const percentage = event.detail.percentage;
    const targetIndex = Math.floor((percentage / 100) * words.length);
    currentWordIndex = Math.max(0, Math.min(words.length, targetIndex));
    progress = (currentWordIndex / words.length) * 100;
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (readingMode === 'reader') {
          toggleReaderAutoScroll();
        } else {
          if (isPlaying) pause();
          else if (isPaused) resume();
          else start();
        }
        break;
      case 'Escape':
        if (showTOC) {
          showTOC = false;
        } else if (showJumpTo) {
          showJumpTo = false;
          jumpToValue = '';
        } else if (showSettings || showTextInput) {
          showSettings = false;
          showTextInput = false;
        } else if (isPlaying || isPaused || readerAutoScroll) {
          // Exit focus mode but preserve position
          isPlaying = false;
          isPaused = false;
          readerAutoScroll = false;
          if (intervalId) {
            clearTimeout(intervalId);
            intervalId = null;
          }
        }
        break;
      case 'KeyM':
        if (!isPlaying && contentStructure) {
          e.preventDefault();
          switchReadingMode(readingMode === 'rsvp' ? 'reader' : 'rsvp');
        }
        break;
      case 'KeyT':
        if (!isPlaying && contentStructure?.hasStructure) {
          e.preventDefault();
          showTOC = !showTOC;
          if (showTOC) {
            showSettings = false;
            showTextInput = false;
            showJumpTo = false;
          }
        }
        break;
      case 'KeyG':
        if (!isPlaying && !showSettings && !showTextInput) {
          e.preventDefault();
          showJumpTo = !showJumpTo;
          if (showJumpTo) {
            showTOC = false;
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        wordsPerMinute = Math.min(1000, wordsPerMinute + 25);
        break;
      case 'ArrowDown':
        e.preventDefault();
        wordsPerMinute = Math.max(50, wordsPerMinute - 25);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (currentWordIndex > 1) {
          currentWordIndex = Math.max(0, currentWordIndex - 2);
          progress = (currentWordIndex / words.length) * 100;
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (currentWordIndex < words.length) {
          progress = ((currentWordIndex + 1) / words.length) * 100;
          currentWordIndex++;
        }
        break;
    }
  }

  // Periodic auto-save while reading (every 10 seconds)
  function startAutoSave() {
    // Clear any existing interval
    stopAutoSave();
    // Save immediately
    const saved = saveCurrentSession();
    console.log('[Auto-save started]', saved ? 'Initial save successful' : 'Initial save failed');
    // Then save every 10 seconds while playing
    autoSaveIntervalId = setInterval(() => {
      const saved = saveCurrentSession();
      console.log('[Auto-save]', new Date().toLocaleTimeString(), saved ? 'Success' : 'Failed');
    }, 10000); // 10 seconds
  }

  function stopAutoSave() {
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = null;
    }
  }

  // Auto-save handlers for iOS backgrounding
  function handleVisibilityChange() {
    if (document.hidden) {
      // Page is being hidden (user switched apps, locked screen, etc.)
      console.log('[Page hidden] Saving session...');
      const saved = saveCurrentSession();
      console.log('[Page hidden] Save result:', saved);
      stopAutoSave();
    } else {
      // Page is becoming visible again
      console.log('[Page visible] Checking for session...');
      if (isPlaying && !isPaused) {
        startAutoSave();
      }
    }
  }

  function handleBeforeUnload() {
    // Page is being unloaded
    saveCurrentSession();
    stopAutoSave();
  }

  function handlePageHide() {
    // iOS Safari specific - page is being hidden
    saveCurrentSession();
    stopAutoSave();
  }

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);

    // Auto-save event listeners for iOS backgrounding/app switching
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Detect device
    isIOS = detectIOS();
    console.log('[Device] iOS detected:', isIOS);

    // Debug: Log mount time and check for saved session
    console.log('[App Mount]', new Date().toLocaleTimeString());
    console.log('[localStorage available]', typeof(Storage) !== 'undefined');
    console.log('[IndexedDB available]', typeof(indexedDB) !== 'undefined');

    // Demo text is already loaded and ready for immediate use
    // Now check for saved session and load it if available (will overwrite demo text)
    const sessionExists = await hasSession();
    if (sessionExists) {
      console.log('[Found saved session] Attempting to load...');
      const loaded = await loadSavedSession();
      if (loaded) {
        console.log('[Session loaded successfully]');
      } else {
        console.warn('[Session load failed] Demo text already available');
        // Demo text is already loaded, no need to call parseText() again
      }
    } else {
      console.log('[No saved session] Demo text already loaded');
      // Demo text is already loaded, ready to use
    }
  });

  onDestroy(() => {
    if (intervalId) clearTimeout(intervalId);
    if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
    if (rewindIntervalId) clearInterval(rewindIntervalId);
    if (rewindHoldTimeout) clearTimeout(rewindHoldTimeout);
    stopAutoSave();
    window.removeEventListener('keydown', handleKeydown);

    // Remove auto-save listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
  });
</script>

<main class:focus-mode={isFocusMode}>
  <!-- Header - hidden during focus mode -->
  {#if !isFocusMode}
    <header>
      <h1>RSVP Reader</h1>
      <div class="header-actions">
        <!-- Mode toggle button (only if structured content) -->
        {#if contentStructure}
          <button
            class="icon-btn"
            on:click={() => switchReadingMode(readingMode === 'rsvp' ? 'reader' : 'rsvp')}
            title={readingMode === 'rsvp' ? 'Switch to Reader Mode (M)' : 'Switch to RSVP Mode (M)'}
            class:active={readingMode === 'reader'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
            </svg>
          </button>
        {/if}

        <!-- TOC button (only if TOC exists) -->
        {#if contentStructure?.hasStructure}
          <button
            class="icon-btn"
            on:click={() => { showTOC = !showTOC; showSettings = false; showTextInput = false; showJumpTo = false; }}
            title="Table of Contents (T)"
            class:active={showTOC}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z"/>
            </svg>
          </button>
        {/if}

        <button
          class="icon-btn"
          on:click={() => { showJumpTo = !showJumpTo; showSettings = false; showTextInput = false; showTOC = false; }}
          title="Jump to word (G)"
          class:active={showJumpTo}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
        </button>
        <button
          class="icon-btn"
          on:click={() => { showTextInput = !showTextInput; showSettings = false; showJumpTo = false; showTOC = false; }}
          title="Load Content"
          class:active={showTextInput}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
          </svg>
        </button>
        <button
          class="icon-btn"
          on:click={() => { showSettings = !showSettings; showTextInput = false; showJumpTo = false; showTOC = false; }}
          title="Settings"
          class:active={showSettings}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>
    </header>
  {/if}

  <!-- Panels -->
  {#if showTextInput && !isFocusMode}
    <div class="panel-overlay">
      <TextInput
        text={textInputValue}
        isLoading={isLoadingFile}
        {loadingMessage}
        on:apply={handleTextApply}
        on:fileselect={handleFileSelect}
        on:close={() => { showTextInput = false; textInputValue = ''; }}
      />
    </div>
  {/if}


  {#if showSettings && !isFocusMode}
    <div class="panel-overlay">
      <Settings
        bind:wordsPerMinute
        bind:fadeEnabled
        bind:fadeDuration
        bind:pauseOnPunctuation
        bind:punctuationPauseMultiplier
        bind:lineBreakPauseMultiplier
        bind:wordLengthWPMMultiplier
        bind:pauseAfterWords
        bind:pauseDuration
        bind:frameWordCount
        bind:showImagesInRSVP
        bind:imageDurationSeconds
        bind:chapterProgressDisplayMode
        on:close={() => showSettings = false}
      />
    </div>
  {/if}

  {#if showJumpTo && !isFocusMode}
    <div class="panel-overlay" on:click|self={() => showJumpTo = false} role="presentation">
      <div class="jump-to-panel">
        <h3>Jump to position</h3>
        <p class="jump-hint">Enter word number (e.g., 150) or percentage (e.g., 50%)</p>
        <form on:submit|preventDefault={() => jumpToWord(jumpToValue)}>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            bind:value={jumpToValue}
            placeholder="Word # or %"
            autofocus
          />
          <div class="jump-actions">
            <button type="button" class="secondary" on:click={() => showJumpTo = false}>Cancel</button>
            <button type="submit" class="primary">Go</button>
          </div>
        </form>
        <div class="quick-jumps">
          <button on:click={() => jumpToWord('0')}>Start</button>
          <button on:click={() => jumpToWord('25%')}>25%</button>
          <button on:click={() => jumpToWord('50%')}>50%</button>
          <button on:click={() => jumpToWord('75%')}>75%</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showTOC && contentStructure && !isFocusMode}
    <div class="panel-overlay" on:click|self={() => showTOC = false} role="presentation">
      <TOCPanel
        toc={contentStructure.toc}
        {currentChapterIndex}
        on:navigate={handleTOCNavigate}
        on:close={() => showTOC = false}
      />
    </div>
  {/if}

  <!-- Main Display -->
  <div class="display-area">
    {#if readingMode === 'rsvp'}
      <RSVPDisplay
        word={currentWord}
        wordGroup={wordFrame.subset}
        highlightIndex={wordFrame.centerOffset}
        opacity={wordOpacity}
        {fadeDuration}
        {fadeEnabled}
        multiWordEnabled={frameWordCount > 1}
        {isShowingImage}
        {currentImage}
      />
    {:else if readingMode === 'reader' && contentStructure}
      <ReaderDisplay
        chapter={contentStructure.chapters[currentChapterIndex]}
        {contentStructure}
        {currentChapterIndex}
        scrollPosition={readerScrollPosition}
        autoScroll={readerAutoScroll}
        scrollSpeed={wordsPerMinute}
        {highlightWordIndex}
        on:scroll={handleReaderScroll}
        on:chapterChange={handleReaderChapterChange}
        on:wordClick={handleReaderWordClick}
      />
    {:else}
      <div class="no-content">
        <p>Load an EPUB file to use reader mode</p>
      </div>
    {/if}
  </div>

  <!-- Floating Rewind Button (only in RSVP focus mode) -->
  {#if isFocusMode && readingMode === 'rsvp' && words.length > 0}
    <button
      class="rewind-button"
      class:rewinding={isRewinding}
      on:touchstart={startRewind}
      on:touchend={stopRewind}
      on:touchcancel={stopRewind}
      on:mousedown={startRewind}
      on:mouseup={stopRewind}
      on:mouseleave={stopRewind}
      disabled={currentWordIndex === 0}
      title="Hold to rewind"
      aria-label="Rewind"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
      </svg>
    </button>
  {/if}

  <!-- Speed Control Buttons (only in RSVP focus mode) -->
  {#if isFocusMode && readingMode === 'rsvp'}
    <div class="speed-controls">
      <button
        class="speed-btn"
        on:click={() => wordsPerMinute = Math.max(50, wordsPerMinute - 25)}
        title="Decrease speed"
        aria-label="Decrease speed"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
      <div class="speed-display">
        <span class="speed-value">{wordsPerMinute}</span>
        <span class="speed-label">WPM</span>
      </div>
      <button
        class="speed-btn"
        on:click={() => wordsPerMinute = Math.min(1000, wordsPerMinute + 25)}
        title="Increase speed"
        aria-label="Increase speed"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Floating Mode Toggle Button (only when content structure exists) -->
  {#if contentStructure && (isFocusMode || readingMode === 'reader')}
    <button
      class="mode-toggle-button"
      on:click={() => switchReadingMode(readingMode === 'rsvp' ? 'reader' : 'rsvp')}
      title={readingMode === 'rsvp' ? 'Switch to Reader Mode' : 'Switch to RSVP Mode'}
      aria-label={readingMode === 'rsvp' ? 'Switch to Reader Mode' : 'Switch to RSVP Mode'}
    >
      {#if readingMode === 'rsvp'}
        <!-- Book icon for switching to reader mode -->
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
        </svg>
      {:else}
        <!-- Eye/RSVP icon for switching to RSVP mode -->
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      {/if}
    </button>
  {/if}

  <!-- Chapter Progress Bar (only when chapter structure exists) -->
  {#if isFocusMode && contentStructure && contentStructure.chapters.length > 0}
    <div class="chapter-progress-container">
      <div class="chapter-progress-info">
        <span class="chapter-title">{contentStructure.chapters[currentChapterIndex]?.title || 'Chapter'}</span>
        <span class="chapter-time-remaining">
          {chapterProgressDisplayMode === 'timer' ? chapterTimeRemaining : `${Math.round(chapterProgress)}%`}
        </span>
      </div>
      <div class="chapter-progress-bar">
        <div class="chapter-progress-fill" style="width: {chapterProgress}%"></div>
      </div>
    </div>
  {/if}

  <!-- Bottom Bar -->
  <div class="bottom-bar" class:minimal={isFocusMode}>
    <ProgressBar
      {progress}
      currentWord={currentWordIndex}
      totalWords={words.length}
      wpm={wordsPerMinute}
      {timeRemaining}
      minimal={isFocusMode}
      clickable={!isPlaying}
      on:seek={handleProgressClick}
    />

    <div class="controls-area">
      <Controls
        {isPlaying}
        {isPaused}
        canPlay={words.length > 0}
        minimal={isFocusMode}
        showRestart={readingMode === 'rsvp'}
        on:play={readingMode === 'reader' ? toggleReaderAutoScroll : start}
        on:pause={readingMode === 'reader' ? toggleReaderAutoScroll : pause}
        on:resume={readingMode === 'reader' ? toggleReaderAutoScroll : resume}
        on:stop={stop}
        on:restart={restart}
      />
    </div>

    {#if !isFocusMode}
      <div class="shortcuts desktop-only">
        <kbd>Space</kbd> {readingMode === 'reader' ? 'Scroll' : 'Play'}
        <kbd>Esc</kbd> Exit
        {#if readingMode === 'rsvp'}
          <kbd>↑↓</kbd> Speed
          <kbd>←→</kbd> Skip
        {/if}
        {#if contentStructure}
          <kbd>M</kbd> Mode
        {/if}
        {#if contentStructure?.hasStructure}
          <kbd>T</kbd> TOC
        {/if}
        <kbd>G</kbd> Jump
      </div>
      <div class="touch-controls mobile-only">
        <button class="touch-btn" on:click={() => currentWordIndex = Math.max(0, currentWordIndex - 5)} title="Back 5 words">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <button class="touch-btn" on:click={() => wordsPerMinute = Math.max(50, wordsPerMinute - 50)} title="Slower">
          <span>−WPM</span>
        </button>
        <span class="wpm-display">{wordsPerMinute}</span>
        <button class="touch-btn" on:click={() => wordsPerMinute = Math.min(1000, wordsPerMinute + 50)} title="Faster">
          <span>+WPM</span>
        </button>
        <button class="touch-btn" on:click={() => currentWordIndex = Math.min(words.length, currentWordIndex + 5)} title="Forward 5 words">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      </div>
    {/if}
  </div>
</main>

<style>
  :global(body) {
    background-color: #000 !important;
    margin: 0;
    padding: 0;
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
  }

  main {
    height: 100vh;
    height: 100dvh; /* Dynamic viewport height for mobile */
    display: flex;
    flex-direction: column;
    background-color: #000;
    color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 2rem;
    box-sizing: border-box;
    transition: padding 0.3s ease;
    overflow: hidden;
  }

  main.focus-mode {
    padding: 1rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-shrink: 0;
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 400;
    color: #555;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .icon-btn {
    background: transparent;
    border: 1px solid #333;
    color: #555;
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    border-color: #555;
    color: #fff;
  }

  .icon-btn.active {
    border-color: #ff4444;
    color: #ff4444;
  }

  .icon-btn svg {
    width: 20px;
    height: 20px;
  }

  .panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 2rem;
  }

  .display-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
  }

  .bottom-bar {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 1rem;
    transition: all 0.3s ease;
  }

  .bottom-bar.minimal {
    gap: 0.5rem;
    padding-top: 0.5rem;
  }

  .controls-area {
    display: flex;
    justify-content: center;
  }

  .shortcuts {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    color: #444;
    font-size: 0.8rem;
  }

  kbd {
    background: #1a1a1a;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    font-family: monospace;
    color: #666;
    margin-right: 0.25rem;
  }

  /* Touch controls for mobile */
  .touch-controls {
    display: none;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .touch-btn {
    background: #1a1a1a;
    border: 1px solid #333;
    color: #888;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .touch-btn:active {
    background: #333;
    color: #fff;
  }

  .touch-btn svg {
    width: 20px;
    height: 20px;
  }

  .wpm-display {
    color: #ff4444;
    font-family: monospace;
    font-size: 0.85rem;
    min-width: 3rem;
    text-align: center;
  }

  .mobile-only {
    display: none;
  }

  .desktop-only {
    display: flex;
  }

  /* Mobile styles */
  @media (max-width: 600px) {
    main {
      padding: 1rem;
    }

    main.focus-mode {
      padding: 0.5rem;
    }

    .panel-overlay {
      padding: 1rem;
    }

    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: flex;
    }
  }

  /* Jump to panel */
  .jump-to-panel {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 320px;
    width: 100%;
  }

  .jump-to-panel h3 {
    margin: 0 0 0.5rem 0;
    color: #fff;
    font-size: 1.1rem;
  }

  .jump-hint {
    color: #666;
    font-size: 0.85rem;
    margin: 0 0 1rem 0;
  }

  .jump-to-panel input {
    width: 100%;
    padding: 0.75rem;
    background: #111;
    border: 1px solid #333;
    border-radius: 6px;
    color: #fff;
    font-size: 1rem;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }

  .jump-to-panel input:focus {
    outline: none;
    border-color: #ff4444;
  }

  .jump-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .jump-actions button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .jump-actions button.primary {
    background: #ff4444;
    color: #fff;
  }

  .jump-actions button.primary:hover {
    background: #ff6666;
  }

  .jump-actions button.secondary {
    background: #333;
    color: #fff;
  }

  .jump-actions button.secondary:hover {
    background: #444;
  }

  .quick-jumps {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #333;
  }

  .quick-jumps button {
    flex: 1;
    padding: 0.5rem;
    background: #222;
    border: 1px solid #333;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
  }

  .quick-jumps button:hover {
    background: #333;
    color: #fff;
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .no-content {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #555;
    font-size: 1.2rem;
  }

  /* Rewind Button */
  .rewind-button {
    position: fixed;
    left: 2rem;
    top: 70%;
    transform: translateY(-50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(26, 26, 26, 0.9);
    border: 2px solid #333;
    color: #fff;
    cursor: pointer;
    z-index: 50;
    transition: all 0.2s ease;
    opacity: 0.7;
    touch-action: manipulation; /* Prevent iOS double-tap zoom */
    -webkit-tap-highlight-color: transparent; /* Remove iOS tap highlight */
    -webkit-user-select: none; /* Prevent text selection */
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rewind-button:hover:not(:disabled) {
    opacity: 1;
    border-color: #ff4444;
  }

  .rewind-button.rewinding {
    opacity: 1;
    border-color: #ff4444;
    animation: rewind-pulse 0.5s ease-in-out infinite;
  }

  @keyframes rewind-pulse {
    0%, 100% {
      transform: translateY(-50%) scale(1);
    }
    50% {
      transform: translateY(-50%) scale(1.1);
    }
  }

  .rewind-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Mobile adjustments */
  @media (max-width: 600px) {
    .rewind-button {
      left: 1rem;
      width: 48px;
      height: 48px;
    }

    .rewind-button svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Speed Controls */
  .speed-controls {
    position: fixed;
    bottom: 8rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(26, 26, 26, 0.95);
    border: 2px solid #333;
    border-radius: 50px;
    padding: 0.5rem 1rem;
    z-index: 50;
    backdrop-filter: blur(10px);
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .speed-controls:hover {
    opacity: 1;
  }

  .speed-btn {
    background: transparent;
    border: 1px solid #333;
    color: #fff;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .speed-btn:hover {
    background: #222;
    border-color: #ff4444;
  }

  .speed-btn:active {
    transform: scale(0.95);
  }

  .speed-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
    padding: 0 0.5rem;
  }

  .speed-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #ff4444;
    font-family: 'SF Mono', 'Monaco', monospace;
    line-height: 1;
  }

  .speed-label {
    font-size: 0.65rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.125rem;
  }

  @media (max-width: 600px) {
    .speed-controls {
      bottom: 7rem;
      padding: 0.375rem 0.75rem;
      gap: 0.5rem;
    }

    .speed-btn {
      width: 32px;
      height: 32px;
    }

    .speed-btn svg {
      width: 18px;
      height: 18px;
    }

    .speed-display {
      min-width: 50px;
      padding: 0 0.25rem;
    }

    .speed-value {
      font-size: 1.1rem;
    }

    .speed-label {
      font-size: 0.6rem;
    }
  }

  /* Mode Toggle Button */
  .mode-toggle-button {
    position: fixed;
    right: 2rem;
    top: 70%;
    transform: translateY(-50%);
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(26, 26, 26, 0.9);
    border: 2px solid #333;
    color: #fff;
    cursor: pointer;
    z-index: 50;
    transition: all 0.2s ease;
    opacity: 0.7;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mode-toggle-button:hover {
    opacity: 1;
    border-color: #ff4444;
  }

  @media (max-width: 600px) {
    .mode-toggle-button {
      right: 1rem;
      width: 48px;
      height: 48px;
    }

    .mode-toggle-button svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Chapter Progress Bar */
  .chapter-progress-container {
    position: fixed;
    top: 1rem;
    right: 2rem;
    width: 250px;
    background: rgba(26, 26, 26, 0.9);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 0.75rem;
    z-index: 50;
    backdrop-filter: blur(10px);
  }

  .chapter-progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 0.5rem;
  }

  .chapter-title {
    font-size: 0.75rem;
    color: #ccc;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .chapter-time-remaining {
    font-size: 0.75rem;
    color: #ff4444;
    font-weight: 600;
    font-family: 'SF Mono', monospace;
    flex-shrink: 0;
  }

  .chapter-progress-bar {
    width: 100%;
    height: 4px;
    background: #333;
    border-radius: 2px;
    overflow: hidden;
  }

  .chapter-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff4444, #ff6666);
    border-radius: 2px;
    transition: width 0.2s ease-out;
  }

  @media (max-width: 600px) {
    .chapter-progress-container {
      top: 1rem;
      right: 1rem;
      width: 200px;
      padding: 0.5rem;
    }

    .chapter-title {
      font-size: 0.7rem;
    }

    .chapter-time-remaining {
      font-size: 0.7rem;
    }
  }
</style>
