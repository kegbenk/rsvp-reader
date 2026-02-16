# RSVP Reader Commercialization Roadmap

## Executive Summary

This document outlines the complete path from the current open-source Svelte web app to a revenue-generating mobile application on iOS and Android platforms.

---

## Part 1: Legal & Licensing Analysis

### Current Licensing Situation

**Project License:** MIT License
- The original project (github.com/thomaskolmans/rsvp-reading) uses MIT license
- MIT explicitly allows commercial use, modification, distribution, and sublicensing
- You CAN build a commercial product from this codebase

**Key Dependencies:**
| Dependency | License | Commercial Use |
|------------|---------|----------------|
| epubjs | Apache 2.0 | ✅ Allowed |
| pdfjs-dist | Apache 2.0 | ✅ Allowed |
| Svelte | MIT | ✅ Allowed |
| Vite | MIT | ✅ Allowed |

### What You Must Do

1. **Keep attribution** - Include MIT license notice in your app (can be in Settings > About or Legal section)
2. **Keep dependency licenses** - Include Apache 2.0 notices for epubjs and pdfjs-dist
3. **No need to open-source your changes** - MIT doesn't require derivative works to be open-source

### Fork vs Pivot Decision

**Option A: Fork the Repository (Recommended)**
- Create a private fork for commercial development
- Keep all original code, add your proprietary features
- Maintain ability to pull upstream improvements
- Lower development effort

**Option B: Clean-Room Rewrite**
- Build from scratch using only the concepts (not code)
- Eliminates any licensing questions
- Significantly more development time
- Only consider if you want to use a different tech stack

**Recommendation:** Fork the repository. MIT license is extremely permissive and designed for exactly this use case.

---

## Part 2: Technical Path to Mobile App

### Option Analysis

| Approach | Dev Time | Performance | App Store | Maintenance |
|----------|----------|-------------|-----------|-------------|
| **PWA (Progressive Web App)** | Low | Good | Limited | Easy |
| **Capacitor (Svelte → Native)** | Medium | Excellent | Full | Medium |
| **React Native Rewrite** | High | Excellent | Full | Medium |
| **Flutter Rewrite** | High | Excellent | Full | Medium |
| **Native (Swift/Kotlin)** | Very High | Best | Full | Hard |

### Recommended Path: Capacitor

**Why Capacitor?**
1. Reuses your existing Svelte/JS codebase (95%+ code reuse)
2. Full App Store access (unlike PWA)
3. Native device features (haptics, notifications, etc.)
4. Same codebase for iOS, Android, AND web
5. Maintained by Ionic (well-funded, stable)

### Implementation Steps

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "RSVP Reader" "com.yourcompany.rsvpreader"

# 2. Add platforms
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android

# 3. Build and sync
npm run build
npx cap sync

# 4. Open in native IDEs
npx cap open ios    # Opens Xcode
npx cap open android # Opens Android Studio
```

### Mobile-Specific Features to Add

**Essential:**
- [ ] Offline file storage (already using IndexedDB, good)
- [ ] Proper iOS safe area handling
- [ ] Android back button handling
- [ ] App icon and splash screen
- [ ] Push notifications (reading reminders)

**Valuable:**
- [ ] iCloud/Google Drive sync
- [ ] Widget for reading progress
- [ ] Siri/Google Assistant integration
- [ ] Apple Watch companion app
- [ ] Share extension (open EPUBs from other apps)

---

## Part 3: Business Model Options

### Revenue Models

**1. One-Time Purchase**
- Price: $4.99 - $9.99
- Pros: Simple, users prefer it
- Cons: No recurring revenue, must constantly acquire new users
- Best for: Utility apps with stable feature sets

**2. Subscription**
- Price: $2.99/month or $19.99/year
- Pros: Recurring revenue, sustainable business
- Cons: Users have subscription fatigue
- Best for: Apps with ongoing value/content

**3. Freemium**
- Free tier: Basic RSVP, limited WPM, ads
- Pro tier: All features, no ads, sync
- Pros: Large user base, viral potential
- Cons: Most users never convert (typically 2-5%)
- Best for: Apps targeting mass market

**4. One-Time Purchase + Tip Jar**
- Base price: $2.99
- Optional tips: $0.99, $2.99, $4.99
- Pros: Low barrier, grateful users tip
- Cons: Unpredictable revenue

### Recommended Model: Freemium with Annual Subscription

**Free Tier:**
- RSVP reading up to 250 WPM
- Basic EPUB support
- Local storage only
- Contains tasteful ads (bottom banner)

**Pro Tier ($19.99/year or $2.99/month):**
- Unlimited WPM (up to 1000+)
- PDF support
- Cloud sync across devices
- Traditional reader mode
- No ads
- Priority support
- Early access to new features

**Why This Model:**
- Low barrier gets users in the door
- Power users (your target) will pay for speed
- Annual subscription provides predictable revenue
- 1000 paid users at $20/year = $20,000 ARR

---

## Part 4: App Store Requirements

### Apple App Store (iOS/iPadOS)

**Requirements:**
1. Apple Developer Account ($99/year)
2. Mac computer (required for Xcode)
3. App Store Connect account
4. Privacy policy URL
5. App screenshots for all device sizes
6. App preview video (optional but recommended)

**Review Guidelines to Know:**
- No placeholder content
- Must work offline if claimed
- In-app purchases must use Apple's IAP (30% cut)
- No external payment links
- Metadata must match app functionality

**Timeline:** 1-7 days for review (usually 24-48 hours)

### Google Play Store (Android)

**Requirements:**
1. Google Play Developer Account ($25 one-time)
2. Privacy policy URL
3. App screenshots
4. Content rating questionnaire
5. Data safety questionnaire

**Review Guidelines:**
- Similar to Apple but generally more lenient
- Can use external payments (15% Google cut if using their billing)
- Must declare all permissions used

**Timeline:** Hours to 3 days

### Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Account | $99 | Annual |
| Google Play Account | $25 | One-time |
| Domain for privacy policy | ~$12 | Annual |
| **Total Year 1** | **$136** | - |
| **Total Ongoing** | **$111** | Annual |

---

## Part 5: Marketing Strategy

### Target Audience

**Primary:**
- Students (high school, college, graduate)
- Professionals who need to read a lot
- Speed reading enthusiasts
- People with ADHD (RSVP can help focus)
- Book lovers who want to read more

**Demographics:**
- Age: 16-45
- Education: High school+
- Income: Middle class+
- Tech-savvy, smartphone users

### Social Media Strategy

**TikTok (Primary Channel)**
- Best for: Viral potential, young audience
- Content ideas:
  - "Watch me read a chapter in 5 minutes"
  - Speed reading challenges
  - Before/after reading speed comparisons
  - "Books I read this month using RSVP"
  - Tips for better comprehension at high speeds
  - Duets with other book content creators

**Instagram (Secondary Channel)**
- Best for: Aesthetic content, slightly older audience
- Content ideas:
  - Reels (same as TikTok)
  - Stories showing daily reading progress
  - Carousel posts explaining RSVP science
  - User testimonials
  - Reading statistics infographics

**YouTube (Long-term)**
- Tutorial videos
- "Day in the life" using the app
- Comparison with other speed reading methods

### Content Calendar Example

| Day | Platform | Content Type |
|-----|----------|--------------|
| Mon | TikTok | Speed reading challenge |
| Tue | Instagram | Tip carousel |
| Wed | TikTok | User testimonial |
| Thu | Instagram | Behind-the-scenes |
| Fri | TikTok | Trending audio + app |
| Sat | Both | Weekend reading motivation |
| Sun | YouTube | Weekly tutorial |

### Influencer Strategy

**Micro-influencers (1K-50K followers):**
- Book bloggers
- Study/productivity accounts
- ADHD community creators
- Cost: Free product or $50-200 per post

**Approach:**
1. Find creators who already talk about reading/productivity
2. Offer free lifetime pro access
3. Ask for honest review (don't script it)
4. Share their content on your channels

### App Store Optimization (ASO)

**Keywords to target:**
- Speed reading
- RSVP reader
- Fast reading app
- Book reader
- EPUB reader
- Reading trainer
- Speed read books

**Title:** "RSVP Reader - Speed Reading"
**Subtitle:** "Read Books 3x Faster"

---

## Part 6: Development Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Fork repository to private repo
- [ ] Set up Capacitor
- [ ] Create app icons and splash screens
- [ ] Basic iOS/Android builds working
- [ ] Fix any mobile-specific bugs

### Phase 2: Mobile Polish (Weeks 3-4)
- [ ] Safe area handling
- [ ] Haptic feedback
- [ ] App-specific navigation
- [ ] Performance optimization
- [ ] Offline mode testing

### Phase 3: Monetization (Weeks 5-6)
- [ ] Implement subscription logic
- [ ] Add paywall UI
- [ ] Integrate RevenueCat (subscription management)
- [ ] Add analytics (Mixpanel/Amplitude)
- [ ] Implement ad SDK (AdMob)

### Phase 4: Launch Prep (Weeks 7-8)
- [ ] Create App Store assets
- [ ] Write privacy policy
- [ ] Create marketing website
- [ ] Set up social media accounts
- [ ] Create initial content backlog
- [ ] Beta test with friends/family

### Phase 5: Launch (Week 9)
- [ ] Submit to App Store
- [ ] Submit to Google Play
- [ ] Launch marketing campaign
- [ ] Monitor reviews and respond
- [ ] Fix critical bugs quickly

### Phase 6: Growth (Ongoing)
- [ ] Weekly content creation
- [ ] Monthly feature updates
- [ ] A/B test pricing
- [ ] Expand to new markets
- [ ] Consider additional platforms (Mac App Store, etc.)

---

## Part 7: Financial Projections

### Conservative Scenario (Year 1)

**Assumptions:**
- 10,000 downloads
- 3% conversion to paid
- $19.99/year subscription
- 30% app store cut

**Revenue:**
- Paid users: 300
- Gross revenue: 300 × $19.99 = $5,997
- After app store cut: $4,198
- Minus costs (~$150): **$4,048 profit**

### Moderate Scenario (Year 1)

**Assumptions:**
- 50,000 downloads
- 4% conversion
- $19.99/year subscription

**Revenue:**
- Paid users: 2,000
- Gross revenue: $39,980
- After app store cut: $27,986
- Minus costs (~$500): **$27,486 profit**

### Optimistic Scenario (Year 1)

**Assumptions:**
- 200,000 downloads
- 5% conversion
- $19.99/year subscription

**Revenue:**
- Paid users: 10,000
- Gross revenue: $199,900
- After app store cut: $139,930
- Minus costs (~$2,000): **$137,930 profit**

---

## Part 8: Key Decisions Summary

### Decision 1: Fork vs Rewrite
**Recommendation:** Fork
**Why:** MIT license allows it, saves months of development

### Decision 2: Tech Stack
**Recommendation:** Capacitor + Svelte (keep current)
**Why:** Maximum code reuse, fastest to market

### Decision 3: Revenue Model
**Recommendation:** Freemium with annual subscription
**Why:** Balances user acquisition with monetization

### Decision 4: Platforms
**Recommendation:** iOS first, then Android
**Why:** iOS users spend more on apps, easier to monetize

### Decision 5: Marketing Channel
**Recommendation:** TikTok primary, Instagram secondary
**Why:** Best reach for target demographic, viral potential

### Decision 6: Pricing
**Recommendation:** $19.99/year or $2.99/month
**Why:** Sweet spot for productivity apps, below impulse threshold

---

## Part 9: Immediate Next Steps

1. **Today:** Create private fork of the repository
2. **This week:** Install Capacitor and get basic iOS build working
3. **This week:** Register Apple Developer account
4. **Next week:** Create social media accounts (TikTok, Instagram)
5. **Next week:** Design app icon and create brand identity
6. **Week 3:** Start creating content for social media
7. **Week 4:** Begin beta testing with target users

---

## Resources & Tools

**Development:**
- Capacitor: https://capacitorjs.com/
- RevenueCat (subscriptions): https://www.revenuecat.com/
- Mixpanel (analytics): https://mixpanel.com/

**Design:**
- Figma (free): https://figma.com/
- App Icon Generator: https://appicon.co/

**Marketing:**
- Later (social scheduling): https://later.com/
- Canva (graphics): https://canva.com/

**Legal:**
- Privacy policy generator: https://www.termsfeed.com/
- Terms of service template: https://www.termsfeed.com/

---

## Questions to Consider

1. What will you name the app? (Check App Store availability)
2. What's your unique angle vs existing speed reading apps?
3. Do you want to build this solo or with a team?
4. What's your timeline - side project or full-time focus?
5. Do you have budget for paid marketing, or organic only?
6. Are you comfortable appearing on camera for social content?

---

*Document created: February 2026*
*Status: Planning Phase*
