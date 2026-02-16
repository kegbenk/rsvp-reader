# RSVP Reader Enhanced

**An advanced fork of RSVP Reader with dual reading modes, iOS persistence, and mobile-first enhancements.**

> **Forked from**: [thomaskolmans/rsvp-reading](https://github.com/thomaskolmans/rsvp-reading) (MIT License)
> **Enhanced by**: Brandon Keller ([@kegbenk](https://github.com/kegbenk))

A Svelte-based Rapid Serial Visual Presentation (RSVP) reader with traditional book view, advanced EPUB support, and iOS-optimized session persistence.

## 🎯 What Makes This Fork Different

This enhanced version adds significant improvements over the original:

### ✨ New in This Fork

- **📖 Dual Reading Modes**
  - RSVP mode: Traditional rapid serial visual presentation
  - Reader mode: Traditional book view with real-time word highlighting
  - Seamless switching with keyboard shortcut (M key)

- **📱 iOS-Optimized Persistence**
  - Auto-save every 10 seconds during playback
  - Survives app backgrounding and switching
  - IndexedDB fallback for large EPUB files (>2MB)
  - Automatic session restoration on launch

- **📚 Enhanced EPUB Support**
  - Full table of contents (TOC) extraction and navigation
  - Chapter-aware reading with progress indicators
  - Click/tap words in reader mode to jump RSVP position
  - HTML-preserved rendering for rich formatting

- **⚡ Advanced UX**
  - Speed controls visible during playback (+/- buttons)
  - Dynamic font scaling for long words (ORP stays constant)
  - Progressive rewind button (hold to rewind faster)
  - Chapter progress indicator in focus mode
  - Platform-specific behavior (iOS vs desktop)

- **🎨 Mobile-First Design**
  - Touch-optimized controls (44px+ tap targets)
  - iOS-specific scrolling behavior
  - Responsive layout for all screen sizes

- **🚀 Commercialization Ready**
  - Complete business plan and market analysis included
  - Capacitor integration guide for native mobile apps
  - Monetization strategy and pricing recommendations
  - See `COMMERCIALIZATION_ROADMAP.md` for details

## 🎬 Demo

**Original Demo**: https://rsvp.n0name.eu/ (original fork)

<video src="rsvp-clip.mp4" controls width="600"></video>

## What is RSVP?

Rapid Serial Visual Presentation (RSVP) is a technique where text is displayed one word at a time at a fixed focal point. This eliminates the need for eye movements (saccades) during reading, potentially allowing for significantly faster reading speeds.

The app uses **Optimal Recognition Point (ORP)** highlighting - the red letter in each word indicates the point where your eye naturally focuses for fastest word recognition. This is calculated based on word length:

- 1-3 letter words: 1st letter
- 4-5 letter words: 2nd letter
- 6-9 letter words: 3rd letter
- 10-11 letter words: 4th letter
- 12-14 letter words: 5th letter
- 15-17 letter words: 6th letter
- 18+ letter words: 7th letter

## Features

### Core Features (from original)
- **PDF & EPUB Support**: Upload PDF documents or EPUB e-books directly
- **Adjustable reading speed**: 50-1000 words per minute (WPM)
- **ORP highlighting**: Red-highlighted focal letter for faster recognition
- **Monospace display**: Fixed-width font keeps the focal point stable
- **Focus mode**: Minimal UI during reading for distraction-free experience
- **Fade effect**: Optional smooth transitions between words
- **Punctuation pauses**: Configurable extra pause on sentence-ending punctuation
- **Periodic pauses**: Optional pause every N words for comprehension
- **Progress tracking**: Visual progress bar and time remaining
- **Jump to position**: Skip to any word number or percentage in the text
- **Clickable progress bar**: Click anywhere on the progress bar to jump to that position
- **Keyboard shortcuts**: Full keyboard control for hands-free reading
- **Dark theme**: Easy on the eyes with black background

### Enhanced Features (new in this fork)
- **Dual Reading Modes**: Switch between RSVP and traditional reader view
- **Interactive Reader Mode**: Click words to set RSVP position
- **Table of Contents Navigation**: Full TOC panel with chapter browsing
- **Chapter Progress**: Visual indicator showing progress within current chapter
- **Long Word Handling**: Dynamic font scaling (up to 50% smaller for 12+ character words)
- **Rewind Control**: Hold-to-rewind button with progressive speed increase
- **Speed Controls in Focus Mode**: Adjust WPM without leaving reading view
- **iOS Session Persistence**: Automatic save/restore even after app backgrounding
- **Large File Support**: IndexedDB storage for EPUBs up to hundreds of MB
- **Smart Storage Selection**: Automatically chooses localStorage or IndexedDB based on file size
- **Platform-Specific Behavior**: iOS vs desktop optimizations for best UX

## Installation

```bash
# Clone this enhanced fork
git clone https://github.com/kegbenk/rsvp-reader.git
cd rsvp-reader

# Install dependencies
npm install

# Start development server
npm run dev
```

## Docker

Run the app using Docker Compose:

```bash
cd docker
docker compose up -d
```

The app will be available at http://localhost:8080

To rebuild after changes:

```bash
docker compose up -d --build
```

## Usage

### Running the App

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Loading Content

**From Files:**
1. Click the document icon in the header
2. Click "Upload PDF or EPUB"
3. Select your PDF or EPUB file
4. The text will be extracted and loaded automatically
5. For EPUBs: Table of contents will be automatically parsed

**From Text:**
1. Click the document icon in the header
2. Paste or type your text in the textarea
3. Click "Load Text"

### Dual Reading Modes

**RSVP Mode** (default):
- Words appear one at a time in the center
- Best for speed reading
- Minimal eye movement

**Reader Mode** (for EPUBs with structure):
- Traditional book-like layout
- Word highlighting synced with RSVP position
- Click/tap any word to jump RSVP position to that word
- Scrollable with chapter navigation
- Press `M` to switch modes

### Table of Contents

**For EPUBs with TOC:**
- Press `T` to open the table of contents panel
- Click any chapter to jump directly to it
- Works in both RSVP and Reader modes
- Shows chapter hierarchy and word counts

### Controls

**Buttons:**
- **Play**: Start reading from the beginning or current position
- **Pause**: Pause reading (UI enters focus mode with minimal controls)
- **Resume**: Continue from where you paused
- **Stop**: Stop and exit focus mode
- **Restart**: Stop and immediately start from beginning (RSVP mode only)
- **Mode Toggle**: Switch between RSVP and Reader modes (floating button)
- **Rewind**: Tap to go back 1 word, hold to rewind continuously (faster over time)
- **+/- Speed**: Adjust WPM during reading (visible in focus mode)

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Space` | Play/Pause/Resume (or toggle auto-scroll in Reader mode) |
| `Escape` | Exit focus mode (or close dialogs) |
| `M` | Switch between RSVP and Reader modes (when paused) |
| `T` | Open table of contents (for EPUBs with TOC) |
| `G` | Open jump to position dialog |
| `Arrow Up` | Increase speed (+25 WPM) |
| `Arrow Down` | Decrease speed (-25 WPM) |
| `Arrow Left` | Go back one word |
| `Arrow Right` | Skip forward one word |
| `Ctrl+S` / `Cmd+S` | Save current progress |

### Saving and Resuming Progress

**Automatic Saving:**
- Sessions are saved automatically every 10 seconds during playback
- Also saves when you pause, stop, or background the app
- For large files (>2MB), automatically uses IndexedDB instead of localStorage

**Resume Reading:**
- Sessions are automatically restored when you return to the app
- Your position, settings, chapter, and mode are all preserved
- Works even after closing the browser (if not in private mode)

**Manual Save:**
- Click the save icon in the header (floppy disk icon)
- Or press `Ctrl+S` (Windows/Linux) or `Cmd+S` (Mac)

### Jump to Position

**Using the Jump Dialog:**
1. Click the code bracket icon in the header, or press `G`
2. Enter a word number (e.g., `150`) or percentage (e.g., `50%`)
3. Click "Go" or press Enter

**Quick Jump Buttons:**
- Use the preset buttons (Start, 25%, 50%, 75%) for quick navigation

**Clickable Progress Bar:**
- When not playing, click anywhere on the progress bar to jump directly to that position
- The progress bar expands on hover to make clicking easier

### Settings

Click the gear icon to access settings:

- **Words Per Minute**: Reading speed (50-1000 WPM)
- **Enable Fade Effect**: Smooth fade transition between words
- **Fade Duration**: Duration of fade effect (50-300ms)
- **Pause on Punctuation**: Extra pause at sentence endings
- **Punctuation Pause Multiplier**: How much longer to pause (1-4x)
- **Longer Words Display Multiplier**: Extra time for words 12+ characters (0-100%, default 50%)
- **Pause Every N Words**: Take a break every N words (0 = disabled)
- **Pause Duration**: Length of periodic pauses (100-2000ms)
- **Multi-Word Display**: Show 1, 3, or 5 words at a time

## Project Structure

```
rsvp-reader/
├── src/
│   ├── App.svelte                    # Main application component
│   ├── app.css                       # Global styles
│   ├── main.js                       # Application entry point
│   ├── lib/
│   │   ├── rsvp-utils.js             # Core RSVP utility functions
│   │   ├── file-parsers.js           # PDF and EPUB parsing utilities
│   │   ├── progress-storage.js       # Hybrid localStorage/IndexedDB persistence
│   │   ├── indexed-db-storage.js     # IndexedDB wrapper for large files (NEW)
│   │   ├── epub-structure-parser.js  # Enhanced EPUB parsing with TOC (NEW)
│   │   ├── content-utils.js          # Chapter navigation utilities (NEW)
│   │   └── components/
│   │       ├── RSVPDisplay.svelte    # Word display with dynamic scaling
│   │       ├── ReaderDisplay.svelte  # Traditional reader view (NEW)
│   │       ├── TOCPanel.svelte       # Table of contents panel (NEW)
│   │       ├── Controls.svelte       # Playback controls
│   │       ├── Settings.svelte       # Settings panel
│   │       ├── TextInput.svelte      # Text/file input panel
│   │       └── ProgressBar.svelte    # Progress indicator (clickable)
│   └── tests/
│       ├── setup.js                  # Test setup
│       ├── rsvp-utils.test.js        # RSVP utility tests
│       ├── file-parsers.test.js      # File parser tests
│       └── progress-storage.test.js  # Progress storage tests
├── COMMERCIALIZATION_ROADMAP.md      # Business plan for mobile app (NEW)
├── DEVELOPMENT_CONTEXT.md            # Complete development context (NEW)
├── UPGRADE_SUMMARY.md                # Technical changes overview (NEW)
├── WORD_CLICK_BUG_REPORT.md          # Known issues documentation (NEW)
├── NEW_USER_ACCESS_ANALYSIS.md       # Bug analysis (NEW)
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Testing

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage
```

## Commercialization

This fork includes a comprehensive commercialization plan for converting the web app into a mobile application:

- **Technical Path**: Capacitor integration guide for iOS/Android
- **Business Model**: Freemium with $19.99/year subscription
- **Marketing Strategy**: TikTok/Instagram focused approach
- **Financial Projections**: Conservative to optimistic scenarios
- **Legal Analysis**: MIT license allows commercial use

See `COMMERCIALIZATION_ROADMAP.md` for the complete 450+ line business plan.

## Browser Support

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari (iOS optimized)

**Note**: IndexedDB support required for large files. All modern browsers support this.

## Dependencies

- **pdfjs-dist**: PDF parsing (Apache 2.0 license)
- **epubjs**: EPUB e-book parsing (Apache 2.0 license)
- **Svelte 3.x**: UI framework (MIT license)
- **Vite**: Build tool (MIT license)

All dependencies use commercial-friendly licenses.

## Mobile App Development

To convert this web app to a native mobile app:

1. Install Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "RSVP Reader" "com.yourcompany.rsvpreader"
   ```

2. Add platforms:
   ```bash
   npm install @capacitor/ios @capacitor/android
   npx cap add ios
   npx cap add android
   ```

3. Build and sync:
   ```bash
   npm run build
   npx cap sync
   ```

4. Open in native IDEs:
   ```bash
   npx cap open ios      # Opens Xcode
   npx cap open android  # Opens Android Studio
   ```

See `COMMERCIALIZATION_ROADMAP.md` for detailed mobile app development guide.

## Known Issues

### Word Click Positioning (Minor)
Clicking words in reader mode to set RSVP position has slight offset:
- Desktop: ~2 words ahead of clicked word
- iOS: ~50 words ahead (touch precision)

**Workaround**: Click slightly before the desired word, or use rewind button to adjust.

See `WORD_CLICK_BUG_REPORT.md` for technical details and potential fixes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Development Context

For new contributors or Claude Code instances continuing development:

1. Read `DEVELOPMENT_CONTEXT.md` for complete technical overview
2. Review `UPGRADE_SUMMARY.md` for recent changes
3. Check `WORD_CLICK_BUG_REPORT.md` for known issues
4. See `COMMERCIALIZATION_ROADMAP.md` for business context

## License

This project is open source and available under the [MIT License](LICENSE).

**Original Project**: MIT License by Thomas Kolmans
**Enhanced Fork**: MIT License by Brandon Keller

The MIT License allows commercial use, modification, distribution, and sublicensing.

## Acknowledgments

- **Original Project**: [thomaskolmans/rsvp-reading](https://github.com/thomaskolmans/rsvp-reading)
- **Enhanced by**: Brandon Keller ([@kegbenk](https://github.com/kegbenk))
- **AI Development**: Claude Sonnet 4.5 by Anthropic
- **RSVP Research**: Based on cognitive psychology research
- Built with [Svelte](https://svelte.dev/) and [Vite](https://vitejs.dev/)
- PDF parsing: [PDF.js](https://mozilla.github.io/pdf.js/)
- EPUB parsing: [Epub.js](https://github.com/futurepress/epub.js/)

---

**Repository**: https://github.com/kegbenk/rsvp-reader
**Original**: https://github.com/thomaskolmans/rsvp-reading
