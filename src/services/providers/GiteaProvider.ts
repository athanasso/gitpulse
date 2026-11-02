import { IGitProvider } from './IGitProvider';
import { utf8ToBase64 } from '../../utils/base64';
import {
  GitProviderType,
  UnifiedRepo,
  UnifiedUser,
  UnifiedCommit,
  UnifiedIssue,
  UnifiedPullRequest,
  UnifiedBranch,
  UnifiedFileItem,
  UnifiedRelease,
  UnifiedContributor,
  UnifiedNotification,
  UnifiedIssueComment,
} from '../../types/provider';
import { GitHubWorkflowRun, ContributionDay } from '../../types/github';

export class GiteaProvider implements IGitProvider {
  readonly type: GitProviderType = 'gitea';

  private getApiUrl(hostUrl?: string): string {
    const base = hostUrl && hostUrl.trim() ? hostUrl.trim().replace(/\/+$/, '') : 'https://codeberg.org';
    if (base.endsWith('/api/v1')) return base;
    return `${base}/api/v1`;
  }

  private getHeaders(token: string): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'GitPulse-Mobile-App',
    };
    if (token && token.trim()) {
      headers.Authorization = `token ${token.trim()}`;
    }
    return headers;
  }

  async validateToken(token: string, hostUrl?: string): Promise<UnifiedUser> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(`${api}/user`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Invalid Gitea / Codeberg Access Token.'
          : `Gitea connection error (${res.status}).`
      );
    }

    const data = await res.json();
    return {
      id: data.id,
      login: data.username || data.login,
      name: data.full_name || data.username,
      avatar_url: data.avatar_url || '',
      html_url: data.html_url || `${this.getApiUrl(hostUrl).replace('/api/v1', '')}/${data.username}`,
      bio: data.description || null,
      public_repos: 0,
      followers: data.followers_count || 0,
      following: data.following_count || 0,
      location: data.location || null,
      company: null,
      blog: data.website || null,
      provider: 'gitea',
    };
  }

  async getTokenScopes(token: string, hostUrl?: string): Promise<string[]> {
    const scopes: string[] = [];
    try {
      const api = this.getApiUrl(hostUrl);
      const headers = this.getHeaders(token);
      const [uRes, rRes, nRes] = await Promise.allSettled([
        fetch(`${api}/user`, { headers }),
        fetch(`${api}/user/repos?limit=1`, { headers }),
        fetch(`${api}/notifications?limit=1`, { headers }),
      ]);
      if (uRes.status === 'fulfilled' && uRes.value.ok) scopes.push('read:user');
      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        scopes.push('read:repository', 'write:repository');
      }
      if (nRes.status === 'fulfilled' && nRes.value.ok) {
        scopes.push('read:issue', 'read:notification');
      }
    } catch {}
    return scopes;
  }

  async getUserRepos(
    token: string,
    hostUrl: string | undefined,
    page: number,
    perPage: number
  ): Promise<UnifiedRepo[]> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/user/repos?page=${page}&limit=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((r: any) => this.mapGiteaRepo(r));
  }

  private mapGiteaRepo(r: any): UnifiedRepo {
    return {
      id: r.id,
      name: r.name,
      full_name: r.full_name || `${r.owner?.login || r.owner?.username}/${r.name}`,
      private: !!r.private,
      description: r.description || null,
      fork: !!r.fork,
      html_url: r.html_url,
      stargazers_count: r.stars_count || 0,
      watchers_count: r.stars_count || 0,
      forks_count: r.forks_count || 0,
      open_issues_count: r.open_issues_count || 0,
      default_branch: r.default_branch || 'main',
      language: null,
      updated_at: r.updated_at || new Date().toISOString(),
      pushed_at: r.updated_at || new Date().toISOString(),
      created_at: r.created_at || new Date().toISOString(),
      owner: {
        login: r.owner?.login || r.owner?.username || 'user',
        avatar_url: r.owner?.avatar_url || '',
      },
      provider: 'gitea',
    };
  }

  async getRepoReadme(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<string> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/README.md`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (res.ok) return await res.text();

    // Fallback try lowercase
    const fallbackRes = await fetch(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/readme.md`,
      { headers: this.getHeaders(token) }
    );
    if (fallbackRes.ok) return await fallbackRes.text();
    return '';
  }

  async getRepoBranches(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedBranch[]> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((b: any) => ({
      name: b.name,
      commit: {
        sha: b.commit?.id || '',
        url: '',
      },
      protected: b.protected || false,
    }));
  }

  async getRepoTree(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string = '',
    branch?: string
  ): Promise<UnifiedFileItem[]> {
    const api = this.getApiUrl(hostUrl);
    const cleanPath = path ? `/${encodeURIComponent(path)}` : '';
    const refParam = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    let url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${cleanPath}${refParam}`;
    let res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok && refParam) {
      url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${cleanPath}`;
      res = await fetch(url, { headers: this.getHeaders(token) });
    }
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.sha || item.submodule_git_sha || '',
      size: item.size || 0,
      url: item.url || '',
      html_url: item.html_url || '',
      git_url: item.git_url || '',
      download_url: item.download_url || '',
      type: item.type === 'dir' ? 'dir' : 'file',
    }));
  }

  async getFileContent(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<string> {
    const api = this.getApiUrl(hostUrl);
    let url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    let res = await fetch(url, { headers: this.getHeaders(token) });
    if (res.ok) return await res.text();
    if (branch === 'main') {
      url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${encodeURIComponent(path)}`;
      res = await fetch(url, { headers: this.getHeaders(token) });
      if (res.ok) return await res.text();
    }
    return '';
  }

  async getRepoCommits(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branch: string = 'main',
    page: number = 1,
    perPage: number = 30,
    path?: string
  ): Promise<UnifiedCommit[]> {
    const api = this.getApiUrl(hostUrl);
    const queryPath = path ? `&path=${encodeURIComponent(path)}` : '';
    const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&page=${page}&limit=${perPage}${queryPath}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((c: any) => ({
      sha: c.sha,
      commit: {
        message: c.commit?.message || '',
        author: {
          name: c.commit?.author?.name || 'User',
          email: c.commit?.author?.email || '',
          date: c.commit?.author?.date || new Date().toISOString(),
        },
      },
      html_url: c.html_url || '',
      author: {
        login: c.author?.username || c.author?.login || 'User',
        avatar_url: c.author?.avatar_url || '',
      },
    }));
  }

  async getIssuesAndPRs(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ issues: UnifiedIssue[]; prs: UnifiedPullRequest[] }> {
    const api = this.getApiUrl(hostUrl);

    const [issuesRes, prsRes] = await Promise.all([
      fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&page=${page}&limit=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
      fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&page=${page}&limit=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
    ]);

    const issuesData = issuesRes.ok ? await issuesRes.json() : [];
    const prsData = prsRes.ok ? await prsRes.json() : [];

    const issues: UnifiedIssue[] = Array.isArray(issuesData)
      ? issuesData
          .filter((i: any) => !i.pull_request)
          .map((i: any) => ({
            id: i.id,
            number: i.number,
            title: i.title,
            body: i.body || null,
            state: i.state === 'open' ? 'open' : 'closed',
            html_url: i.html_url,
            created_at: i.created_at,
            updated_at: i.updated_at,
            user: {
              login: i.user?.username || i.user?.login || 'User',
              avatar_url: i.user?.avatar_url || '',
            },
            comments: i.comments || 0,
            labels: Array.isArray(i.labels)
              ? i.labels.map((l: any, idx: number) => ({
                  id: l.id || idx,
                  name: l.name || '',
                  color: l.color ? l.color.replace('#', '') : '428bca',
                }))
              : [],
          }))
      : [];

    const prs: UnifiedPullRequest[] = Array.isArray(prsData)
      ? prsData.map((pr: any) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          body: pr.body || null,
          state: pr.state === 'open' ? 'open' : 'closed',
          html_url: pr.html_url,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          user: {
            login: pr.user?.username || pr.user?.login || 'User',
            avatar_url: pr.user?.avatar_url || '',
          },
          comments: pr.comments || 0,
          merged: !!pr.merged,
          draft: !!pr.draft,
          labels: Array.isArray(pr.labels)
            ? pr.labels.map((l: any, idx: number) => ({
                id: l.id || idx,
                name: l.name || '',
                color: l.color ? l.color.replace('#', '') : '428bca',
              }))
            : [],
        }))
      : [];

    return { issues, prs };
  }

  async searchRepos(
    query: string,
    page: number = 1,
    perPage: number = 20,
    token?: string,
    hostUrl?: string
  ): Promise<UnifiedRepo[]> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/repos/search?q=${encodeURIComponent(query)}&page=${page}&limit=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token || '') });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.data || data;
    if (!Array.isArray(list)) return [];
    return list.map((r: any) => this.mapGiteaRepo(r));
  }

  async isRepoStarred(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(
      `${api}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: this.getHeaders(token) }
    );
    return res.status === 204 || res.status === 200;
  }

  async starRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(
      `${api}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'PUT', headers: this.getHeaders(token) }
    );
    return res.status === 204 || res.status === 200;
  }

  async unstarRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(
      `${api}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'DELETE', headers: this.getHeaders(token) }
    );
    return res.status === 204 || res.status === 200;
  }

  async deleteRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'DELETE', headers: this.getHeaders(token) }
    );
    if (res.status === 204 || res.ok) return { success: true };
    const errData = await res.json().catch(() => null);
    return {
      success: false,
      error: errData?.message || `Failed to delete Gitea repo (${res.status}).`,
    };
  }

  async updateFileContent(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const body: Record<string, any> = {
      message: message.trim() || `Update ${path}`,
      content: utf8ToBase64(content),
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, commitSha: data.commit?.sha };
    }
    return { success: false, message: data.message || `HTTP ${res.status}` };
  }

  async deleteFile(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string }> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const body: Record<string, any> = {
      message: message.trim() || `Delete ${path}`,
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 204) {
      return { success: true };
    }
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      message: err.message || `Failed to delete file (${res.status})`,
    };
  }

  async createBranch(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branchName: string,
    fromBranchOrSha: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_branch_name: branchName,
          old_branch_name: fromBranchOrSha,
        }),
      });
      if (res.status === 201 || res.ok) return { success: true };
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
    }
  }

  async deleteBranch(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branchName: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branchName)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(token),
      });
      if (res.status === 204 || res.ok) return { success: true };
      const data = await res.json().catch(() => ({}));
      return { success: false, message: data.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
    }
  }

  async mergeBranch(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    baseBranch: string,
    head: string,
    commitMessage?: string
  ): Promise<{ success: boolean; message?: string; sha?: string }> {
    try {
      const api = this.getApiUrl(hostUrl);
      // Create PR then merge it
      const prRes = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        {
          method: 'POST',
          headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: commitMessage || `Merge ${head} into ${baseBranch}`,
            head,
            base: baseBranch,
          }),
        }
      );
      const prData = await prRes.json().catch(() => ({}));
      if (!prRes.ok) {
        return { success: false, message: prData.message || `HTTP ${prRes.status}` };
      }

      const mergeRes = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prData.number}/merge`,
        {
          method: 'POST',
          headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Do: 'merge',
            MergeTitleField: commitMessage || `Merge pull request #${prData.number}`,
          }),
        }
      );
      if (mergeRes.ok) return { success: true };
      const mergeErr = await mergeRes.json().catch(() => ({}));
      return { success: false, message: mergeErr.message || `HTTP ${mergeRes.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
    }
  }

  async createPullRequest(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    title: string,
    head: string,
    baseBranch: string,
    body?: string
  ): Promise<{ success: boolean; message?: string; url?: string; number?: number }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        {
          method: 'POST',
          headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, head, base: baseBranch, body: body || '' }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, url: data.html_url, number: data.number };
      }
      return { success: false, message: data.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
    }
  }

  async createFile(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const url = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch,
          message: message.trim() || `Add ${path}`,
          content: utf8ToBase64(content),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 201) {
        return { success: true, commitSha: data.commit?.sha };
      }
      return { success: false, message: data.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
    }
  }

  async getNotifications(
    token: string,
    hostUrl: string | undefined,
    page: number = 1,
    perPage: number = 30
  ): Promise<UnifiedNotification[]> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/notifications?page=${page}&limit=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('Gitea token requires "read:notification" scope.');
      }
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((n: any) => ({
      id: String(n.id),
      unread: !!n.unread,
      reason: n.reason || 'mention',
      updated_at: n.updated_at || new Date().toISOString(),
      subject: {
        title: n.subject?.title || 'Notification',
        url: n.subject?.html_url || n.subject?.url || '',
        type: (n.subject?.type === 'Pull' ? 'PullRequest' : n.subject?.type || 'Issue') as any,
      },
      repository: {
        id: n.repository?.id || 0,
        name: n.repository?.name || 'Repository',
        full_name: n.repository?.full_name || 'Repository',
        owner: {
          login: n.repository?.owner?.login || n.repository?.owner?.username || 'Gitea',
          avatar_url: n.repository?.owner?.avatar_url || '',
        },
      },
    }));
  }

  async markNotificationRead(
    token: string,
    hostUrl: string | undefined,
    notificationId: string
  ): Promise<boolean> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(`${api}/notifications/threads/${notificationId}`, {
        method: 'PATCH',
        headers: this.getHeaders(token),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async markAllNotificationsRead(
    token: string,
    hostUrl: string | undefined
  ): Promise<boolean> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(`${api}/notifications?status-types=unread`, {
        method: 'PUT',
        headers: this.getHeaders(token),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getUserStarredRepos(
    token: string,
    hostUrl: string | undefined,
    page: number = 1,
    perPage: number = 30
  ): Promise<UnifiedRepo[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const url = `${api}/user/starred?page=${page}&limit=${perPage}`;
      const res = await fetch(url, { headers: this.getHeaders(token) });
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      return list.map((r: any) => this.mapGiteaRepo(r));
    } catch {
      return [];
    }
  }

  async getRepoLanguages(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
        { headers: this.getHeaders(token) }
      );
      if (!res.ok) return {};
      const data = await res.json();
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  async getRepoReleases(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<UnifiedRelease[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?page=${page}&limit=${perPage}`,
        { headers: this.getHeaders(token) }
      );
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      return list.map((r: any) => ({
        id: r.id,
        tag_name: r.tag_name || '',
        name: r.name || r.tag_name || 'Release',
        body: r.body || null,
        html_url: r.html_url || '',
        created_at: r.created_at || new Date().toISOString(),
        published_at: r.published_at || r.created_at || new Date().toISOString(),
        draft: !!r.draft,
        prerelease: !!r.prerelease,
        author: {
          login: r.author?.login || r.author?.username || 'Gitea',
          avatar_url: r.author?.avatar_url || '',
        },
        assets: [],
      }));
    } catch {
      return [];
    }
  }

  async getWorkflowRuns(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitHubWorkflowRun[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?page=${page}&limit=${perPage}`,
        { headers: this.getHeaders(token) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const runs = Array.isArray(data.workflow_runs)
        ? data.workflow_runs
        : Array.isArray(data)
        ? data
        : [];
      return runs.map((r: any) => ({
        id: r.id,
        name: r.title || r.name || `Run #${r.id}`,
        head_branch: r.head_branch || '',
        head_sha: r.head_sha || '',
        status:
          r.status === 'running'
            ? 'in_progress'
            : r.status === 'waiting'
            ? 'queued'
            : 'completed',
        conclusion:
          r.conclusion === 'success'
            ? 'success'
            : r.conclusion === 'failure'
            ? 'failure'
            : r.conclusion === 'cancelled'
            ? 'cancelled'
            : null,
        run_number: r.run_number || r.id,
        event: r.event || 'push',
        created_at: r.created_at || new Date().toISOString(),
        updated_at: r.updated_at || new Date().toISOString(),
        html_url: r.html_url || '',
        actor: {
          login: r.actor?.login || r.actor?.username || '',
          avatar_url: r.actor?.avatar_url || '',
        },
      }));
    } catch {
      return [];
    }
  }

  async getIssueComments(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    issueNumber: number,
    page: number = 1,
    perPage: number = 30
  ): Promise<UnifiedIssueComment[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments?page=${page}&limit=${perPage}`,
        { headers: this.getHeaders(token) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((c: any) => ({
        id: c.id,
        body: c.body || '',
        created_at: c.created || c.created_at || '',
        updated_at: c.updated || c.updated_at || '',
        user: {
          login: c.user?.login || c.user?.username || 'unknown',
          avatar_url: c.user?.avatar_url || '',
        },
      }));
    } catch {
      return [];
    }
  }

  async postIssueComment(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ success: boolean; comment?: UnifiedIssueComment }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            ...this.getHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      );
      if (!res.ok) return { success: false };
      const c = await res.json();
      return {
        success: true,
        comment: {
          id: c.id,
          body: c.body || '',
          created_at: c.created || c.created_at || '',
          updated_at: c.updated || c.updated_at || '',
          user: {
            login: c.user?.login || c.user?.username || '',
            avatar_url: c.user?.avatar_url || '',
          },
        },
      };
    } catch {
      return { success: false };
    }
  }

  async closeIssueOrPR(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    number: number,
    _type: 'issue' | 'pr'
  ): Promise<{ success: boolean }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        {
          method: 'PATCH',
          headers: {
            ...this.getHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: 'closed' }),
        }
      );
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }

  async reopenIssueOrPR(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    number: number,
    _type: 'issue' | 'pr'
  ): Promise<{ success: boolean }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        {
          method: 'PATCH',
          headers: {
            ...this.getHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: 'open' }),
        }
      );
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }

  async getUserContributions(
    token: string,
    hostUrl: string | undefined,
    username: string
  ): Promise<{ total: number; days: ContributionDay[] }> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(
        `${api}/users/${encodeURIComponent(username)}/heatmap`,
        { headers: this.getHeaders(token) }
      );
      if (!res.ok) return { total: 0, days: [] };
      const data: any[] = await res.json();
      if (!Array.isArray(data)) return { total: 0, days: [] };

      const countsByDate: Record<string, number> = {};
      let total = 0;
      for (const item of data) {
        const date = new Date(item.timestamp * 1000).toISOString().split('T')[0];
        const count = item.contributions || 1;
        countsByDate[date] = (countsByDate[date] || 0) + count;
        total += count;
      }

      const today = new Date();
      const days: ContributionDay[] = [];
      for (let i = 364; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = countsByDate[dateStr] || 0;
        const level: 0 | 1 | 2 | 3 | 4 =
          count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
        days.push({ date: dateStr, count, level });
      }

      return { total, days };
    } catch (e) {
      console.warn('Gitea contributions failed', e);
      return { total: 0, days: [] };
    }
  }

  async getOrgs(
    token: string,
    hostUrl: string | undefined
  ): Promise<any[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(`${api}/user/orgs?limit=50`, {
        headers: this.getHeaders(token),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data.map((org: any) => ({
        id: org.id,
        login: org.username || org.name,
        avatar_url: org.avatar_url || '',
        description: org.description || '',
        name: org.full_name || org.name,
        url: org.website || '',
        repos_url: '',
      }));
    } catch {
      return [];
    }
  }
}

