# Velo Roadmap Checklist

This checklist consolidates all remaining tasks from `VELO_HANDOFF.md` into a single execution list for one or more coding agents.

## Client-Side

### Phase 1: Stabilization
- [x] Verify Capacitor setup end-to-end (clean build + `npx cap sync` + `npx cap open ios`).
- [ ] Confirm iOS safe-area handling across screens (header, focus mode, overlays).
- [x] Verify Velo branding is consistent across UI + metadata + native project.

### Phase 2: Native PDF Reader (PDFKit)
- [ ] Install `@capacitor-community/pdf-viewer`.
- [x] Add reader adapter abstraction (`src/lib/adapters/reader-adapter.js`).
- [ ] Route PDF rendering to native PDFKit on iOS.
- [x] Keep `pdfjs-dist` as web fallback for browser testing.
- [ ] Validate with large PDFs (performance + rendering parity).

### Phase 3: Native EPUB Reader (FolioReaderKit)
- [ ] Create Capacitor plugin wrapper for FolioReaderKit.
- [ ] Route EPUB rendering to native reader on iOS.
- [ ] Implement sync between RSVP mode and native reader position.
- [ ] Add native search, bookmarks, annotations (as supported by FolioReaderKit).
- [ ] Validate EPUB rendering: images, fixed layout, typography, TOC accuracy.

### Phase 4: Native Polish
- [ ] Add haptic feedback (Capacitor Haptics).
- [ ] Verify IndexedDB persistence inside native WebView.
- [ ] Handle iOS keyboard interactions for search/settings.
- [ ] Test with a wide variety of EPUB/PDF files (edge cases).

### Phase 5: Monetization
- [ ] Install RevenueCat: `@revenuecat/purchases-capacitor`.
- [ ] Create paywall UI component.
- [ ] Add feature gating and entitlement checks in `src/App.svelte`.
- [ ] Configure products in App Store Connect.
- [ ] Test sandbox purchases (new, restore, expired, revoked).

## Library Integration & Content Import

### Launch Features
- [ ] Implement iOS Share Extension for EPUB/PDF import.
- [ ] Add Files app integration (Open in Velo / document provider).

### Post-Launch Features
- [ ] Add in-app discovery for free ebooks (Gutenberg, Standard Ebooks, Open Library).
- [ ] Add OPDS catalog support (Calibre server browsing + downloads).
- [ ] Evaluate public library integration (OverDrive/Libby partnerships if needed).

## Server-Side (AWS)

### Phase 1: Foundation
- [ ] Configure Cognito User Pool with Sign in with Apple.
- [ ] Create DynamoDB user table (`user_id`, `email`, `entitlements`, `subscription_expires_at`, etc.).
- [ ] Build API Gateway + Lambda endpoints:
  - [ ] `POST /auth/apple` (Apple token verification)
  - [ ] `GET /user/profile` (entitlements)
  - [ ] `POST /subscription/verify` (Apple receipt verification)

### Phase 2: Auth Flow
- [ ] Implement Sign in with Apple flow in app.
- [ ] Backend verifies Apple identity token.
- [ ] Create/update user in DynamoDB.
- [ ] Return JWT for subsequent API calls.

### Phase 3: Marketing Infrastructure
- [ ] Landing page on S3 + CloudFront.
- [ ] Waitlist API (API Gateway + Lambda + DynamoDB).
- [ ] SES integration for welcome/beta emails.

## Decisions Still Needed
- [ ] Decide free tier scope (none vs limited WPM vs ads).
- [ ] Confirm pricing strategy (annual-only vs monthly).
- [ ] Select analytics provider (CloudWatch vs Mixpanel vs Amplitude).
- [ ] Decide waitlist vs direct launch approach.

## Testing Checklist (Run Before Major Changes)
- [ ] iOS Safari persistence after backgrounding (10+ seconds).
- [ ] Large EPUB (>5MB) loads via IndexedDB.
- [ ] New user experience (clear storage, reload).
- [ ] Session restoration with existing save.
- [ ] Both RSVP and reader modes work.
- [ ] TOC navigation in structured EPUBs.
- [ ] Speed controls (+/-) during playback.
- [ ] Rewind button (tap = 1 word, hold = progressive).
- [ ] Line break pauses working.
- [ ] Settings persist across sessions.
