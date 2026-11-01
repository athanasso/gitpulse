# GitPulse ⚡🐙🦊🍵🪣

<p align="center">
  <img src="./assets/hero-banner.png" alt="GitPulse Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/athanasso/gitpulse/releases/latest"><img src="https://img.shields.io/github/v/release/athanasso/gitpulse?color=8B5CF6&label=APK%20Release%20v1.1.0&logo=android" alt="Latest Release"></a>
  <img src="https://img.shields.io/badge/React%20Native-0.88.1-06B6D4?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-SDK%2058-white?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-10B981" alt="License">
</p>

> **GitPulse** is a universal, developer-first mobile Git client built with **React Native**, **Expo 58**, and **TypeScript**. Designed for developers who demand instant repository access, seamless multi-account switching across **GitHub**, **GitLab**, **Gitea/Codeberg**, and **Bitbucket**, GitHub-rendered HTML markdown, offline-first 0ms loading, syntax-highlighted code browsing, and unified PR/MR diff reviews on mobile.

---

## 🎯 Key Features

### 1. 🌐 Multi-Provider & Multi-Account Engine
- **Universal Forge Support**:
  - ⚡ **GitHub**: Public, private, and GitHub Enterprise.
  - 🦊 **GitLab**: `gitlab.com` + custom self-hosted GitLab CE/EE instances via REST v4.
  - 🍵 **Gitea / Forgejo / Codeberg**: Public forges and self-hosted instances via REST v1.
  - 🪣 **Bitbucket Cloud**: Workspaces and repositories via REST 2.0.
- **Concurrent Multi-Account Switcher**:
  - Connect unlimited accounts (personal, company, freelance, and self-hosted).
  - 1-tap switching from the top header account pill (`[ ⚡ @athanasso ▾ ]` $\leftrightarrow$ `[ 🦊 @work ▾ ]`).
  - Active workspace automatically dispatches repo lists, commit logs, branches, and tree navigation.

### 2. ⚡ Offline-First Stale-While-Revalidate (SWR) Caching
- **0ms Instant Hydration**: Phone storage cache (`AsyncStorage` + warmed in-memory Map) displays your repositories, profile bio, heatmap, and README immediately on launch.
- **Silent Background Revalidation**: Fetches fresh commits and repositories in the background without blocking spinners or UI flashes.
- **Skeleton Loaders**: Polished 5-card placeholder animations on fresh installs when local storage is empty.

### 3. 🧭 Explore & Trending Hub
- **Breakout Trending Repositories**: Filter by **Today**, **This Week**, or **This Month**.
- **Language Filtering**: Explore trending repos across TypeScript, JavaScript, Python, Rust, Go, Swift, Kotlin, C++, and more.
- **Curated Topics**: Dedicated feeds for `AI & Agents`, `React Native`, `Rust`, `DevOps`, `Security`, `Mobile`, `Web3`, and `Developer Tools`.
- **Developer Discovery**: Explore high-impact open source creators with direct profiles.

### 4. 🔍 Dual-Scope Search
- **Segmented Search Switcher**:
  - `[ ⚡ My Repos ]`: 0ms local in-memory filtering across all your repositories.
  - `[ 🌐 All GitHub ]`: Debounced (350ms) background search across public repositories.
- **Clear Visual Scope Indicators**: Global results display owner avatars, full paths (`owner/repo`), and bright `🌐 Global` badges.
- **Smart Handoff**: If zero matches are found in your account, a 1-tap button immediately hands off to global search.

### 5. 📖 GitHub-Rendered HTML Markdown Engine
- Direct DOM rendering via `react-native-webview` matching GitHub.com 1:1.
- Flawless support for:
  - Shields.io and dynamic status badges
  - Multi-column Markdown tables with horizontal scrolling
  - Inline and block SVGs & emojis
  - Code blocks with syntax formatting
  - Interactive checklists & task items
  - `<themed-picture>` adaptive dark/light GitHub assets
- External links automatically open in system browser via `Linking.openURL()`.

### 6. 📱 Safe-Area & Edge-to-Edge Navigation
- Full compatibility with Android 3-button navigation bars and gesture pills (`useSafeAreaInsets`).
- Dynamic bottom elevation ensures tab touch targets never overlap system buttons.

### 7. 🎨 5 Dynamic Themes
- Switch instantly without reloading:
  1. **GitPulse Obsidian**: Deep space canvas (`#070B14`) with violet & cyan pulses.
  2. **GitHub Dimmed**: Soft slate dark canvas (`#22272E`) designed for long nighttime reading.
  3. **High-Contrast Dark**: Pure pitch black (`#010409`) with crisp borders.
  4. **GitHub Clean Light**: Official daylight white (`#FFFFFF`) with GitHub light accents.
  5. **Neon Cyberpunk**: High-voltage electric dark with neon rose, emerald & amber accents.

### 8. 🎛️ Modular Layout & Profile Customization
- **Modular Profile Sections**:
  - Reorder sections via drag-like touch controls.
  - Toggle visibility: Overview Metrics, 52-Week Contribution Heatmap, Pinned Repositories, Profile README, and Subtabs.
- **Compact vs Spacious Density**: Choose between dense code review cards or spacious browsing.
- **Default Subtab Configuration**: Customize default landing tabs for Repositories and Profiles.

### 9. 🌲 Tree Explorer & Syntax Code Viewer
- Directory navigation with breadcrumb path history.
- Monospace syntax viewer with line numbers and byte size tracking.
- Branch switcher (`main`, `master`, dev branches).

### 10. 🔀 Unified Diffs & Commits
- Full commit logs with author avatars, timestamp formatting, and SHA badges.
- Line-by-line diff inspection with green addition (`+`) and red deletion (`-`) highlights.

### 11. 📊 52-Week Contribution Heatmap
- Live contribution matrix derived from GitHub GraphQL API.
- Day-by-day commit inspector, current streak, and longest streak counters.

### 12. 💬 Issues, Pull Requests & Merge Requests
- Filter by status: `Open`, `Closed`, `Merged`.
- Pull request review tracking and release changelogs with asset downloads.

### 13. ⚠️ Danger Zone (Repository Deletion)
- Toggleable feature in settings.
- Requires typing exact `owner/repo-name` in a safety modal before unlocking permanent deletion.

### 14. 🔔 Notifications Inbox & Sleep Prevention
- Thread triage for review requests, issue assignments, and commit mentions.
- `expo-keep-awake` prevents device screen timeout during long code reviews.

---

## 📱 Download & Install

Direct APK builds are published on GitHub Releases:

👉 **[Download GitPulse v1.1.0 APK](https://github.com/athanasso/gitpulse/releases/latest)**

---

## 📦 Package Identity

- **Name**: GitPulse
- **Slug**: `gitpulse`
- **Version**: `1.1.0`
- **Package**: `com.athanasso.gitpulse`
- **Framework**: Expo 58 / React Native 0.88 / React 19 / TypeScript 5.9

---

## 🚀 Development Setup

```bash
# Clone the repository
git clone https://github.com/athanasso/gitpulse.git
cd gitpulse

# Install dependencies
npm install

# Start Expo development server
npx expo start
```

---

## 🔒 Privacy & Security

GitPulse connects strictly to official forge APIs (or your specified self-hosted instance URL).
- Zero analytics, telemetry, trackers, or middleman proxy servers.
- Personal Access Tokens (PAT) and App Passwords are encrypted locally on device in `AsyncStorage`.
- Direct SSL/TLS communication between device and git server.

---

## 📄 License

MIT © [Emmanouil Athanasopoulos](https://github.com/athanasso)
