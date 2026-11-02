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
} from '../../types/provider';

export class GitLabProvider implements IGitProvider {
  readonly type: GitProviderType = 'gitlab';

  private getApiUrl(hostUrl?: string): string {
    const base = hostUrl && hostUrl.trim() ? hostUrl.trim().replace(/\/+$/, '') : 'https://gitlab.com';
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
    // If owner/repo, encode path
    return encodeURIComponent(`${owner}/${repo}`);
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
      p.namespace?.path || p.namespace?.name || (p.path_with_namespace ? p.path_with_namespace.split('/')[0] : 'gitlab');

    return {
      id: p.id,
      name: p.name || p.path,
      full_name: p.path_with_namespace || `${ownerLogin}/${p.name}`,
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

    // Try common README file names
    const readmeCandidates = ['README.md', 'readme.md', 'README', 'README.txt'];
    for (const file of readmeCandidates) {
      try {
        const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(file)}/raw`;
        const res = await fetch(url, { headers: this.getHeaders(token) });
        if (res.ok) {
          return await res.text();
        }
      } catch {
        // try next
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
    branch: string = 'main'
  ): Promise<UnifiedFileItem[]> {
    const api = this.getApiUrl(hostUrl);
    const projId = this.getProjectIdentifier(owner, repo);
    const pathParam = path ? `&path=${encodeURIComponent(path)}` : '';
    const url = `${api}/projects/${projId}/repository/tree?ref=${encodeURIComponent(branch)}${pathParam}&per_page=100`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
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
    const url = `${api}/projects/${projId}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (res.ok) return await res.text();
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
    const projId = this.getProjectIdentifier(owner, repo);
    const queryPath = path ? `&path=${encodeURIComponent(path)}` : '';
    const url = `${api}/projects/${projId}/repository/commits?ref_name=${encodeURIComponent(branch)}&page=${page}&per_page=${perPage}${queryPath}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
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
}

