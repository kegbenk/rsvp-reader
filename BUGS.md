# Bugs

## Filesystem Plugin Not Available (iOS)
- **Status:** Blocked
- **Symptom:** Tapping **Open PDF** shows “Filesystem plugin is not available in this build.”
- **Impact:** Native PDF viewer cannot launch.
- **Observed:** iOS device build (Capacitor), after loading a PDF and switching to Reader mode.
- **Notes:**
  - Multiple `capacitor.config.json` copies exist; `npx cap sync ios` overwrites the iOS bundle config.
  - Bundle config still shows unqualified class names (`FileViewerPlugin`, `FilesystemPlugin`).
  - Explicit registration via custom `MainViewController` was attempted; build issues resolved but plugin still not available.

## FolioReaderKit SPM Resolution Fails
- **Status:** Blocked
- **Symptom:** Xcode cannot resolve FolioReaderKit as an SPM dependency.
- **Impact:** Native EPUB reader cannot load; `FolioReaderKit is not available in this build`.
- **Observed:** Xcode 15+ (Swift tools incompatibility).
- **Notes:**
  - FolioReaderKit repo uses an outdated Swift tools version (3.1).
  - Recommendation: add FolioReaderKit via CocoaPods (see `ios/App/Podfile`) or use a maintained fork.
