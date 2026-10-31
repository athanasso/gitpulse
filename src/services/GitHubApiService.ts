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
const DEFAULT_USERNAME = 'athanasso';

class GitHubApiServiceClass {
  private token: string | null = null;
  private currentUsername: string = DEFAULT_USERNAME;

  async init(): Promise<{ token: string | null; username: string }> {
    try {
      const [storedToken, storedUsername] = await Promise.all([
        AsyncStorage.getItem(PAT_STORAGE_KEY),
        AsyncStorage.getItem(USERNAME_STORAGE_KEY),
      ]);

      if (storedToken) {
        this.token = storedToken;
      }
      if (storedUsername) {
        this.currentUsername = storedUsername;
      }

      return { token: this.token, username: this.currentUsername };
    } catch {
      return { token: null, username: this.currentUsername };
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

  async setUsername(username: string): Promise<void> {
    const clean = username.trim() || DEFAULT_USERNAME;
    this.currentUsername = clean;
    await AsyncStorage.setItem(USERNAME_STORAGE_KEY, clean);
  }

  getToken(): string | null {
    return this.token;
  }

  getUsername(): string {
    return this.currentUsername;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitPulse-Mobile-App',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Fetch authenticated user or target public user profile
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    try {
      const endpoint = this.token
        ? 'https://api.github.com/user'
        : `https://api.github.com/users/${encodeURIComponent(this.currentUsername)}`;

      const res = await fetch(endpoint, {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        console.warn(`GitHub API user fetch returned status ${res.status}`);
        return null;
      }

      const data = await res.json();
      if (data && data.login) {
        this.currentUsername = data.login;
        await AsyncStorage.setItem(USERNAME_STORAGE_KEY, data.login);
      }
      return data;
    } catch (e) {
      console.warn('Failed to fetch user profile', e);
      return null;
    }
  }

  /**
   * Fetch real repositories for current user
   */
  async getUserRepos(username?: string): Promise<GitHubRepo[]> {
    try {
      const target = username || this.currentUsername;
      let endpoint: string;

      if (this.token && (!username || username.toLowerCase() === this.currentUsername.toLowerCase())) {
        // Authenticated user gets both public and private repos
        endpoint = 'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator';
      } else {
        // Public user repos
        endpoint = `https://api.github.com/users/${encodeURIComponent(target)}/repos?sort=updated&per_page=100`;
      }

      const res = await fetch(endpoint, {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        console.warn(`GitHub API repos fetch returned status ${res.status}`);
        return [];
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch user repositories', e);
      return [];
    }
  }

  /**
   * Search repositories via real GitHub Search API
   */
  async searchRepos(query: string): Promise<GitHubRepo[]> {
    if (!query.trim()) return [];

    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(
          query
        )}&sort=stars&per_page=30`,
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      console.warn('Search repositories failed', e);
      return [];
    }
  }

  /**
   * Fetch real Repository README raw markdown
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

    return '';
  }

  /**
   * Fetch real Directory Tree contents
   */
  async getRepoTree(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<GitHubFileItem[]> {
    try {
      const queryRef = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const endpoint = path
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}${queryRef}`
        : `https://api.github.com/repos/${owner}/${repo}/contents${queryRef}`;

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
      console.warn('Failed to fetch repo directory contents', e);
    }

    return [];
  }

  /**
   * Fetch real File Content (Raw)
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    try {
      const queryRef = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}${queryRef}`,
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

    return '';
  }

  /**
   * Fetch real Commit History
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<GitHubCommit[]> {
    try {
      const queryBranch = branch ? `?sha=${encodeURIComponent(branch)}&per_page=30` : '?per_page=30';
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits${queryBranch}`,
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch repo commits', e);
    }

    return [];
  }

  /**
   * Fetch real Issues & Pull Requests
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
        const data = await res.json();
        if (Array.isArray(data)) {
          const prs: GitHubPullRequest[] = [];
          const issues: GitHubIssue[] = [];

          data.forEach((item: any) => {
            if (item.pull_request) {
              prs.push(item as GitHubPullRequest);
            } else {
              issues.push(item as GitHubIssue);
            }
          });

          return { issues, prs };
        }
      }
    } catch (e) {
      console.warn('Failed to fetch repo issues & PRs', e);
    }

    return { issues: [], prs: [] };
  }

  /**
   * Fetch real Workflow Runs (GitHub Actions)
   */
  async getWorkflowRuns(owner: string, repo: string): Promise<GitHubWorkflowRun[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=20`,
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
      }
    } catch (e) {
      console.warn('Failed to fetch actions workflow runs', e);
    }

    return [];
  }

  /**
   * Fetch real User Notifications (requires PAT)
   */
  async getNotifications(): Promise<GitHubNotification[]> {
    if (!this.token) {
      return [];
    }

    try {
      const res = await fetch(
        'https://api.github.com/notifications?all=true&per_page=50',
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch notifications', e);
    }

    return [];
  }

  /**
   * Fetch real annual contribution calendar
   */
  async getAnnualContributions(
    username?: string
  ): Promise<{ total: number; days: ContributionDay[] }> {
    const user = username || this.currentUsername;

    try {
      // Fetch authentic public GitHub contributions data
      const res = await fetch(
        `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}`
      );

      if (res.ok) {
        const data = await res.json();

        // Format in jogruber v4: data.contributions is array of { date, count, level }
        if (data.contributions && Array.isArray(data.contributions) && data.contributions.length > 0) {
          // Take the most recent 364 days (52 full weeks)
          const recentDays = data.contributions.slice(-364);
          let totalCount = 0;
          const days: ContributionDay[] = recentDays.map((d: any) => {
            const count = d.count || 0;
            totalCount += count;
            const level = (d.level >= 0 && d.level <= 4 ? d.level : 0) as 0 | 1 | 2 | 3 | 4;
            return {
              date: d.date,
              count,
              level,
            };
          });

          return { total: totalCount, days };
        }
      }
    } catch (e) {
      console.warn('Failed to fetch contributions from contributions API', e);
    }

    // Return zeroed out metrics if no data recorded / network error
    return { total: 0, days: [] };
  }
}

export const GitHubApiService = new GitHubApiServiceClass();
