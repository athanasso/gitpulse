# GitPulse ⚡🐙

<p align="center">
  <img src="./assets/hero-banner.png" alt="GitPulse Banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/athanasso/gitpulse/releases/latest"><img src="https://img.shields.io/github/v/release/athanasso/gitpulse?color=8B5CF6&label=APK%20Release&logo=android" alt="Latest Release"></a>
  <img src="https://img.shields.io/badge/React%20Native-0.88.1-06B6D4?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-SDK%2058-white?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-10B981" alt="License">
</p>

> **GitPulse** is a high-performance, developer-first mobile GitHub client built with **React Native**, **Expo 58**, and **TypeScript**. Engineered for developers who want instant repository search, GitHub-rendered HTML markdown, fast syntax-highlighted code browsing, live pull request diff inspection, GitHub Actions workflow logs, and interactive annual contribution heatmaps on mobile.

---

## 🎯 Key Features

### 1. 🧭 Explore & Trending Hub
- **Breakout Trending Repositories**: Filter by **Today**, **This Week**, or **This Month**.
- **Language Filtering**: Explore trending repos across TypeScript, JavaScript, Python, Rust, Go, Swift, Kotlin, C++, and more.
- **Curated Topics**: Dedicated feeds for `AI & Agents`, `React Native`, `Rust`, `DevOps`, `Security`, `Mobile`, `Web3`, and `Developer Tools`.
- **Developer Discovery**: Explore high-impact open source creators with direct profiles.

### 2. 🔍 Dual-Scope Search
- **Segmented Search Switcher**:
  - `[ ⚡ My Repos ]`: 0ms local in-memory filtering across all your repositories.
  - `[ 🌐 All GitHub ]`: Debounced (350ms) background search across public GitHub repositories.
- **Clear Visual Scope Indicators**: Global results display owner avatars, full paths (`owner/repo`), and bright `🌐 Global` badges.
- **Smart Handoff**: If zero matches are found in your account, a 1-tap button immediately hands off to search across all of GitHub.

### 3. 📖 GitHub-Rendered HTML Markdown Engine
- Direct DOM rendering via `react-native-webview` matching GitHub.com 1:1.
- Flawless support for:
  - Shields.io and dynamic status badges
  - Multi-column Markdown tables with horizontal scrolling
  - Inline and block SVGs & emojis
  - Code blocks with syntax formatting
  - Interactive checklists & task items
  - `<themed-picture>` adaptive dark/light GitHub assets
- External links automatically open in system browser via `Linking.openURL()`.

### 4. 🎨 5 Dynamic Themes
- Switch instantly without reloading:
  1. **GitPulse Obsidian**: Deep space canvas (`#070B14`) with violet & cyan pulses.
  2. **GitHub Dimmed**: Soft slate dark canvas (`#22272E`) designed for long nighttime reading.
  3. **High-Contrast Dark**: Pure pitch black (`#010409`) with crisp borders.
  4. **GitHub Clean Light**: Official daylight white (`#FFFFFF`) with GitHub light accents.
  5. **Neon Cyberpunk**: High-voltage electric dark with neon rose, emerald & amber accents.

### 5. 🎛️ Modular Layout & Profile Customization
- **Modular Profile Sections**:
  - Reorder sections via drag-like touch controls.
  - Toggle visibility: Overview Metrics, 52-Week Contribution Heatmap, Pinned Repositories, Profile README, and Subtabs.
- **Compact vs Spacious Density**: Choose between dense code review cards or spacious browsing.
- **Default Subtab Configuration**: Customize default landing tabs for Repositories and Profiles.

### 6. 🌲 Tree Explorer & Syntax Code Viewer
- Directory navigation with breadcrumb path history.
- Monospace syntax viewer with line numbers and byte size tracking.
- Branch switcher (`main`, `master`, dev branches).

### 7. 🔀 Unified Diffs & Commits
- Full commit logs with author avatars, timestamp formatting, and SHA badges.
- Line-by-line diff inspection with green addition (`+`) and red deletion (`-`) highlights.

### 8. 📊 52-Week Contribution Heatmap
- Live contribution matrix derived from GitHub GraphQL API.
- Day-by-day commit inspector, current streak, and longest streak counters.

### 9. 💬 Issues, Pull Requests & Releases
- Filter by status: `Open`, `Closed`, `Merged`.
- Pull request review tracking and release changelogs with asset downloads.

### 10. ⚠️ Danger Zone (Repository Deletion)
- Toggleable feature in settings.
- Requires typing exact `owner/repo-name` in a GitHub-style safety modal before unlocking the delete action.

### 11. 🔔 Live Notifications Inbox & Sleep Prevention
- Thread triage for review requests, issue assignments, and commit mentions.
- `expo-keep-awake` prevents device screen timeout during long code reviews.

---

## 📱 Download & Install

Direct APK builds are published on GitHub Releases:

👉 **[Download Latest GitPulse APK](https://github.com/athanasso/gitpulse/releases/latest)**

---

## 📦 Package Identity

- **Name**: GitPulse
- **Slug**: `gitpulse`
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

GitPulse connects strictly to official GitHub REST (v3) and GraphQL (v4) APIs.
- Zero analytics, trackers, or middleman proxy servers.
- Personal Access Tokens (PAT) are stored locally in device `AsyncStorage`.
- Token scopes are audited live on the Profile screen.

---

## 📄 License

MIT © [Emmanouil Athanasopoulos](https://github.com/athanasso)
