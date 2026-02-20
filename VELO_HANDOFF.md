# Velo - Agent Handoff Document

> **For Claude Agents**: This is your primary entry point. Read this document first before exploring the codebase.

## 1. Executive Summary

**App Name**: Velo (formerly RSVP Reader)
**Purpose**: Speed reading app with RSVP (word-by-word) + traditional reader modes
**Target Platform**: Apple ecosystem only (iOS, iPadOS, Mac)
**Business Model**: Subscription via Apple ($19.99/year or $2.99/month)
**Tech Stack**: Svelte 5 + Vite + Capacitor (for native)
**Backend**: AWS-native (Cognito, DynamoDB, Lambda, API Gateway, SES)

**Current State**: Web app is functional with dual reading modes, EPUB/PDF support, and iOS persistence. Needs Capacitor installation, subscription infrastructure, and backend deployment.

---

## 2. Quick Start

### Run Locally
```bash
cd /Users/bkeller/PersonalDev/BOOKTECH/rsvp-reading
npm install
npm run dev          # http://localhost:5173
```

### Run Tests
```bash
npm run test:run     # Single run
npm test             # Watch mode
```

### Build for Production
```bash
npm run build        # Output in /dist
```

### Critical Files to Read First
1. **This document** - Context and priorities
2. `src/App.svelte` (lines 1-120) - State management overview
3. `src/lib/rsvp-utils.js` - Core algorithms
4. `src/lib/progress-storage.js` - Persistence pattern

### Supplementary Documentation
- `DEVELOPMENT_CONTEXT.md` - Deep technical architecture
- `WORD_CLICK_BUG_REPORT.md` - P0 bug details
- `COMMERCIALIZATION_ROADMAP.md` - Business strategy
- `AWS_BACKEND_INFRA.md` - Backend architecture

---

## 3. Finalized Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Native framework | Capacitor | 95% code reuse from Svelte |
| Target platforms | Apple only (iOS, iPadOS, Mac) | Higher LTV, focused launch |
| Android | Not for initial launch | Simplify scope |
| Business model | Subscription | Recurring revenue |
| Pricing | $19.99/year or $2.99/month | Below impulse threshold |
| Auth provider | Sign in with Apple | Privacy, reduced friction |
| Backend | AWS-native | Scalable, no vendor lock-in |
| State management | Svelte reactivity | Already implemented, works well |
| Storage | localStorage + IndexedDB hybrid | Already implemented |

---

## 4. Current App Architecture

### Tech Stack
- **Frontend**: Svelte 5.43.8 (reactive framework)
- **Build**: Vite 7.2.4
- **EPUB parsing**: epubjs 0.3.93 (Apache 2.0)
- **PDF parsing**: pdfjs-dist 5.4.530 (Apache 2.0)
- **Testing**: Vitest + Testing Library

### Component Hierarchy
```
App.svelte (1794 lines - state orchestrator)
├── RSVPDisplay.svelte (258 lines) - Word-by-word with ORP highlighting
├── ReaderDisplay.svelte (480 lines) - Traditional reader (refactored)
├── TOCPanel.svelte (274 lines) - Table of contents navigation
├── Controls.svelte (195 lines) - Play/pause/restart
├── Settings.svelte (600 lines) - WPM, pauses, display options, data management
├── TextInput.svelte (269 lines) - File upload modal
└── ProgressBar.svelte (127 lines) - Seekable progress
```

### State Management Pattern
All state lives in `App.svelte` using Svelte reactive statements (`$:`):
```javascript
// Core state (App.svelte lines 34-90)
let text = '';                    // Full text content
let words = [];                   // Parsed word array
let currentWordIndex = 0;         // Current position
let readingMode = 'rsvp';         // 'rsvp' or 'reader'
let contentStructure = null;      // EPUB chapters/TOC
let isIOS = false;                // Platform detection
```

### Storage Strategy
**Hybrid approach** (see `progress-storage.js`):
1. Try localStorage first (fast, synchronous)
2. Auto-fallback to IndexedDB if file >2MB or QuotaExceeded
3. Flag stored in localStorage: `rsvp-use-indexeddb`

**Auto-save triggers**:
- Every 10 seconds during playback
- On visibility change (app backgrounded)
- On pagehide event (iOS-specific)
- Manual save: Ctrl/Cmd+S

---

## 5. Native Library Upgrade Path (Apple Books-Level Quality)

### Opportunity
Moving to Capacitor enables native EPUB/PDF libraries that far exceed the current JavaScript libraries. This is the path to Apple Books-level reading quality.

### Current JS Libraries - Limitations

| Library | Issues |
|---------|--------|
| **epubjs** | No DRM, images broken, limited CSS, AGPL license (must open-source modifications) |
| **pdfjs-dist** | Text extraction only, no native rendering, poor performance on large files |

### Recommended Native Libraries

#### For PDFs: Apple's PDFKit
**Via**: `@capacitor-community/pdf-viewer` (existing Capacitor plugin)
- Native iOS/Mac framework (free, built-in)
- Apple Books-level rendering
- Full DRM support, search, annotations
- **Effort: 1-2 weeks**

```bash
npm install @capacitor-community/pdf-viewer
```

#### For EPUBs: Two Options

| Library | Quality | DRM | Platform | License | Effort |
|---------|---------|-----|----------|---------|--------|
| **FolioReaderKit** | ★★★★ | No | iOS only | Apache 2.0 | 3-4 weeks |
| **Readium** | ★★★★★ | Yes (Adobe) | iOS + Mac | BSD 3-Clause | 6-8 weeks |

**Recommendation**: Start with FolioReaderKit for faster delivery, consider Readium for Phase 3 if DRM is needed.

### Native Library Roadmap

```
Phase 1 (Weeks 1-2):   Native PDF via PDFKit
                       └─ Use @capacitor-community/pdf-viewer
                       └─ Immediate Apple Books-level PDF quality

Phase 2 (Weeks 3-6):   Native EPUB via FolioReaderKit (iOS)
                       └─ Create Capacitor plugin wrapper
                       └─ Proper typography, images work, fixed-layout support

Phase 3 (Optional):    Full Readium + Adobe DRM
                       └─ Access to 70% of commercial ebook market
                       └─ Mac support
                       └─ 6-8 additional weeks

Web Fallback:          Keep epubjs/pdfjs-dist for browser testing
```

### Implementation Pattern

Create an abstraction layer that routes to native or web:

```javascript
// src/lib/adapters/reader-adapter.js
import { Capacitor } from '@capacitor/core';

export async function createReader(file, options) {
  if (Capacitor.isNativePlatform()) {
    return new NativeReader(file);  // PDFKit or FolioReaderKit
  }
  return new WebReader(file);  // epubjs/pdfjs-dist fallback
}
```

### Licensing Note

**Current epubjs is AGPL** - if you distribute modified code, you must open-source it. Native libraries (Apache 2.0, BSD) avoid this issue entirely. This is another reason to prioritize native libraries for the commercial app.

### Key Resources
- **PDFKit**: https://developer.apple.com/documentation/pdfkit
- **FolioReaderKit**: https://github.com/FolioReader/FolioReaderKit
- **Readium**: https://readium.org/
- **Capacitor PDF Viewer**: https://github.com/capacitor-community/pdf-viewer

---

## 6. Library Integration Strategy

### The Reality: No Direct Access to Major Stores

**Apple Books and Amazon Kindle libraries are not accessible** to third-party apps:

| Platform | Limitation |
|----------|------------|
| **Apple Books** | No public API. FairPlay DRM encrypts all purchased content. Apple considers this a competitive moat. |
| **Amazon Kindle** | Proprietary DRM (AZW/KFX format). No third-party API. Kindle SDK discontinued years ago. |

This is an industry-wide limitation, not a technical gap we can solve.

### What IS Possible

#### 1. iOS Share Extension (Recommended - Launch Feature)
Let users import DRM-free EPUBs/PDFs from anywhere via iOS Share Sheet:

```swift
// Register Velo as handler for UTTypes: epub, pdf
// Users tap Share → Velo from any app (Files, Safari, email)
```

**Implementation**: Create Capacitor plugin that registers Share Extension. This is how Kindle, Kobo, and other readers handle user imports.

#### 2. Files App Integration (Recommended - Launch Feature)
- Register Velo as a document provider
- Users can "Open in Velo" from Files app
- Works seamlessly with iCloud Drive, Dropbox, Google Drive
- Zero friction for users with existing ebook collections

#### 3. Free Ebook Sources (Post-Launch Feature)
Build in-app discovery for legal free ebooks:

| Source | Content | API |
|--------|---------|-----|
| **Project Gutenberg** | 60,000+ public domain classics | Yes (free) |
| **Standard Ebooks** | Curated, beautifully formatted public domain | Yes (free) |
| **Open Library** | archive.org lending library | Yes (free) |

**Implementation**: Add "Discover" tab with curated collections, search, and one-tap download.

#### 4. OPDS Catalog Support (Power User Feature)
Many users run personal Calibre servers with OPDS feeds:

```javascript
// User enters their Calibre server URL
// Velo browses catalog, downloads directly
// Popular with power users who manage large libraries
```

**Implementation**: Add OPDS browser in settings. Standard protocol, well-documented.

#### 5. Public Library Integration (Future Consideration)
- **OverDrive/Libby** - Some libraries offer DRM-free EPUB loans
- Would require partnership or API access
- Lower priority, complex licensing

### Recommended Roadmap

```
Launch:         Share Extension + Files app integration
                └─ Zero friction for existing ebook owners

Post-Launch:    Free ebook discovery (Gutenberg, Standard Ebooks)
                └─ Value-add for new users, good marketing angle

Power Users:    OPDS catalog support
                └─ Calibre users, self-hosters

Future:         Public library partnerships
                └─ Only if significant user demand
```

### Key Insight

Velo's competitive advantage is **how you read**, not **where you get books**. Focus on making RSVP mode exceptional. Users already have ways to acquire ebooks - Velo should integrate seamlessly with their existing workflows via Share Extension and Files app.

---

## 7. Known Issues & Bugs (Pre-Native)

### P0 - Must Fix Before Launch

#### 1. Word Click Positioning Bug - ✅ FULLY FIXED
**File**: `src/lib/components/ReaderDisplay.svelte`

**Status**: ✅ Fixed for both EPUB and PDF (2026-02-20)

**Solution Implemented**: Direct Word Mapping Architecture

The previous approach (DOM tree walking to count words) was replaced with direct rendering where each word is a clickable `<span>` element with its global word index stored as a data attribute:

```svelte
{#each chapterWords as word, i}
  {#if word === '\n'}
    <br/><br/>
  {:else}
    <span
      class="word"
      class:highlighted-word={chapter.startWordIndex + i === highlightWordIndex}
      data-word-index={chapter.startWordIndex + i}
    >{word.replace('⟩', '')}</span>{' '}
  {/if}
{/each}
```

**Key benefits**:
- O(1) word index lookup (was O(n) DOM walk)
- Zero possibility of word count mismatch
- Highlighting via CSS class binding
- ~400 lines of complex DOM walking code removed

**Click handler** is now trivial:
```javascript
function handleWordClick(event) {
  const wordSpan = event.target.closest('[data-word-index]');
  if (wordSpan) {
    const globalWordIndex = parseInt(wordSpan.getAttribute('data-word-index'), 10);
    dispatch('wordClick', { wordIndex: globalWordIndex });
  }
}
```

#### Recent Fixes (Completed)
| Issue | Status | Fix |
|-------|--------|-----|
| Word click positioning (ALL formats) | ✅ Fixed | Direct word mapping architecture in ReaderDisplay.svelte |
| Large PDF stack overflow | ✅ Fixed | Changed spread operator to loop in `parseText():34` (src/lib/rsvp-utils.js) |
| PDF paragraph detection | ✅ Fixed | Smart vertical gap detection (1.5x average line spacing) in `parsePDFWithStructure()` |
| PDF TOC extraction | ✅ Fixed | Extracts outline/bookmarks, auto-creates "Front Matter" chapter for pre-TOC pages |
| Clear cache functionality | ✅ Added | Settings.svelte now has "Clear Cache" button in Data section |

### P1 - Required for Subscription Launch

| Issue | Status | Notes |
|-------|--------|-------|
| Capacitor not installed | Not started | `npm install @capacitor/core @capacitor/cli` |
| iOS safe area handling | Not started | Needs `env(safe-area-inset-*)` CSS |
| RevenueCat/StoreKit integration | Not started | For subscription management |
| Paywall UI | Not designed | Feature gating needed in App.svelte |
| Sign in with Apple | Not started | Backend Cognito integration |

### P2 - Post-Launch Enhancements

| Issue | Notes |
|-------|-------|
| EPUB images not displaying | **Solved by native libraries** (FolioReaderKit/Readium) |
| TOC matching issues | **Solved by native libraries** (proper EPUB3 parsing) |
| Cloud sync | Would require authenticated S3 storage |
| Analytics | Consider Mixpanel, Amplitude, or CloudWatch |
| iPad optimization | Current CSS is responsive but not iPad-specific |

> **Note**: Many P2 issues are automatically resolved by implementing native EPUB/PDF libraries (Section 5).

---

## 8. Client-Side Roadmap

### Phase 1: Stabilization (Weeks 1-2)
1. ~~**Fix word click positioning bug** (P0)~~ ✅ Complete
2. **Install Capacitor**:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Velo" "com.velo.reader"
   npm install @capacitor/ios
   npx cap add ios
   ```
3. **Rename branding** from "RSVP Reader" to "Velo"
4. **iOS safe area handling**:
   ```css
   padding-top: env(safe-area-inset-top);
   padding-bottom: env(safe-area-inset-bottom);
   ```

### Phase 2: Native PDF Reader (Weeks 2-3)
1. Install `@capacitor-community/pdf-viewer`
2. Create reader adapter abstraction (`src/lib/adapters/reader-adapter.js`)
3. Route PDF rendering to native PDFKit on iOS
4. Maintain web fallback for browser testing
5. **Result**: Apple Books-level PDF quality

### Phase 3: Native EPUB Reader (Weeks 4-6)
1. Create Capacitor plugin wrapping FolioReaderKit
2. Implement bridge between RSVP mode and native reader
3. Sync reading position between modes
4. Add native search, bookmarks, annotations
5. **Result**: Apple Books-level EPUB quality, images work

### Phase 4: Native Polish (Week 7)
1. Add haptic feedback (Capacitor Haptics plugin)
2. Verify IndexedDB persistence in native WebView
3. Handle iOS keyboard for search/settings
4. Test with variety of EPUB/PDF files

### Phase 5: Monetization (Weeks 8-9)
1. Install RevenueCat: `npm install @revenuecat/purchases-capacitor`
2. Create paywall UI component
3. Add feature gating in App.svelte (check entitlements)
4. Configure products in App Store Connect
5. Test sandbox purchases

---

## 9. Server-Side Roadmap

### AWS Stack Summary
| Need | AWS Service |
|------|-------------|
| Domain/DNS | Route 53 |
| SSL | ACM (free) |
| Landing page | S3 + CloudFront |
| Auth | Cognito |
| User database | DynamoDB |
| API | API Gateway + Lambda |
| Email | SES |

### Phase 1: Foundation
1. **Cognito User Pool**:
   - Configure Sign in with Apple as identity provider
   - Set up user pool with email attribute

2. **DynamoDB User Table**:
   ```
   user_id (PK)
   email
   created_at
   entitlements: ["velo_pro"]
   subscription_source: "apple" | "web"
   subscription_expires_at
   ```

3. **API Gateway + Lambda**:
   - POST /auth/apple - Handle Sign in with Apple token
   - GET /user/profile - Get user entitlements
   - POST /subscription/verify - Verify Apple receipt

### Phase 2: Authentication Flow
1. App calls Sign in with Apple → gets identity token
2. Send token to backend → verify with Apple
3. Create/update user in DynamoDB
4. Return JWT for subsequent requests

### Phase 3: Marketing Infrastructure
1. **Landing Page**: Static site on S3 + CloudFront
2. **Waitlist**: API Gateway + Lambda + DynamoDB table
3. **Email**: SES for welcome emails, beta invites

---

## 10. Code Patterns to Reuse

### Adding New Settings
```javascript
// 1. Add state variable (App.svelte ~line 80-91)
let newSetting = defaultValue;

// 2. Add to saveCurrentSession() settings object (~line 566-580)
settings: {
  ...existing,
  newSetting
}

// 3. Add to loadSavedSession() restoration (~line 622-635)
newSetting = session.settings.newSetting ?? newSetting;

// 4. Bind in Settings component usage (~line 943-956)
<Settings bind:newSetting ... />

// 5. Add UI in Settings.svelte
```

### Adding New File Format
```javascript
// In file-parsers.js:

// 1. Create parser function
export async function parseNewFormat(file) {
  // Parse file...
  return {
    text: extractedText,
    contentStructure: null  // or chapter data if applicable
  };
}

// 2. Add to parseFile() (~line 105-118)
if (fileName.endsWith('.newext')) {
  return await parseNewFormat(file);
}
```

### Platform Detection
```javascript
// In App.svelte (lines 64-71)
function detectIOS() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Usage: if (isIOS) { /* iOS-specific behavior */ }
```

---

## 11. Testing Checklist

Before each major change, verify:
- [ ] iOS Safari persistence after backgrounding (10+ seconds)
- [ ] Large EPUB (>5MB) loads via IndexedDB
- [ ] New user experience (clear storage, reload)
- [ ] Session restoration with existing save
- [ ] Both RSVP and reader modes work
- [ ] TOC navigation in structured EPUBs
- [ ] Speed controls (+/-) during playback
- [ ] Rewind button (tap = 1 word, hold = progressive)
- [ ] Line break pauses working
- [ ] Settings persist across sessions

---

## 12. Key File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.svelte` | 1794 | Main app state, mode switching, auto-save |
| `src/lib/components/ReaderDisplay.svelte` | 480 | Traditional reader with direct word mapping |
| `src/lib/components/RSVPDisplay.svelte` | 258 | Word-by-word display with ORP |
| `src/lib/components/Settings.svelte` | 600 | All user settings UI + data management |
| `src/lib/components/TOCPanel.svelte` | 274 | Table of contents navigation |
| `src/lib/rsvp-utils.js` | 249 | ORP calculation, word delay, parsing |
| `src/lib/epub-structure-parser.js` | 441 | EPUB TOC + chapter extraction |
| `src/lib/progress-storage.js` | 232 | Hybrid localStorage/IndexedDB persistence |
| `src/lib/indexed-db-storage.js` | 221 | IndexedDB wrapper |
| `src/lib/content-utils.js` | 92 | Chapter/word index mapping |
| `src/lib/file-parsers.js` | 356 | PDF/EPUB file parsing with structure extraction |

---

## 13. Decisions Still Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Free tier scope | None / Limited WPM / Ads | Start without free tier, add later |
| Exact pricing | $19.99/yr or $2.99/mo | Annual only initially |
| Analytics provider | Mixpanel / Amplitude / CloudWatch | CloudWatch (AWS-native) |
| Waitlist vs direct launch | Collect emails first / Go live | Direct launch, iterate fast |

---

## 14. Existing Utilities to Reuse

**In `rsvp-utils.js`**:
- `parseText(text)` - Splits text into words, adds line break markers (`\n`), marks first word after breaks (`⟩`)
- `getORPIndex(word)` - Returns optimal recognition point index based on word length
- `getActualORPIndex(word)` - Adjusts ORP for leading punctuation
- `getWordDelay(word, wpm, ...)` - Calculates display time with punctuation/line break multipliers
- `extractWordFrame(words, idx, size)` - Gets word subset for multi-word display
- `formatTimeRemaining(words, wpm)` - Returns "MM:SS" string

**In `progress-storage.js`**:
- `saveSession(data)` - Saves to localStorage or IndexedDB
- `loadSession()` - Loads from appropriate storage
- `clearSession()` - Clears saved data
- `hasSession()` - Checks if session exists

---

## 15. Claude Agent-Specific Guidance

### Context Management
1. **Start each session** by reading this document
2. **For client work**: Read `App.svelte` header (~lines 1-120) for state overview
3. **For bug fixes**: Use `Grep` to find relevant code before diving in
4. **For unfamiliar areas**: Use Task tool with `Explore` agent type

### Efficient Navigation
- **State changes**: Search for `$:` (reactive statements)
- **Settings logic**: Check `saveCurrentSession()` and `loadSavedSession()`
- **Component props**: Check where component is used in App.svelte

### Common Operations
```bash
# Local development
npm run dev

# Run tests
npm run test:run

# Build for production
npm run build

# Capacitor (after installation)
npx cap sync
npx cap open ios
```

### Commit Conventions
- Use conventional commit style: `feat:`, `fix:`, `refactor:`
- Include attribution:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Don't push without user approval

### When Stuck
1. Check existing documentation files for context
2. Use Grep to find similar patterns in codebase
3. Ask user for clarification before making assumptions

---

## 16. Repository Information

**Original Project**: Thomas Kolmans (MIT License)
**Enhanced Fork**: Brandon Keller (@kegbenk)
**License**: MIT (commercial use allowed)
**Dependencies**: All MIT or Apache 2.0 (commercial-friendly)

---

*Document created: 2026-02-20*
*Last updated: 2026-02-20*
*For use by Claude agents continuing Velo development*
