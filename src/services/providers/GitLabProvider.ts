import { IGitProvider } from './IGitProvider';
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
} from '../../types/provider';

export class GitLabProvider implements IGitProvider {
  readonly type: GitProviderType = 'gitlab';

  private getApiUrl(hostUrl?: string): string {
    let base = hostUrl && hostUrl.trim() ? hostUrl.trim() : 'https://gitlab.com';
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `https://${base}`;
    }
    base = base.replace(/\/api\/v4\/?$/, '').replace(/\/+$/, '');
    return `${base}/api/v4`;
  }

  private getHeaders(token: string): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'GitPulse-Mobile-App',
    };
    if (token && token.trim()) {
      headers['PRIVATE-TOKEN'] = token.trim();
    }
    return headers;
  }

  private getProjectIdentifier(owner: string, repo: string): string {
    const cleanRepo = (repo || '').trim();
    const cleanOwner = (owner || '').trim();

    // 1. Direct numeric ID (GitLab API v4 natively accepts project ID)
    if (/^\d+$/.test(cleanRepo)) return cleanRepo;
    if (/^\d+$/.test(cleanOwner)) return cleanOwner;

    // 2. Already full path in repo
    const strippedOwner = cleanOwner.replace(/^\/+|\/+$/g, '');
    const strippedRepo = cleanRepo.replace(/^\/+|\/+$/g, '');

    if (!strippedOwner) {
      return encodeURIComponent(strippedRepo);
    }
    if (strippedRepo.startsWith(`${strippedOwner}/`)) {
      return encodeURIComponent(strippedRepo);
    }
    return encodeURIComponent(`${strippedOwner}/${strippedRepo}`);
  }

  async validateToken(token: string, hostUrl?: string): Promise<UnifiedUser> {
    const api = this.getApiUrl(hostUrl);
    const res = await fetch(`${api}/user`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Invalid GitLab Personal Access Token.'
          : `GitLab connection error (${res.status}).`
      );
    }

    const data = await res.json();
    return {
      id: data.id,
      login: data.username,
      name: data.name || data.username,
      avatar_url: data.avatar_url || '',
      html_url: data.web_url || `https://gitlab.com/${data.username}`,
      bio: data.bio || null,
      public_repos: 0,
      followers: data.followers || 0,
      following: data.following || 0,
      location: data.location || null,
      company: data.organization || null,
      blog: data.website_url || null,
      provider: 'gitlab',
    };
  }

  async getTokenScopes(token: string, hostUrl?: string): Promise<string[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const res = await fetch(`${api}/personal_access_tokens/self`, {
        headers: this.getHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.scopes)) {
          return data.scopes;
        }
      }
      const scopes: string[] = ['read_user'];
      const repoCheck = await fetch(`${api}/projects?membership=true&per_page=1`, {
        headers: this.getHeaders(token),
      });
      if (repoCheck.ok) {
        scopes.push('read_repository', 'write_repository');
      }
      return scopes;
    } catch {
      return ['read_user', 'read_repository'];
    }
  }

  async getUserRepos(
    token: string,
    hostUrl: string | undefined,
    page: number,
    perPage: number
  ): Promise<UnifiedRepo[]> {
    const api = this.getApiUrl(hostUrl);
    const url = `${api}/projects?membership=true&per_page=${perPage}&page=${page}&order_by=updated_at`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((p: any) => this.mapGitLabProject(p));
  }

  private mapGitLabProject(p: any): UnifiedRepo {
    const ownerLogin =
      p.namespace?.full_path ||
      p.namespace?.path ||
      p.namespace?.name ||
      (p.path_with_namespace ? p.path_with_namespace.substring(0, p.path_with_namespace.lastIndexOf('/')) : 'gitlab');
    const repoSlug = p.path || p.name;
    const fullPath = p.path_with_namespace || `${ownerLogin}/${repoSlug}`;

    return {
      id: p.id,
      name: repoSlug,
      full_name: fullPath,
      private: p.visibility === 'private' || p.visibility === 'internal',
      description: p.description || null,
      fork: !!p.forked_from_project,
      html_url: p.web_url,
      stargazers_count: p.star_count || 0,
      watchers_count: p.star_count || 0,
      forks_count: p.forks_count || 0,
      open_issues_count: p.open_issues_count || 0,
      default_branch: p.default_branch || 'main',
      language: null,
      updated_at: p.last_activity_at || p.updated_at || new Date().toISOString(),
      pushed_at: p.last_activity_at || p.updated_at || new Date().toISOString(),
      created_at: p.created_at || new Date().toISOString(),
      owner: {
        login: ownerLogin,
        avatar_url: p.avatar_url || p.namespace?.avatar_url || '',
      },
      provider: 'gitlab',
    };
  }

  async getRepoReadme(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<string> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const headers = this.getHeaders(token);

    // 1. Detect default branch from project metadata
    let defaultBranch = 'main';
    try {
      const projRes = await fetch(`${api}/projects/${projId}`, { headers });
      if (projRes.ok) {
        const projData = await projRes.json();
        if (projData.default_branch) {
          defaultBranch = projData.default_branch;
        }
      }
    } catch {
      // ignore
    }

    const branchesToTry = [defaultBranch, 'main', 'master'].filter(
      (b, idx, arr) => arr.indexOf(b) === idx
    );
    const readmeCandidates = ['README.md', 'readme.md', 'README', 'README.txt', 'Readme.md'];

    for (const br of branchesToTry) {
      for (const file of readmeCandidates) {
        try {
          const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(file)}/raw?ref=${encodeURIComponent(br)}`;
          const res = await fetch(url, { headers });
          if (res.ok) {
            return await res.text();
          }
        } catch {
          // try next
        }
      }
    }
    return '';
  }

  async getRepoBranches(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedBranch[]> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const url = `${api}/projects/${projId}/repository/branches?per_page=100`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((b: any) => ({
      name: b.name,
      commit: {
        sha: b.commit?.id || '',
        url: b.commit?.web_url || '',
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
    const projId = this.getProjectIdentifier(owner, repo);
    const pathParam = path ? `&path=${encodeURIComponent(path)}` : '';
    const refParam = branch ? `&ref=${encodeURIComponent(branch)}` : '';

    let url = `${api}/projects/${projId}/repository/tree?per_page=100${pathParam}${refParam}`;
    let res = await fetch(url, { headers: this.getHeaders(token) });

    // Fallback: if explicit ref failed (e.g. branch is main but repo uses master), retry without ref (uses default branch)
    if (!res.ok && refParam) {
      url = `${api}/projects/${projId}/repository/tree?per_page=100${pathParam}`;
      res = await fetch(url, { headers: this.getHeaders(token) });
    }

    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => ({
      name: item.name,
      path: item.path,
      sha: item.id,
      size: 0,
      url: '',
      html_url: '',
      git_url: '',
      download_url: '',
      type: item.type === 'tree' ? 'dir' : 'file',
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
    const projId = this.getProjectIdentifier(owner, repo);

    let url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`;
    let res = await fetch(url, { headers: this.getHeaders(token) });
    if (res.ok) return await res.text();

    if (branch === 'main') {
      url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}/raw?ref=master`;
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
    branch?: string,
    page: number = 1,
    perPage: number = 30,
    path?: string
  ): Promise<UnifiedCommit[]> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const queryPath = path ? `&path=${encodeURIComponent(path)}` : '';
    const refParam = branch ? `&ref_name=${encodeURIComponent(branch)}` : '';

    let url = `${api}/projects/${projId}/repository/commits?page=${page}&per_page=${perPage}${refParam}${queryPath}`;
    let res = await fetch(url, { headers: this.getHeaders(token) });

    // Fallback if branch ref not found
    if (!res.ok && refParam) {
      url = `${api}/projects/${projId}/repository/commits?page=${page}&per_page=${perPage}${queryPath}`;
      res = await fetch(url, { headers: this.getHeaders(token) });
    }

    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map((c: any) => ({
      sha: c.id,
      commit: {
        message: c.message || c.title || '',
        author: {
          name: c.author_name || 'GitLab User',
          email: c.author_email || '',
          date: c.authored_date || c.created_at || new Date().toISOString(),
        },
      },
      html_url: c.web_url || '',
      author: {
        login: c.author_name || 'GitLab',
        avatar_url: '',
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
    const projId = this.getProjectIdentifier(owner, repo);

    const [issuesRes, mrsRes] = await Promise.all([
      fetch(`${api}/projects/${projId}/issues?page=${page}&per_page=${perPage}`, {
        headers: this.getHeaders(token),
      }),
      fetch(`${api}/projects/${projId}/merge_requests?page=${page}&per_page=${perPage}`, {
        headers: this.getHeaders(token),
      }),
    ]);

    const issuesData = issuesRes.ok ? await issuesRes.json() : [];
    const mrsData = mrsRes.ok ? await mrsRes.json() : [];

    const issues: UnifiedIssue[] = Array.isArray(issuesData)
      ? issuesData.map((i: any) => ({
          id: i.id,
          number: i.iid,
          title: i.title,
          body: i.description || null,
          state: i.state === 'opened' ? 'open' : 'closed',
          html_url: i.web_url,
          created_at: i.created_at,
          updated_at: i.updated_at,
          user: {
            login: i.author?.username || i.author?.name || 'User',
            avatar_url: i.author?.avatar_url || '',
          },
          comments: i.user_notes_count || 0,
          labels: Array.isArray(i.labels)
            ? i.labels.map((l: any, idx: number) => ({
                id: idx,
                name: typeof l === 'string' ? l : l.name || '',
                color: l.color ? l.color.replace('#', '') : '428bca',
              }))
            : [],
        }))
      : [];

    const prs: UnifiedPullRequest[] = Array.isArray(mrsData)
      ? mrsData.map((mr: any) => ({
          id: mr.id,
          number: mr.iid,
          title: mr.title,
          body: mr.description || null,
          state: mr.state === 'opened' ? 'open' : 'closed',
          html_url: mr.web_url,
          created_at: mr.created_at,
          updated_at: mr.updated_at,
          user: {
            login: mr.author?.username || mr.author?.name || 'User',
            avatar_url: mr.author?.avatar_url || '',
          },
          comments: mr.user_notes_count || 0,
          merged: mr.state === 'merged',
          draft: mr.draft || mr.work_in_progress || false,
          labels: Array.isArray(mr.labels)
            ? mr.labels.map((l: any, idx: number) => ({
                id: idx,
                name: typeof l === 'string' ? l : l.name || '',
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
    const url = `${api}/projects?search=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&order_by=updated_at`;
    const res = await fetch(url, { headers: this.getHeaders(token || '') });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list.map((p: any) => this.mapGitLabProject(p));
  }

  async isRepoStarred(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const res = await fetch(`${api}/projects/${projId}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) return false;
    const project = await res.json();
    return !!project.starred;
  }

  async starRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const res = await fetch(`${api}/projects/${projId}/star`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return res.ok;
  }

  async unstarRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const res = await fetch(`${api}/projects/${projId}/unstar`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return res.ok;
  }

  async deleteRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const res = await fetch(`${api}/projects/${projId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (res.ok || res.status === 202) return { success: true };
    const errData = await res.json().catch(() => null);
    return {
      success: false,
      error: errData?.message || `Failed to delete GitLab project (${res.status}).`,
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
    _sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch,
        commit_message: message.trim() || `Update ${path}`,
        content,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, commitSha: data.file_path };
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
    _sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string }> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch,
        commit_message: message.trim() || `Delete ${path}`,
      }),
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
      const projId = this.getProjectIdentifier(owner, repo);
      const url = `${api}/projects/${projId}/repository/branches?branch=${encodeURIComponent(branchName)}&ref=${encodeURIComponent(fromBranchOrSha)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(token),
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
      const projId = this.getProjectIdentifier(owner, repo);
      const url = `${api}/projects/${projId}/repository/branches/${encodeURIComponent(branchName)}`;
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
      const projId = this.getProjectIdentifier(owner, repo);
      // Create MR then accept/merge
      const mrRes = await fetch(`${api}/projects/${projId}/merge_requests`, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_branch: head,
          target_branch: baseBranch,
          title: commitMessage || `Merge ${head} into ${baseBranch}`,
        }),
      });
      const mrData = await mrRes.json().catch(() => ({}));
      if (!mrRes.ok) {
        return { success: false, message: mrData.message || `HTTP ${mrRes.status}` };
      }

      const mergeRes = await fetch(
        `${api}/projects/${projId}/merge_requests/${mrData.iid}/merge`,
        {
          method: 'PUT',
          headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merge_commit_message: commitMessage || undefined,
          }),
        }
      );
      const mergeData = await mergeRes.json().catch(() => ({}));
      if (mergeRes.ok) {
        return { success: true, sha: mergeData.merge_commit_sha };
      }
      return { success: false, message: mergeData.message || `MR #${mrData.iid} created but auto-merge returned ${mergeRes.status}` };
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
      const projId = this.getProjectIdentifier(owner, repo);
      const res = await fetch(`${api}/projects/${projId}/merge_requests`, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_branch: head,
          target_branch: baseBranch,
          title,
          description: body || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, url: data.web_url, number: data.iid };
      }
      return { success: false, message: Array.isArray(data.message) ? data.message.join('; ') : data.message || `HTTP ${res.status}` };
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
      const projId = this.getProjectIdentifier(owner, repo);
      const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch,
          commit_message: message.trim() || `Add ${path}`,
          content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 201) {
        return { success: true, commitSha: data.file_path };
      }
      return { success: false, message: data.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error' };
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
      const projId = this.getProjectIdentifier(owner, repo);
      const res = await fetch(`${api}/projects/${projId}/languages`, {
        headers: this.getHeaders(token),
      });
      if (!res.ok) return {};
      const data = await res.json();
      if (data && typeof data === 'object') {
        // GitLab returns percentage e.g. { "TypeScript": 65.5, "JavaScript": 34.5 }
        // Convert to integers (e.g. * 1000) for byte-like breakdown calculation
        const result: Record<string, number> = {};
        for (const [lang, val] of Object.entries(data)) {
          if (typeof val === 'number') {
            result[lang] = Math.round(val * 1000);
          }
        }
        return result;
      }
      return {};
    } catch {
      return {};
    }
  }

  async getRepoContributors(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedContributor[]> {
    try {
      const api = this.getApiUrl(hostUrl);
      const projId = this.getProjectIdentifier(owner, repo);
      const res = await fetch(`${api}/projects/${projId}/repository/contributors?per_page=30`, {
        headers: this.getHeaders(token),
      });
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      return list.map((c: any) => ({
        login: c.name || c.email || 'GitLab User',
        id: 0,
        node_id: '',
        avatar_url: '',
        gravatar_id: '',
        url: '',
        html_url: '',
        followers_url: '',
        following_url: '',
        gists_url: '',
        starred_url: '',
        subscriptions_url: '',
        organizations_url: '',
        repos_url: '',
        events_url: '',
        received_events_url: '',
        type: 'User',
        site_admin: false,
        contributions: c.commits || 0,
      }));
    } catch {
      return [];
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
      const projId = this.getProjectIdentifier(owner, repo);
      const res = await fetch(`${api}/projects/${projId}/releases?page=${page}&per_page=${perPage}`, {
        headers: this.getHeaders(token),
      });
      if (!res.ok) return [];
      const list = await res.json();
      if (!Array.isArray(list)) return [];
      return list.map((r: any, idx: number) => ({
        id: idx + 1,
        tag_name: r.tag_name || '',
        name: r.name || r.tag_name || 'Release',
        body: r.description || null,
        html_url: r._links?.self || '',
        created_at: r.created_at || r.released_at || new Date().toISOString(),
        published_at: r.released_at || r.created_at || new Date().toISOString(),
        draft: false,
        prerelease: false,
        author: {
          login: r.author?.name || r.author?.username || 'GitLab',
          avatar_url: r.author?.avatar_url || '',
        },
        assets: [],
      }));
    } catch {
      return [];
    }
  }
}

