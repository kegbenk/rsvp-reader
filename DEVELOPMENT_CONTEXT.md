# Development Context - RSVP Reader Enhanced

**Last Updated**: 2026-02-16
**Repository**: https://github.com/kegbenk/rsvp-reader
**Forked From**: https://github.com/thomaskolmans/rsvp-reading (MIT License)

## Project Overview

Enhanced fork of the RSVP Reading web app with major improvements for iOS persistence, dual reading modes, and commercialization readiness.

## Recent Development Session Summary

### Major Features Added

1. **Dual Reading Modes**
   - RSVP mode: Traditional rapid serial visual presentation
   - Reader mode: Traditional book view with word highlighting synced to RSVP
   - Seamless mode switching with keyboard shortcut (M key)
   - Click/tap words in reader mode to jump RSVP position

2. **iOS Persistence System**
   - Auto-save every 10 seconds during playback
   - Save on visibility change, beforeunload, and pagehide events
   - Automatic session restoration on app launch
   - IndexedDB fallback for large EPUB files (>2MB)
   - Platform-specific behavior (iOS vs desktop)

3. **Enhanced EPUB Support**
   - Full table of contents (TOC) extraction and navigation
   - Chapter structure parsing with word boundaries
   - HTML content preservation for reader mode
   - Support for nested TOC hierarchies

4. **UX Improvements**
   - Speed control buttons (+/-) visible during RSVP playback
   - Dynamic font scaling for long words (keeps ORP constant)
   - Rewind button with progressive speed
   - Chapter progress indicator
   - Touch-optimized controls for mobile

5. **New User Experience Fix**
   - Demo text now loads immediately (no empty state delay)
   - Fixed async initialization race condition

## Technical Architecture

### Key Files and Their Purposes

| File | Purpose |
|------|---------|
| `src/App.svelte` | Main application component with state management |
| `src/lib/components/RSVPDisplay.svelte` | RSVP word display with dynamic font scaling |
| `src/lib/components/ReaderDisplay.svelte` | Traditional reader view with word highlighting |
| `src/lib/components/TOCPanel.svelte` | Table of contents navigation panel |
| `src/lib/components/Controls.svelte` | Playback controls |
| `src/lib/epub-structure-parser.js` | Enhanced EPUB parsing with TOC extraction |
| `src/lib/indexed-db-storage.js` | IndexedDB storage for large files |
| `src/lib/progress-storage.js` | Hybrid localStorage/IndexedDB session persistence |
| `src/lib/content-utils.js` | Chapter navigation and scroll utilities |
| `src/lib/rsvp-utils.js` | Core RSVP calculations (ORP, word delay, etc.) |
| `src/lib/file-parsers.js` | File parsing for EPUB and PDF |

### State Management

**Core State Variables** (in App.svelte):
- `text`: Full text content
- `words`: Array of individual words
- `currentWordIndex`: Current reading position
- `readingMode`: 'rsvp' or 'reader'
- `contentStructure`: Chapter/TOC data for EPUBs
- `currentChapterIndex`: Current chapter in reader mode
- `highlightWordIndex`: Word to highlight in reader mode
- `isIOS`: Platform detection for iOS-specific behavior

**Settings State**:
- `wordsPerMinute`: Reading speed (default 300)
- `fadeEnabled`: Word fade animation
- `wordLengthWPMMultiplier`: Extra delay for long words (default 50%)
- `pauseOnPunctuation`: Pause at sentence endings
- `frameWordCount`: Multi-word display mode

### Storage Strategy

1. **localStorage** (default for files <2MB)
   - Fast, synchronous
   - Limited to ~5-10MB depending on browser

2. **IndexedDB** (automatic fallback for files >2MB)
   - Unlimited storage
   - Async operations
   - Better for large EPUBs

**Auto-selection logic** (in progress-storage.js):
- Tries localStorage first
- If QuotaExceededError or file >2MB, switches to IndexedDB
- Sets flag in localStorage to remember preference

### Platform-Specific Behavior

**iOS Detection** (App.svelte:62-67):
```javascript
function detectIOS() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
```

**iOS-Specific Behaviors**:
- Scrolling in reader mode does NOT update RSVP position (prevents getting off track)
- Desktop: Scrolling DOES update RSVP position (better mouse UX)
- Touch-optimized button sizes (min 44px tap targets)

### EPUB Structure

**contentStructure object**:
```javascript
{
  chapters: [
    {
      id: string,
      title: string,
      level: number,           // TOC hierarchy level
      href: string,           // Original EPUB href
      htmlContent: string,    // Rendered HTML for reader mode
      plainText: string,      // Plain text for word counting
      startWordIndex: number, // Global word position
      endWordIndex: number,   // Global word position
      wordCount: number
    }
  ],
  toc: [                      // Flattened TOC for navigation
    {
      id: string,
      title: string,
      level: number,
      chapterIndex: number,
      wordCount: number,
      startWordIndex: number
    }
  ],
  hasStructure: boolean      // Whether TOC exists
}
```

## Known Issues

### 1. Word Click Positioning Bug
**Status**: Documented, not fixed
**File**: `WORD_CLICK_BUG_REPORT.md`

**Symptoms**:
- Clicking a word in reader mode to set RSVP position
- Desktop: RSVP position is ~2 words ahead of clicked word
- iOS: RSVP position is ~50 words ahead of clicked word

**Root Cause**:
- `handleWordClick()` in ReaderDisplay.svelte uses `parseText()` which trims whitespace
- Character offset calculations don't account for leading whitespace in text nodes
- iOS touch precision issues with `document.caretRangeFromPoint()`

**Potential Fix**:
- Use regex `/\S+/g` to find word positions in original text (preserves character offsets)
- Consider finding closest word element instead of character-based calculation for iOS

### 2. Word Highlighting Alignment
**Status**: Partially fixed using occurrence-based matching
**Notes**: Works well but click positioning still has issues (see above)

## Development Notes

### Adding New Features

**To add a new RSVP feature**:
1. Add state variable in App.svelte
2. Add to settings save/load in `saveCurrentSession()` and `loadSavedSession()`
3. Update Settings.svelte UI
4. Implement logic in appropriate component

**To add a new file format**:
1. Add parser to `file-parsers.js`
2. Return `{ text, words?, contentStructure? }`
3. Test with large files to ensure storage works

### Testing Checklist

- [ ] Test on iOS Safari (persistence after backgrounding)
- [ ] Test with large EPUB (>5MB) to verify IndexedDB
- [ ] Test new user experience (clear storage, reload)
- [ ] Test session restoration with valid/corrupted data
- [ ] Test both RSVP and reader modes
- [ ] Test TOC navigation
- [ ] Test word clicking in reader mode
- [ ] Test speed controls during playback
- [ ] Test rewind button (tap vs hold)

### Performance Considerations

**Word Highlighting in Reader Mode**:
- Uses DOM walking to find and highlight words
- Only updates when `highlightWordIndex` changes
- Occurrence-based matching for accuracy
- Can be slow with very large chapters (1000+ words)

**Auto-Save Strategy**:
- Saves every 10 seconds during playback (may be aggressive for large files)
- Consider increasing interval if performance issues
- Could debounce/throttle for better performance

## Commercialization Plan

See `COMMERCIALIZATION_ROADMAP.md` for complete business plan.

**Key Points**:
- MIT license allows commercial use
- Recommended: Capacitor for mobile conversion (95% code reuse)
- Recommended model: Freemium with $19.99/year subscription
- Target: iOS first, then Android
- Marketing: TikTok/Instagram focused

**Technical Path**:
1. Install Capacitor: `npm install @capacitor/core @capacitor/cli`
2. Initialize: `npx cap init "RSVP Reader" "com.yourcompany.rsvpreader"`
3. Add platforms: `npm install @capacitor/ios @capacitor/android`
4. Build and sync: `npm run build && npx cap sync`
5. Open in Xcode/Android Studio: `npx cap open ios/android`

## Code Style and Conventions

- Svelte 3 with reactive statements (`$:`)
- ES6+ JavaScript (no TypeScript)
- Function declarations over arrow functions for top-level functions
- Descriptive variable names
- Console logging for debugging (prefixed with context, e.g., `[RSVP Update]`)

## Dependencies

**Core**:
- Svelte 3.x
- Vite (build tool)
- epubjs (EPUB parsing) - Apache 2.0 license
- pdfjs-dist (PDF parsing) - Apache 2.0 license

**All dependencies are MIT or Apache 2.0 licensed** (commercial-friendly)

## Git Workflow

**Main branch**: `main`
**Remote**: `origin` → https://github.com/kegbenk/rsvp-reader

**Current commit**: `93cad51` - Major enhancements: iOS persistence, dual-mode reader, and UX improvements

## Next Steps / Future Enhancements

1. **Fix word click positioning bug** (see WORD_CLICK_BUG_REPORT.md)
2. **Mobile app conversion**:
   - Set up Capacitor
   - Add iOS safe area handling
   - Add Android back button handling
   - Create app icons and splash screens
3. **Cloud sync**: iCloud/Google Drive integration
4. **Widgets**: Reading progress widget
5. **Voice integration**: Siri/Google Assistant shortcuts
6. **Monetization**:
   - Implement subscription logic
   - Add paywall UI
   - Integrate RevenueCat
   - Add analytics (Mixpanel/Amplitude)
7. **Performance optimizations**:
   - Virtual scrolling for large chapters
   - Web Worker for EPUB parsing
   - Lazy loading of chapter content

## Debugging Tips

**Session persistence issues**:
- Check console for `[Auto-save]` logs every 10 seconds
- Check `[Page hidden]` log when backgrounding
- Verify localStorage vs IndexedDB: Check `rsvp-use-indexeddb` flag in localStorage
- Clear all storage: `localStorage.clear()` + delete IndexedDB in DevTools

**Word highlighting issues**:
- Check `[ReaderDisplay]` console logs for word counting
- Compare `plainText` word count vs DOM word count
- Verify `chapter.plainText` exists and matches expectations

**Platform detection**:
- Check `[Device] iOS detected: true/false` log on mount
- Test iOS-specific behavior: scrolling should NOT update RSVP position

## Contact / Credits

**Original Project**: Thomas Kolmans (MIT License)
**Enhanced Fork**: Brandon Keller (@kegbenk)
**AI Assistance**: Claude Sonnet 4.5 (Anthropic)

---

**For new Claude Code instances**: Read this file first, then review:
1. `UPGRADE_SUMMARY.md` - Technical changes overview
2. `WORD_CLICK_BUG_REPORT.md` - Known issues
3. `COMMERCIALIZATION_ROADMAP.md` - Business plan
4. `src/App.svelte` - Main application logic
