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

export class BitbucketProvider implements IGitProvider {
  readonly type: GitProviderType = 'bitbucket';
  private readonly baseUrl = 'https://api.bitbucket.org/2.0';

  private getHeaders(token: string): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'GitPulse-Mobile-App',
    };

    if (token && token.trim()) {
      const clean = token.trim();
      // If user provided username:app_password, encode as Basic Auth
      if (clean.includes(':')) {
        const encoded = btoa(clean);
        headers.Authorization = `Basic ${encoded}`;
      } else {
        headers.Authorization = `Bearer ${clean}`;
      }
    }
    return headers;
  }

  async validateToken(token: string): Promise<UnifiedUser> {
    const res = await fetch(`${this.baseUrl}/user`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Invalid Bitbucket credentials (use username:app_password).'
          : `Bitbucket connection error (${res.status}).`
      );
    }

    const data = await res.json();
    const login = data.username || data.nickname || data.account_id || 'user';
    return {
      id: data.uuid || login,
      login,
      name: data.display_name || login,
      avatar_url: data.links?.avatar?.href || '',
      html_url: data.links?.html?.href || `https://bitbucket.org/${login}`,
      bio: null,
      public_repos: 0,
      followers: 0,
      following: 0,
      location: data.location || null,
      company: null,
      blog: data.website || null,
      provider: 'bitbucket',
    };
  }

  async getUserRepos(
    token: string,
    _hostUrl: string | undefined,
    page: number,
    perPage: number
  ): Promise<UnifiedRepo[]> {
    const url = `${this.baseUrl}/repositories?role=member&page=${page}&pagelen=${perPage}&sort=-updated_on`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.values;
    if (!Array.isArray(list)) return [];

    return list.map((r: any) => this.mapBitbucketRepo(r));
  }

  private mapBitbucketRepo(r: any): UnifiedRepo {
    const ownerName = r.owner?.nickname || r.owner?.username || r.owner?.display_name || 'user';
    return {
      id: r.uuid || r.full_name,
      name: r.name,
      full_name: r.full_name || `${ownerName}/${r.name}`,
      private: !!r.is_private,
      description: r.description || null,
      fork: !!r.parent,
      html_url: r.links?.html?.href || `https://bitbucket.org/${r.full_name}`,
      stargazers_count: 0,
      watchers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      default_branch: r.mainbranch?.name || 'main',
      language: r.language || null,
      updated_at: r.updated_on || new Date().toISOString(),
      pushed_at: r.updated_on || new Date().toISOString(),
      created_at: r.created_on || new Date().toISOString(),
      owner: {
        login: ownerName,
        avatar_url: r.owner?.links?.avatar?.href || '',
      },
      provider: 'bitbucket',
    };
  }

  async getRepoReadme(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<string> {
    const candidates = ['README.md', 'readme.md', 'README'];
    for (const file of candidates) {
      try {
        const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/src/HEAD/${file}`;
        const res = await fetch(url, { headers: this.getHeaders(token) });
        if (res.ok) return await res.text();
      } catch {
        // try next
      }
    }
    return '';
  }

  async getRepoBranches(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedBranch[]> {
    const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refs/branches?pagelen=100`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.values;
    if (!Array.isArray(list)) return [];

    return list.map((b: any) => ({
      name: b.name,
      commit: {
        sha: b.target?.hash || '',
        url: b.target?.links?.html?.href || '',
      },
      protected: false,
    }));
  }

  async getRepoTree(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<UnifiedFileItem[]> {
    const cleanPath = path ? `/${encodeURIComponent(path)}` : '';
    const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/src/${encodeURIComponent(branch)}${cleanPath}?pagelen=100`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.values;
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => ({
      name: item.path.split('/').pop() || item.path,
      path: item.path,
      sha: item.commit?.hash || '',
      size: item.size || 0,
      url: item.links?.self?.href || '',
      html_url: item.links?.html?.href || '',
      git_url: '',
      download_url: '',
      type: item.type === 'commit_directory' ? 'dir' : 'file',
    }));
  }

  async getFileContent(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<string> {
    const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/src/${encodeURIComponent(branch)}/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (res.ok) return await res.text();
    return '';
  }

  async getRepoCommits(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string,
    branch: string = 'main',
    page: number = 1,
    perPage: number = 30
  ): Promise<UnifiedCommit[]> {
    const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}?page=${page}&pagelen=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.values;
    if (!Array.isArray(list)) return [];

    return list.map((c: any) => ({
      sha: c.hash,
      commit: {
        message: c.message || '',
        author: {
          name: c.author?.user?.display_name || c.author?.raw || 'User',
          email: '',
          date: c.date || new Date().toISOString(),
        },
      },
      html_url: c.links?.html?.href || '',
      author: {
        login: c.author?.user?.nickname || c.author?.user?.display_name || 'User',
        avatar_url: c.author?.user?.links?.avatar?.href || '',
      },
    }));
  }

  async getIssuesAndPRs(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ issues: UnifiedIssue[]; prs: UnifiedPullRequest[] }> {
    const [issuesRes, prsRes] = await Promise.all([
      fetch(
        `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?page=${page}&pagelen=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
      fetch(
        `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pullrequests?page=${page}&pagelen=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
    ]);

    const issuesData = issuesRes.ok ? await issuesRes.json() : { values: [] };
    const prsData = prsRes.ok ? await prsRes.json() : { values: [] };

    const issues: UnifiedIssue[] = Array.isArray(issuesData.values)
      ? issuesData.values.map((i: any) => ({
          id: i.id,
          number: i.id,
          title: i.title,
          body: i.content?.raw || null,
          state: i.state === 'open' || i.state === 'new' ? 'open' : 'closed',
          html_url: i.links?.html?.href || '',
          created_at: i.created_on,
          updated_at: i.updated_on,
          user: {
            login: i.reporter?.nickname || i.reporter?.display_name || 'User',
            avatar_url: i.reporter?.links?.avatar?.href || '',
          },
          comments: 0,
          labels: [],
        }))
      : [];

    const prs: UnifiedPullRequest[] = Array.isArray(prsData.values)
      ? prsData.values.map((pr: any) => ({
          id: pr.id,
          number: pr.id,
          title: pr.title,
          body: pr.description || null,
          state: pr.state === 'OPEN' ? 'open' : 'closed',
          html_url: pr.links?.html?.href || '',
          created_at: pr.created_on,
          updated_at: pr.updated_on,
          user: {
            login: pr.author?.nickname || pr.author?.display_name || 'User',
            avatar_url: pr.author?.links?.avatar?.href || '',
          },
          comments: pr.comment_count || 0,
          merged: pr.state === 'MERGED',
          draft: false,
          labels: [],
        }))
      : [];

    return { issues, prs };
  }

  async searchRepos(
    query: string,
    page: number = 1,
    perPage: number = 20,
    token?: string
  ): Promise<UnifiedRepo[]> {
    const url = `${this.baseUrl}/repositories?q=name~"${encodeURIComponent(query)}"&page=${page}&pagelen=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token || '') });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.values;
    if (!Array.isArray(list)) return [];
    return list.map((r: any) => this.mapBitbucketRepo(r));
  }

  async isRepoStarred(): Promise<boolean> {
    return false;
  }

  async starRepo(): Promise<boolean> {
    return false;
  }

  async unstarRepo(): Promise<boolean> {
    return false;
  }

  async deleteRepo(
    token: string,
    _hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> {
    const url = `${this.baseUrl}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (res.status === 204 || res.ok) return { success: true };
    return {
      success: false,
      error: `Failed to delete Bitbucket repository (${res.status}).`,
    };
  }
}

