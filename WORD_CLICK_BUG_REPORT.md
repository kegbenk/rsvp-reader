# Word Click Positioning Bug Report

## Summary
Clicking/tapping a word in traditional reader mode to set the RSVP position results in incorrect word selection:
- **Desktop**: RSVP reader is placed ~2 words ahead of the clicked word
- **iOS**: RSVP reader is placed ~50 words ahead of the clicked word

## Root Cause Analysis

### Issue 1: Leading whitespace not accounted for

In `handleWordClick` (ReaderDisplay.svelte:369-478), the `walkAndCount` function uses `parseText()` which trims whitespace before splitting:

```javascript
const words = parseText(text); // parseText does: text.trim().split(/\s+/)
```

But then calculates character positions assuming words start at position 0:
```javascript
let charCount = 0;
for (let i = 0; i < words.length; i++) {
  const wordStart = charCount;  // Wrong if text has leading whitespace
  ...
}
```

If the text node contains `"  hello world"`, `parseText` returns `["hello", "world"]`, but the character offset from `caretRangeFromPoint` refers to the original text where "hello" starts at position 2, not 0.

### Issue 2: iOS touch precision

`document.caretRangeFromPoint(event.clientX, event.clientY)` behaves differently on iOS Safari:
- Touch events have less precision than mouse clicks
- The reported coordinates may not align exactly with where the user intended to tap
- This explains the larger discrepancy (50 words) on iOS vs desktop (2 words)

### Issue 3: DOM text vs plainText mismatch

The highlighting system uses `chapter.plainText` as the source of truth for word counting, but the click handler walks the DOM which may have slightly different text content (extra whitespace, different unicode normalization, etc.).

## Affected Code

| File | Lines | Function |
|------|-------|----------|
| `src/lib/components/ReaderDisplay.svelte` | 369-478 | `handleWordClick()` |
| `src/lib/rsvp-utils.js` | 10-13 | `parseText()` |

## Recommended Fixes

1. **Fix whitespace handling**: Use regex to find word positions in original text:
   ```javascript
   const wordRegex = /\S+/g;
   let match;
   while ((match = wordRegex.exec(text)) !== null) {
     // match.index gives actual position in original text
   }
   ```

2. **Improve iOS accuracy**: Consider finding the closest word element to the touch point rather than relying on character offset calculation.

3. **Normalize word counting**: Ensure DOM walking uses the same word-splitting logic as `parseText` for consistency.

## Status

**Unresolved** - Report created 2026-02-15
