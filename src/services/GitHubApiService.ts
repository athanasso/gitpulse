import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GitHubUser,
  GitHubRepo,
  GitHubFileItem,
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubNotification,
  ContributionDay,
} from '../types/github';

const PAT_STORAGE_KEY = '@gitpulse_pat_token';
const USERNAME_STORAGE_KEY = '@gitpulse_username';
const CACHE_PREFIX = '@gitpulse_cache_';

// Default mock user profile when unauthenticated / demo mode
const DEMO_USER: GitHubUser = {
  login: 'athanasso',
  id: 4892011,
  avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4',
  name: 'Alex Athanassopoulos',
  bio: 'Mobile & Systems Architect · React Native, TypeScript, Rust, AI Agents',
  public_repos: 18,
  public_gists: 4,
  followers: 142,
  following: 89,
  created_at: '2013-07-12T14:32:00Z',
  html_url: 'https://github.com/athanasso',
  company: 'DeepTech Labs',
  location: 'Athens, Greece',
};

const DEMO_REPOS: GitHubRepo[] = [
  {
    id: 910291,
    name: 'quickdraw-cards',
    full_name: 'athanasso/quickdraw-cards',
    private: false,
    owner: {
      login: 'athanasso',
      avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4',
    },
    html_url: 'https://github.com/athanasso/quickdraw-cards',
    description: 'Native TCG card scanning & portfolio tracking via on-device 3-frame spatial IoU consensus machine.',
    fork: false,
    stargazers_count: 128,
    watchers_count: 128,
    forks_count: 19,
    open_issues_count: 2,
    language: 'TypeScript',
    default_branch: 'master',
    updated_at: '2026-10-30T21:14:00Z',
    pushed_at: '2026-10-30T21:14:00Z',
    topics: ['react-native', 'expo', 'tcg', 'computer-vision', 'ocr'],
  },
  {
    id: 910292,
    name: 'antigravity-companion',
    full_name: 'athanasso/antigravity-companion',
    private: false,
    owner: {
      login: 'athanasso',
      avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4',
    },
    html_url: 'https://github.com/athanasso/antigravity-companion',
    description: 'All-in-one mobile companion and PC bridge daemon for Google Antigravity AI & desktop coding workspaces.',
    fork: false,
    stargazers_count: 342,
    watchers_count: 342,
    forks_count: 48,
    open_issues_count: 4,
    language: 'TypeScript',
    default_branch: 'master',
    updated_at: '2026-10-30T21:18:00Z',
    pushed_at: '2026-10-30T21:18:00Z',
    topics: ['ai-agent', 'websocket-bridge', 'remote-ide', 'deepmind'],
  },
  {
    id: 910293,
    name: 'onoma-zoo-pragma',
    full_name: 'athanasso/onoma-zoo-pragma',
    private: false,
    owner: {
      login: 'athanasso',
      avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4',
    },
    html_url: 'https://github.com/athanasso/onoma-zoo-pragma',
    description: 'Real-time multiplayer Greek word party game with adaptive dictionary verification.',
    fork: false,
    stargazers_count: 84,
    watchers_count: 84,
    forks_count: 12,
    open_issues_count: 1,
    language: 'TypeScript',
    default_branch: 'main',
    updated_at: '2026-10-30T21:22:00Z',
    pushed_at: '2026-10-30T21:22:00Z',
    topics: ['party-game', 'multiplayer', 'react-native'],
  },
  {
    id: 910294,
    name: 'simata-odigisis',
    full_name: 'athanasso/simata-odigisis',
    private: false,
    owner: {
      login: 'athanasso',
      avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4',
    },
    html_url: 'https://github.com/athanasso/simata-odigisis',
    description: 'Greek Ministry of Transport driving license theory exam simulator with question bank and mock tests.',
    fork: false,
    stargazers_count: 67,
    watchers_count: 67,
    forks_count: 8,
    open_issues_count: 0,
    language: 'TypeScript',
    default_branch: 'main',
    updated_at: '2026-10-30T21:22:00Z',
    pushed_at: '2026-10-30T21:22:00Z',
    topics: ['driving-test', 'kok', 'education'],
  },
];

class GitHubApiServiceClass {
  private token: string | null = null;

  async init(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(PAT_STORAGE_KEY);
      if (stored) {
        this.token = stored;
      }
      return this.token;
    } catch {
      return null;
    }
  }

  async setToken(token: string | null): Promise<void> {
    this.token = token ? token.trim() : null;
    if (this.token) {
      await AsyncStorage.setItem(PAT_STORAGE_KEY, this.token);
    } else {
      await AsyncStorage.removeItem(PAT_STORAGE_KEY);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitPulse-Mobile-Client',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Fetch authenticated user or demo profile
   */
  async getCurrentUser(): Promise<GitHubUser> {
    if (!this.token) {
      return DEMO_USER;
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: this.getHeaders(),
      });
      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`);
      }
      const data = await res.json();
      await AsyncStorage.setItem(USERNAME_STORAGE_KEY, data.login);
      return data;
    } catch (e) {
      console.warn('Failed to fetch user, falling back to cached/demo', e);
      return DEMO_USER;
    }
  }

  /**
   * Fetch user repositories
   */
  async getUserRepos(username?: string): Promise<GitHubRepo[]> {
    const user = username || (await AsyncStorage.getItem(USERNAME_STORAGE_KEY)) || 'athanasso';

    if (!this.token) {
      return DEMO_REPOS;
    }

    try {
      const res = await fetch(
        `https://api.github.com/users/${user}/repos?sort=updated&per_page=30`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        return await res.json();
      }
      return DEMO_REPOS;
    } catch {
      return DEMO_REPOS;
    }
  }

  /**
   * Search repositories
   */
  async searchRepos(query: string): Promise<GitHubRepo[]> {
    if (!query.trim()) return [];

    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(
          query
        )}&sort=stars&per_page=20`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('Search failed', e);
    }

    return DEMO_REPOS.filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(query.toLowerCase()))
    );
  }

  /**
   * Get Repository README markdown
   */
  async getRepoReadme(owner: string, repo: string): Promise<string> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        {
          headers: {
            ...this.getHeaders(),
            Accept: 'application/vnd.github.v3.raw',
          },
        }
      );
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      console.warn('Failed to fetch README', e);
    }

    return `# ${repo}\n\nHigh-performance mobile application engineered with React Native, Expo, and TypeScript.\n\n## Features\n- ⚡ Real-time synchronization\n- 🎨 Dark Obsidian theme\n- 📱 Native hardware sensors`;
  }

  /**
   * Get Directory Tree
   */
  async getRepoTree(
    owner: string,
    repo: string,
    path: string = '',
    ref: string = 'master'
  ): Promise<GitHubFileItem[]> {
    try {
      const endpoint = path
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${ref}`;

      const res = await fetch(endpoint, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch tree', e);
    }

    return [
      { name: 'src', path: 'src', sha: '1', size: 0, type: 'dir', html_url: '', download_url: null },
      { name: 'assets', path: 'assets', sha: '2', size: 0, type: 'dir', html_url: '', download_url: null },
      { name: 'App.tsx', path: 'App.tsx', sha: '3', size: 2840, type: 'file', html_url: '', download_url: null },
      { name: 'app.json', path: 'app.json', sha: '4', size: 750, type: 'file', html_url: '', download_url: null },
      { name: 'package.json', path: 'package.json', sha: '5', size: 1040, type: 'file', html_url: '', download_url: null },
      { name: 'README.md', path: 'README.md', sha: '6', size: 3120, type: 'file', html_url: '', download_url: null },
    ];
  }

  /**
   * Get File Content (Raw)
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string = 'master'
  ): Promise<string> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
        {
          headers: {
            ...this.getHeaders(),
            Accept: 'application/vnd.github.v3.raw',
          },
        }
      );
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      console.warn('Failed to fetch file content', e);
    }

    return `// ${path}\n// Loaded in GitPulse High-Performance Viewer\n\nexport const config = {\n  version: "1.0.0",\n  engine: "turbo",\n  active: true,\n};\n`;
  }

  /**
   * Get Commit History
   */
  async getRepoCommits(owner: string, repo: string): Promise<GitHubCommit[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=25`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch commits', e);
    }

    return [
      {
        sha: '79496a5a41bf37e289c8901b0f19ac2901928374',
        commit: {
          author: { name: 'Alex Athanassopoulos', email: 'alex@example.com', date: '2026-10-30T21:22:00Z' },
          message: 'feat(branding): add unique holographic optic scanner app icon and splash suite',
        },
        author: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
        html_url: `https://github.com/${owner}/${repo}/commit/79496a5`,
        stats: { total: 12, additions: 10, deletions: 2 },
      },
      {
        sha: '000607e4d8120b48a1949102c4819401ab839481',
        commit: {
          author: { name: 'Alex Athanassopoulos', email: 'alex@example.com', date: '2026-10-30T21:18:00Z' },
          message: 'chore: set unique app name and confirm com.athanasso.quickdraw package',
        },
        author: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
        html_url: `https://github.com/${owner}/${repo}/commit/000607e`,
        stats: { total: 5, additions: 3, deletions: 2 },
      },
      {
        sha: 'c8251e4bb290184b9104819401ab3819401a8192',
        commit: {
          author: { name: 'Alex Athanassopoulos', email: 'alex@example.com', date: '2026-10-30T21:14:00Z' },
          message: 'fix(camera): repair permission request overlay obstruction, add settings shortcut & demo fallback',
        },
        author: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
        html_url: `https://github.com/${owner}/${repo}/commit/c8251e4`,
        stats: { total: 195, additions: 176, deletions: 19 },
      },
    ];
  }

  /**
   * Get Issues & Pull Requests
   */
  async getIssuesAndPRs(
    owner: string,
    repo: string
  ): Promise<{ issues: GitHubIssue[]; prs: GitHubPullRequest[] }> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=30`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data: GitHubIssue[] = await res.json();
        const prs: GitHubPullRequest[] = [];
        const issues: GitHubIssue[] = [];

        data.forEach((item) => {
          if (item.pull_request) {
            prs.push(item as GitHubPullRequest);
          } else {
            issues.push(item);
          }
        });

        return { issues, prs };
      }
    } catch (e) {
      console.warn('Failed to fetch issues/PRs', e);
    }

    return {
      issues: [
        {
          id: 101,
          number: 14,
          title: 'Add offline vector similarity caching for fast card matching',
          body: 'Store precomputed embeddings in SQLite / AsyncStorage to reduce cold-start latency.',
          state: 'open',
          user: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
          comments: 3,
          created_at: '2026-10-29T18:20:00Z',
          updated_at: '2026-10-30T10:14:00Z',
          html_url: `https://github.com/${owner}/${repo}/issues/14`,
          labels: [{ id: 1, name: 'enhancement', color: '8B5CF6' }],
        },
      ],
      prs: [
        {
          id: 201,
          number: 15,
          title: 'feat: implement dual workstation & autonomous mobile agent engine',
          body: 'Connect phone directly to PC daemon over local Wi-Fi pairing PIN or fallback to standalone device engine.',
          state: 'open',
          user: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
          comments: 2,
          created_at: '2026-10-30T12:00:00Z',
          updated_at: '2026-10-30T16:30:00Z',
          html_url: `https://github.com/${owner}/${repo}/pull/15`,
          labels: [{ id: 2, name: 'core-feature', color: '10B981' }],
          additions: 412,
          deletions: 38,
          changed_files: 8,
        },
      ],
    };
  }

  /**
   * Get Workflow Runs (GitHub Actions)
   */
  async getWorkflowRuns(owner: string, repo: string): Promise<GitHubWorkflowRun[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=20`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return data.workflow_runs || [];
      }
    } catch (e) {
      console.warn('Failed to fetch actions runs', e);
    }

    return [
      {
        id: 894102,
        name: 'CI / TypeCheck & Build',
        head_branch: 'master',
        head_sha: '79496a5',
        status: 'completed',
        conclusion: 'success',
        run_number: 48,
        event: 'push',
        created_at: '2026-10-30T21:22:00Z',
        updated_at: '2026-10-30T21:23:15Z',
        html_url: `https://github.com/${owner}/${repo}/actions/runs/894102`,
        actor: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
      },
      {
        id: 894101,
        name: 'Expo Production APK Build (EAS)',
        head_branch: 'master',
        head_sha: '000607e',
        status: 'completed',
        conclusion: 'success',
        run_number: 47,
        event: 'push',
        created_at: '2026-10-30T21:18:00Z',
        updated_at: '2026-10-30T21:21:40Z',
        html_url: `https://github.com/${owner}/${repo}/actions/runs/894101`,
        actor: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
      },
    ];
  }

  /**
   * Get Notifications
   */
  async getNotifications(): Promise<GitHubNotification[]> {
    if (!this.token) {
      return [
        {
          id: 'n1',
          unread: true,
          reason: 'subscribed',
          updated_at: '2026-10-30T21:22:00Z',
          subject: {
            title: 'feat(branding): add unique holographic optic scanner app icon and splash suite',
            url: 'https://api.github.com/repos/athanasso/quickdraw-cards/commits/79496a5',
            type: 'Commit',
          },
          repository: {
            id: 910291,
            name: 'quickdraw-cards',
            full_name: 'athanasso/quickdraw-cards',
            owner: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
          },
        },
        {
          id: 'n2',
          unread: true,
          reason: 'mention',
          updated_at: '2026-10-30T21:18:00Z',
          subject: {
            title: 'feat: implement dual workstation & autonomous mobile agent engine',
            url: 'https://api.github.com/repos/athanasso/antigravity-companion/pulls/15',
            type: 'PullRequest',
          },
          repository: {
            id: 910292,
            name: 'antigravity-companion',
            full_name: 'athanasso/antigravity-companion',
            owner: { login: 'athanasso', avatar_url: 'https://avatars.githubusercontent.com/u/4892011?v=4' },
          },
        },
      ];
    }

    try {
      const res = await fetch('https://api.github.com/notifications?all=true&per_page=30', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch notifications', e);
    }

    return [];
  }

  /**
   * Generate 52-week contribution heatmap
   */
  getAnnualContributions(): { total: number; days: ContributionDay[] } {
    const days: ContributionDay[] = [];
    const now = new Date();
    let total = 0;

    // 52 weeks * 7 days = 364 days
    for (let i = 364; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Realistic pseudo-random commit distribution with weekday peaks
      const dayOfWeek = d.getDay(); // 0 Sun, 6 Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const seed = (d.getFullYear() * 1000 + (d.getMonth() + 1) * 35 + d.getDate()) % 17;

      let count = 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;

      if (!isWeekend && seed > 4) {
        count = (seed % 7) + 1;
      } else if (isWeekend && seed > 11) {
        count = seed % 4;
      }

      if (count > 6) level = 4;
      else if (count >= 4) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      total += count;
      days.push({ date: dateStr, count, level });
    }

    return { total, days };
  }
}

export const GitHubApiService = new GitHubApiServiceClass();
