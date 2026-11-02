import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheService, CacheKeys } from './CacheService';
import { AccountService } from './AccountService';
import { GitService } from './GitService';
import { utf8ToBase64 } from '../utils/base64';
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
  GitHubSocialAccount,
  GitHubPinnedItem,
} from '../types/github';

const PAT_STORAGE_KEY = '@gitpulse_pat_token';
const USER_CACHE_KEY = '@gitpulse_cached_user';
const SCOPES_STORAGE_KEY = '@gitpulse_token_scopes';

class GitHubApiServiceClass {
  private token: string | null = null;
  private cachedUser: GitHubUser | null = null;
  private tokenScopes: string[] = [];
  private lastSearchTotalCount: number = 0;
  private initialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  async init(): Promise<boolean> {
    if (this.initialized) return !!this.token;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [storedToken, storedUser, storedScopes] = await Promise.all([
          AsyncStorage.getItem(PAT_STORAGE_KEY),
          AsyncStorage.getItem(USER_CACHE_KEY),
          AsyncStorage.getItem(SCOPES_STORAGE_KEY),
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
        if (storedScopes) {
          try {
            this.tokenScopes = JSON.parse(storedScopes);
          } catch {
            this.tokenScopes = [];
          }
        }

        // Multi-account initialization & subscription
        await AccountService.init();
        const activeAcc = AccountService.getActiveAccount();
        if (activeAcc) {
          this.token = activeAcc.token;
          if (activeAcc.provider !== 'github') {
            this.cachedUser = {
              id: 1,
              login: activeAcc.username,
              name: activeAcc.displayName,
              avatar_url: activeAcc.avatarUrl || '',
              html_url: activeAcc.hostUrl || '',
              public_repos: 0,
              followers: 0,
              following: 0,
              created_at: new Date(activeAcc.createdAt).toISOString(),
              updated_at: new Date().toISOString(),
            } as GitHubUser;
          }
        }

        AccountService.subscribe((acc) => {
          if (acc) {
            this.token = acc.token;
            if (acc.provider !== 'github') {
              this.cachedUser = {
                id: 1,
                login: acc.username,
                name: acc.displayName,
                avatar_url: acc.avatarUrl || '',
                html_url: acc.hostUrl || '',
                public_repos: 0,
                followers: 0,
                following: 0,
                created_at: new Date(acc.createdAt).toISOString(),
                updated_at: new Date().toISOString(),
              } as GitHubUser;
            }
          } else {
            this.token = null;
            this.cachedUser = null;
          }
        });

        // Warm up cached repositories and critical data into memory
        const keysToWarm = [CacheKeys.USER_REPOS_PAGE_1];
        if (this.cachedUser?.login) {
          keysToWarm.push(CacheKeys.PROFILE_BUNDLE(this.cachedUser.login));
        }
        await CacheService.warmup(keysToWarm);

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
      const removals: Promise<any>[] = [
        AsyncStorage.removeItem(PAT_STORAGE_KEY),
        AsyncStorage.removeItem(USER_CACHE_KEY),
        AsyncStorage.removeItem(SCOPES_STORAGE_KEY),
        CacheService.remove(CacheKeys.USER_REPOS_PAGE_1),
      ];
      if (this.cachedUser?.login) {
        removals.push(CacheService.remove(CacheKeys.PROFILE_BUNDLE(this.cachedUser.login)));
      }
      this.token = null;
      this.cachedUser = null;
      this.tokenScopes = [];
      await Promise.all(removals);
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

    const rawScopes = res.headers.get('x-oauth-scopes');
    this.tokenScopes = rawScopes
      ? rawScopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    await Promise.all([
      AsyncStorage.setItem(PAT_STORAGE_KEY, cleanToken),
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData)),
      AsyncStorage.setItem(SCOPES_STORAGE_KEY, JSON.stringify(this.tokenScopes)),
      AccountService.addAccount({
        provider: 'github',
        username: userData.login,
        displayName: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        token: cleanToken,
      }),
    ]);

    return userData;
  }

  getToken(): string | null {
    return this.token;
  }

  getCachedUser(): GitHubUser | null {
    return this.cachedUser;
  }

  getTokenScopes(): string[] {
    return this.tokenScopes;
  }

  hasScope(scope: string): boolean {
    return this.tokenScopes.includes(scope);
  }

  getLastSearchTotalCount(): number {
    return this.lastSearchTotalCount;
  }

  getUserTotalReposCount(): number {
    if (!this.cachedUser) return 0;
    return (
      (this.cachedUser.public_repos || 0) +
      (this.cachedUser.total_private_repos || 0)
    );
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      const u = await GitService.getCurrentUser();
      if (u) {
        this.cachedUser = u as GitHubUser;
        return this.cachedUser;
      }
      return this.cachedUser;
    }
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

      const rawScopes = res.headers.get('x-oauth-scopes');
      if (rawScopes !== null) {
        this.tokenScopes = rawScopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        await AsyncStorage.setItem(SCOPES_STORAGE_KEY, JSON.stringify(this.tokenScopes));
      }

      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn('Failed to fetch user with API key', e);
      return this.cachedUser;
    }
  }

  /**
   * Fetch authenticated user's repositories using API key with pagination
   */
  async getUserRepos(
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubRepo[]> {
    await this.ensureInit();
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return (await GitService.getUserRepos(page, per_page)) as GitHubRepo[];
    }
    if (!this.token) {
      return [];
    }

    try {
      const res = await fetch(
        `https://api.github.com/user/repos?sort=updated&page=${page}&per_page=${per_page}&affiliation=owner,collaborator`,
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (page === 1 && list.length > 0) {
        CacheService.set(CacheKeys.USER_REPOS_PAGE_1, list);
      }
      return list;
    } catch (e) {
      console.warn('Failed to fetch repositories', e);
      return [];
    }
  }

  /**
   * Get cached user repos from local storage immediately (0ms)
   */
  async getCachedUserRepos(): Promise<GitHubRepo[]> {
    return (await CacheService.get<GitHubRepo[]>(CacheKeys.USER_REPOS_PAGE_1)) || [];
  }

  /**
   * Search repositories via official GitHub Search API with pagination
   */
  async searchRepos(
    query: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubRepo[]> {
    await this.ensureInit();
    if (!query.trim()) return [];

    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      const results = (await GitService.searchRepos(query, page, per_page)) as GitHubRepo[];
      this.lastSearchTotalCount = results.length;
      return results;
    }

    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(
          query
        )}&sort=stars&page=${page}&per_page=${per_page}`,
        { headers: this.getHeaders() }
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      this.lastSearchTotalCount =
        typeof data.total_count === 'number' ? data.total_count : 0;
      return Array.isArray(data.items) ? data.items : [];
    } catch (e) {
      console.warn('Search repositories failed', e);
      return [];
    }
  }

  /**
   * Get Explore Trending repositories with time window and language filter
   */
  async getExploreTrending(
    timeframe: 'day' | 'week' | 'month' = 'week',
    language: string = '',
    page: number = 1,
    perPage: number = 20
  ): Promise<{ items: GitHubRepo[]; totalCount: number }> {
    await this.ensureInit();

    const d = new Date();
    if (timeframe === 'day') d.setDate(d.getDate() - 2);
    else if (timeframe === 'week') d.setDate(d.getDate() - 7);
    else if (timeframe === 'month') d.setDate(d.getDate() - 30);

    const cutoff = d.toISOString().split('T')[0];
    let query = `created:>=${cutoff}`;
    if (language && language !== 'All') {
      query += ` language:${language}`;
    }

    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(
          query
        )}&sort=stars&order=desc&page=${page}&per_page=${perPage}`,
        { headers: this.getHeaders() }
      );
      if (!res.ok) return { items: [], totalCount: 0 };
      const data = await res.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        totalCount: typeof data.total_count === 'number' ? data.total_count : 0,
      };
    } catch (e) {
      console.warn('getExploreTrending failed', e);
      return { items: [], totalCount: 0 };
    }
  }

  /**
   * Get Explore Repositories by Topic
   */
  async getExploreByTopic(
    topic: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<{ items: GitHubRepo[]; totalCount: number }> {
    await this.ensureInit();
    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=topic:${encodeURIComponent(
          topic
        )}&sort=stars&order=desc&page=${page}&per_page=${perPage}`,
        { headers: this.getHeaders() }
      );
      if (!res.ok) return { items: [], totalCount: 0 };
      const data = await res.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        totalCount: typeof data.total_count === 'number' ? data.total_count : 0,
      };
    } catch (e) {
      console.warn('getExploreByTopic failed', e);
      return { items: [], totalCount: 0 };
    }
  }

  /**
   * Get Popular Developers / Creators
   */
  async getExploreDevelopers(
    page: number = 1,
    perPage: number = 20
  ): Promise<{ items: GitHubUser[]; totalCount: number }> {
    await this.ensureInit();
    try {
      const res = await fetch(
        `https://api.github.com/search/users?q=followers:>1000&sort=followers&order=desc&page=${page}&per_page=${perPage}`,
        { headers: this.getHeaders() }
      );
      if (!res.ok) return { items: [], totalCount: 0 };
      const data = await res.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        totalCount: typeof data.total_count === 'number' ? data.total_count : 0,
      };
    } catch (e) {
      console.warn('getExploreDevelopers failed', e);
      return { items: [], totalCount: 0 };
    }
  }

  /**
   * Fetch repository README (GitHub rendered HTML or raw markdown)
   */
  async getRepoReadme(
    owner: string,
    repo: string,
    format: 'html' | 'raw' = 'html'
  ): Promise<string> {
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.getRepoReadme(owner, repo);
    }

    try {
      const acceptHeader =
        format === 'raw'
          ? 'application/vnd.github.v3.raw'
          : 'application/vnd.github.v3.html';

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        {
          headers: {
            ...this.getHeaders(),
            Accept: acceptHeader,
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
   * Fetch full repository data by owner and name
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
    await this.ensureInit();
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch repo', e);
      return null;
    }
  }

  /**
   * Fetch Profile README ({username}/{username}/README.md)
   */
  async getProfileReadme(
    username: string,
    format: 'html' | 'raw' = 'html'
  ): Promise<string> {
    if (!username) return '';
    return this.getRepoReadme(username, username, format);
  }

  /**
   * Fetch user's social accounts links
   */
  async getSocialAccounts(username?: string): Promise<GitHubSocialAccount[]> {
    await this.ensureInit();
    try {
      const endpoint = this.token
        ? 'https://api.github.com/user/social_accounts'
        : username
        ? `https://api.github.com/users/${username}/social_accounts`
        : null;

      if (!endpoint) return [];

      const res = await fetch(endpoint, {
        headers: this.getHeaders(),
      });

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch social accounts', e);
      return [];
    }
  }

  /**
   * Fetch user's pinned repositories using GraphQL API
   */
  async getPinnedItems(username?: string): Promise<GitHubPinnedItem[]> {
    await this.ensureInit();
    if (!this.token) return [];

    try {
      const targetLogin = username || this.cachedUser?.login;
      if (!targetLogin) return [];

      const query = `
        query($login: String!) {
          user(login: $login) {
            pinnedItems(first: 6, types: [REPOSITORY]) {
              nodes {
                ... on Repository {
                  id
                  name
                  nameWithOwner
                  description
                  isPrivate
                  isFork
                  stargazerCount
                  forkCount
                  url
                  primaryLanguage {
                    name
                    color
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
        body: JSON.stringify({
          query,
          variables: { login: targetLogin },
        }),
      });

      if (!res.ok) return [];
      const result = await res.json();
      const nodes = result?.data?.user?.pinnedItems?.nodes;
      return Array.isArray(nodes) ? nodes : [];
    } catch (e) {
      console.warn('Failed to fetch pinned items', e);
      return [];
    }
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return (await GitService.getRepoTree(owner, repo, path, ref)) as GitHubFileItem[];
    }

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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.getFileContent(owner, repo, path, ref);
    }

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
   * Commit and push file changes to repository
   */
  async updateFileContent(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.updateFileContent(
        owner,
        repo,
        path,
        content,
        message,
        sha,
        branch
      );
    }

    if (!this.isAuthenticated()) {
      return {
        success: false,
        message: 'Personal Access Token required with repo scope to push changes.',
      };
    }

    try {
      let fileSha = sha;
      // If SHA missing, fetch latest file metadata
      if (!fileSha) {
        const queryRef = branch ? `?ref=${encodeURIComponent(branch)}` : '';
        const metaRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}${queryRef}`,
          {
            headers: {
              ...this.getHeaders(),
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          fileSha = metaData.sha;
        }
      }

      const bodyPayload: Record<string, any> = {
        message: message.trim() || `Update ${path.split('/').pop() || path}`,
        content: utf8ToBase64(content),
      };

      if (fileSha) {
        bodyPayload.sha = fileSha;
      }
      if (branch) {
        bodyPayload.branch = branch;
      }

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            ...this.getHeaders(),
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return {
          success: true,
          message: 'Changes committed and pushed successfully!',
          commitSha: data.commit?.sha,
        };
      } else {
        const errMsg =
          data.message ||
          (res.status === 409
            ? 'Conflict: file has been modified concurrently. Reload and try again.'
            : res.status === 403
            ? 'Push denied: ensure your PAT has write/repo permissions.'
            : `HTTP ${res.status}: Failed to commit changes.`);
        return { success: false, message: errMsg };
      }
    } catch (e: any) {
      console.warn('updateFileContent error', e);
      return {
        success: false,
        message: e?.message || 'Network error occurred while pushing changes.',
      };
    }
  }

  /**
   * Fetch commit history for a repository with pagination
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    branch?: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubCommit[]> {
    await this.ensureInit();
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return (await GitService.getRepoCommits(owner, repo, branch, page, per_page)) as GitHubCommit[];
    }

    try {
      const queryBranch = branch ? `&sha=${encodeURIComponent(branch)}` : '';
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?page=${page}&per_page=${per_page}${queryBranch}`,
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
   * Fetch issues & pull requests with pagination
   */
  async getIssuesAndPRs(
    owner: string,
    repo: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<{ issues: GitHubIssue[]; prs: GitHubPullRequest[] }> {
    await this.ensureInit();
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return (await GitService.getIssuesAndPRs(owner, repo, page, per_page)) as {
        issues: GitHubIssue[];
        prs: GitHubPullRequest[];
      };
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=all&page=${page}&per_page=${per_page}`,
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
   * Fetch GitHub Actions workflow runs with pagination
   */
  async getWorkflowRuns(
    owner: string,
    repo: string,
    page: number = 1,
    per_page: number = 20
  ): Promise<GitHubWorkflowRun[]> {
    await this.ensureInit();
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?page=${page}&per_page=${per_page}`,
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
   * Fetch user notifications using API key with pagination
   */
  async getNotifications(
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubNotification[]> {
    await this.ensureInit();
    this.lastNotificationError = null;
    if (!this.token) {
      return [];
    }

    try {
      const res = await fetch(
        `https://api.github.com/notifications?all=true&page=${page}&per_page=${per_page}`,
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
   * Fetch total starred repositories count via REST Link header or fallback
   */
  async getStarredCount(username?: string): Promise<number> {
    await this.ensureInit();
    if (!this.token && !username) return 0;
    try {
      const endpoint = username
        ? `https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=1`
        : 'https://api.github.com/user/starred?per_page=1';
      const res = await fetch(endpoint, { headers: this.getHeaders() });
      if (!res.ok) return 0;
      const link = res.headers.get('link') || res.headers.get('Link');
      if (link) {
        const match = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
        if (match) return parseInt(match[1], 10);
      }
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch (e) {
      console.warn('Failed to fetch starred count', e);
      return 0;
    }
  }

  /**
   * Fetch authenticated user's starred repositories with pagination
   */
  async getUserStarredRepos(
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubRepo[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const res = await fetch(
        `https://api.github.com/user/starred?sort=updated&page=${page}&per_page=${per_page}`,
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.isRepoStarred(owner, repo);
    }
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.starRepo(owner, repo);
    }
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.unstarRepo(owner, repo);
    }
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
   * Delete a repository (requires delete_repo scope)
   * DELETE /repos/{owner}/{repo}
   */
  async deleteRepo(
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInit();
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return await GitService.deleteRepo(owner, repo);
    }
    if (!this.token) return { success: false, error: 'Authentication required.' };
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      if (res.status === 204) {
        return { success: true };
      }
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error:
          data.message ||
          (res.status === 403
            ? 'Forbidden: your Personal Access Token requires the "delete_repo" scope.'
            : `Failed to delete repository (${res.status}).`),
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Network error while deleting repository.',
      };
    }
  }

  /**
   * Fetch authenticated user's gists (public and secret) with pagination
   */
  async getGists(
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubGist[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const res = await fetch(
        `https://api.github.com/gists?page=${page}&per_page=${per_page}`,
        { headers: this.getHeaders() }
      );
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
  async getOrgs(username?: string): Promise<GitHubOrg[]> {
    await this.ensureInit();
    try {
      const isMe =
        !username ||
        (this.cachedUser &&
          this.cachedUser.login.toLowerCase() === username.toLowerCase());
      const endpoint = isMe
        ? 'https://api.github.com/user/orgs?per_page=100'
        : `https://api.github.com/users/${encodeURIComponent(username!)}/orgs?per_page=100`;
      const res = await fetch(endpoint, {
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
   * Fetch followers with pagination
   */
  async getFollowers(
    username?: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubFollower[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const endpoint = username
        ? `https://api.github.com/users/${encodeURIComponent(
            username
          )}/followers?page=${page}&per_page=${per_page}`
        : `https://api.github.com/user/followers?page=${page}&per_page=${per_page}`;
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
   * Fetch users following with pagination
   */
  async getFollowing(
    username?: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubFollower[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const endpoint = username
        ? `https://api.github.com/users/${encodeURIComponent(
            username
          )}/following?page=${page}&per_page=${per_page}`
        : `https://api.github.com/user/following?page=${page}&per_page=${per_page}`;
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
   * Fetch public user event stream with pagination
   */
  async getUserEvents(
    username?: string,
    page: number = 1,
    per_page: number = 30
  ): Promise<GitHubEvent[]> {
    await this.ensureInit();
    if (!this.token) return [];
    try {
      const user = username || this.cachedUser?.login;
      if (!user) return [];
      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(
          user
        )}/events?page=${page}&per_page=${per_page}`,
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
   * Fetch repository releases & binary assets with pagination
   */
  async getRepoReleases(
    owner: string,
    repo: string,
    page: number = 1,
    per_page: number = 20
  ): Promise<GitHubRelease[]> {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases?page=${page}&per_page=${per_page}`,
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
    const active = AccountService.getActiveAccount();
    if (active && active.provider !== 'github') {
      return (await GitService.getRepoBranches(owner, repo)) as GitHubBranch[];
    }

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
