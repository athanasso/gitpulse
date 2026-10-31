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
  GitHubGist,
  GitHubOrg,
  GitHubRelease,
  GitHubBranch,
  GitHubEvent,
  GitHubContributor,
  GitHubFollower,
} from '../types/github';

const PAT_STORAGE_KEY = '@gitpulse_pat_token';
const USER_CACHE_KEY = '@gitpulse_cached_user';

class GitHubApiServiceClass {
  private token: string | null = null;
  private cachedUser: GitHubUser | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  async init(): Promise<boolean> {
    if (this.initialized) return !!this.token;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(PAT_STORAGE_KEY),
          AsyncStorage.getItem(USER_CACHE_KEY),
        ]);

        if (storedToken) {
          this.token = storedToken;
        }
        if (storedUser) {
          try {
            this.cachedUser = JSON.parse(storedUser);
          } catch {
            this.cachedUser = null;
          }
        }

        this.initialized = true;
        return !!this.token;
      } catch {
        this.initialized = true;
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async setToken(token: string | null): Promise<GitHubUser | null> {
    const cleanToken = token ? token.trim() : null;

    if (!cleanToken) {
      this.token = null;
      this.cachedUser = null;
      await Promise.all([
        AsyncStorage.removeItem(PAT_STORAGE_KEY),
        AsyncStorage.removeItem(USER_CACHE_KEY),
      ]);
      return null;
    }

    // Verify token validity against official GitHub API
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'GitPulse-Mobile-App',
      },
    });

    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Invalid GitHub API token. Please check your token and try again.'
          : `GitHub API error (${res.status}).`
      );
    }

    const userData: GitHubUser = await res.json();
    this.token = cleanToken;
    this.cachedUser = userData;

    await Promise.all([
      AsyncStorage.setItem(PAT_STORAGE_KEY, cleanToken),
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData)),
    ]);

    return userData;
  }

  getToken(): string | null {
    return this.token;
  }

  getCachedUser(): GitHubUser | null {
    return this.cachedUser;
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
   * Fetch authenticated user profile using API key
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    await this.ensureInit();
    if (!this.token) {
      return null;
    }

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or revoked
          await this.setToken(null);
        }
        return this.cachedUser;
      }

      const data: GitHubUser = await res.json();
      this.cachedUser = data;
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn('Failed to fetch user with API key', e);
      return this.cachedUser;
    }
  }

  /**
   * Fetch authenticated user's repositories using API key
   */
  async getUserRepos(): Promise<GitHubRepo[]> {
    await this.ensureInit();
    if (!this.token) {
      return [];
    }

    try {
      const res = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch repositories', e);
      return [];
    }
  }

  /**
   * Search repositories via official GitHub Search API
   */
  async searchRepos(query: string): Promise<GitHubRepo[]> {
    await this.ensureInit();
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
   * Fetch repository README raw markdown
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
   * Fetch repository directory contents
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
      console.warn('Failed to fetch repo tree', e);
    }

    return [];
  }

  /**
   * Fetch raw file content
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
   * Fetch commit history for a repository
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<GitHubCommit[]> {
    try {
      const queryBranch = branch
        ? `?sha=${encodeURIComponent(branch)}&per_page=30`
        : '?per_page=30';
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
   * Fetch issues & pull requests
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
      console.warn('Failed to fetch repo issues/PRs', e);
    }

    return { issues: [], prs: [] };
  }

  /**
   * Fetch GitHub Actions workflow runs
   */
  async getWorkflowRuns(
    owner: string,
    repo: string
  ): Promise<GitHubWorkflowRun[]> {
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

  private lastNotificationError: string | null = null;

  getLastNotificationError(): string | null {
    return this.lastNotificationError;
  }

  /**
   * Fetch user notifications using API key
   */
  async getNotifications(): Promise<GitHubNotification[]> {
    await this.ensureInit();
    this.lastNotificationError = null;
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
      } else if (res.status === 403 || res.status === 401) {
        const errJson = await res.json().catch(() => null);
        this.lastNotificationError =
          errJson?.message ||
          'Your API token requires the "notifications" scope to access inbox.';
      }
    } catch (e: any) {
      console.warn('Failed to fetch notifications', e);
      this.lastNotificationError = e.message || 'Network error fetching notifications.';
    }

    return [];
  }

  /**
   * Mark a notification thread as read on GitHub
   */
  async markNotificationRead(threadId: string): Promise<boolean> {
    await this.ensureInit();
    if (!this.token) return false;
    try {
      const res = await fetch(
        `https://api.github.com/notifications/threads/${threadId}`,
        {
          method: 'PATCH',
          headers: this.getHeaders(),
        }
      );
      return res.status === 205 || res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Mark all notifications as read on GitHub
   */
  async markAllNotificationsRead(): Promise<boolean> {
    await this.ensureInit();
    if (!this.token) return false;
    try {
      const res = await fetch('https://api.github.com/notifications', {
        method: 'PUT',
        headers: {
          ...this.getHeaders(),
          'Content-Length': '0',
        },
        body: JSON.stringify({
          last_read_at: new Date().toISOString(),
        }),
      });
      return res.status === 205 || res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch authentic contribution calendar from official GitHub GraphQL API
   * Uses the viewer's token to fetch their exact official contribution calendar
   */
  async getContributions(): Promise<{ total: number; days: ContributionDay[] }> {
    await this.ensureInit();
    if (!this.token) {
      return { total: 0, days: [] };
    }

    try {
      const query = `
        query {
          viewer {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                    contributionLevel
                  }
                }
              }
            }
          }
        }
      `;

      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GitPulse-Mobile-App',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        console.warn('GitHub GraphQL contributions returned status', res.status);
        return { total: 0, days: [] };
      }

      const result = await res.json();
      const calendar =
        result?.data?.viewer?.contributionsCollection?.contributionCalendar;

      if (!calendar || !calendar.weeks) {
        return { total: 0, days: [] };
      }

      const total = calendar.totalContributions || 0;
      const days: ContributionDay[] = [];

      for (const week of calendar.weeks) {
        if (week.contributionDays && Array.isArray(week.contributionDays)) {
          for (const d of week.contributionDays) {
            let level: 0 | 1 | 2 | 3 | 4 = 0;
            switch (d.contributionLevel) {
              case 'FIRST_QUARTILE':
                level = 1;
                break;
              case 'SECOND_QUARTILE':
                level = 2;
                break;
              case 'THIRD_QUARTILE':
                level = 3;
                break;
              case 'FOURTH_QUARTILE':
                level = 4;
                break;
              default:
                level = 0;
            }

            days.push({
              date: d.date,
              count: d.contributionCount || 0,
              level,
            });
          }
        }
      }

      return { total, days };
    } catch (e) {
      console.warn('Failed to fetch official GraphQL contributions', e);
      return { total: 0, days: [] };
    }
  }

  /**
   * Fetch authenticated user's starred repositories
   */
  async getUserStarredRepos(): Promise<GitHubRepo[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const res = await fetch(
        'https://api.github.com/user/starred?per_page=100&sort=updated',
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch starred repos', e);
    }
    return [];
  }

  /**
   * Check if a repo is starred by authenticated user
   */
  async isRepoStarred(owner: string, repo: string): Promise<boolean> {
    await this.ensureInit();
    if (!this.token) return false;
    try {
      const res = await fetch(
        `https://api.github.com/user/starred/${owner}/${repo}`,
        { headers: this.getHeaders() }
      );
      return res.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Star a repository
   */
  async starRepo(owner: string, repo: string): Promise<boolean> {
    await this.ensureInit();
    if (!this.token) return false;
    try {
      const res = await fetch(
        `https://api.github.com/user/starred/${owner}/${repo}`,
        {
          method: 'PUT',
          headers: {
            ...this.getHeaders(),
            'Content-Length': '0',
          },
        }
      );
      return res.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Unstar a repository
   */
  async unstarRepo(owner: string, repo: string): Promise<boolean> {
    await this.ensureInit();
    if (!this.token) return false;
    try {
      const res = await fetch(
        `https://api.github.com/user/starred/${owner}/${repo}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );
      return res.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Fetch authenticated user's gists (public and secret)
   */
  async getGists(): Promise<GitHubGist[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const res = await fetch('https://api.github.com/gists?per_page=50', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch gists', e);
    }
    return [];
  }

  /**
   * Fetch authenticated user's organizations
   */
  async getOrgs(): Promise<GitHubOrg[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const res = await fetch('https://api.github.com/user/orgs?per_page=50', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch user orgs', e);
    }
    return [];
  }

  /**
   * Fetch followers
   */
  async getFollowers(username?: string): Promise<GitHubFollower[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const endpoint = username
        ? `https://api.github.com/users/${encodeURIComponent(username)}/followers?per_page=50`
        : 'https://api.github.com/user/followers?per_page=50';
      const res = await fetch(endpoint, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch followers', e);
    }
    return [];
  }

  /**
   * Fetch users following
   */
  async getFollowing(username?: string): Promise<GitHubFollower[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const endpoint = username
        ? `https://api.github.com/users/${encodeURIComponent(username)}/following?per_page=50`
        : 'https://api.github.com/user/following?per_page=50';
      const res = await fetch(endpoint, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch following', e);
    }
    return [];
  }

  /**
   * Fetch public user event stream
   */
  async getUserEvents(username?: string): Promise<GitHubEvent[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const user = username || this.cachedUser?.login;
      if (!user) return [];
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(user)}/events?per_page=50`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch user events', e);
    }
    return [];
  }

  /**
   * Fetch repository releases & binary assets
   */
  async getRepoReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch repo releases', e);
    }
    return [];
  }

  /**
   * Fetch repository branch list
   */
  async getRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch repo branches', e);
    }
    return [];
  }

  /**
   * Fetch repository language byte breakdown
   */
  async getRepoLanguages(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/languages`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return data && typeof data === 'object' ? data : {};
      }
    } catch (e) {
      console.warn('Failed to fetch repo languages', e);
    }
    return {};
  }

  /**
   * Fetch repository contributor leaderboards
   */
  async getRepoContributors(
    owner: string,
    repo: string
  ): Promise<GitHubContributor[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`,
        { headers: this.getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('Failed to fetch repo contributors', e);
    }
    return [];
  }
}

export const GitHubApiService = new GitHubApiServiceClass();
