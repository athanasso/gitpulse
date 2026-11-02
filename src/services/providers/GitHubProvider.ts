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
} from '../../types/provider';

export class GitHubProvider implements IGitProvider {
  readonly type: GitProviderType = 'github';

  private getBaseUrl(hostUrl?: string): string {
    if (!hostUrl || hostUrl.trim() === '') return 'https://api.github.com';
    return hostUrl.replace(/\/+$/, '');
  }

  private getHeaders(token: string): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitPulse-Mobile-App',
    };
    if (token && token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
    return headers;
  }

  async validateToken(token: string, hostUrl?: string): Promise<UnifiedUser> {
    const base = this.getBaseUrl(hostUrl);
    const res = await fetch(`${base}/user`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Invalid GitHub Personal Access Token.'
          : `GitHub connection error (${res.status}).`
      );
    }

    const data = await res.json();
    return {
      ...data,
      provider: 'github',
    };
  }

  async getUserRepos(
    token: string,
    hostUrl: string | undefined,
    page: number,
    perPage: number
  ): Promise<UnifiedRepo[]> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/user/repos?page=${page}&per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list.map((r) => ({ ...r, provider: 'github' }));
  }

  async getRepoReadme(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<string> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`;
    const headers = {
      ...this.getHeaders(token),
      Accept: 'application/vnd.github.v3.html',
    };
    const res = await fetch(url, { headers });
    if (res.ok) return await res.text();

    // Fallback raw markdown
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/README.md`
    );
    if (rawRes.ok) return await rawRes.text();
    return '';
  }

  async getRepoBranches(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedBranch[]> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getRepoTree(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<UnifiedFileItem[]> {
    const base = this.getBaseUrl(hostUrl);
    const cleanPath = path ? `/${encodeURIComponent(path)}` : '';
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${cleanPath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getFileContent(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<string> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: {
        ...this.getHeaders(token),
        Accept: 'application/vnd.github.v3.raw',
      },
    });
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
    const base = this.getBaseUrl(hostUrl);
    const queryPath = path ? `&path=${encodeURIComponent(path)}` : '';
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&page=${page}&per_page=${perPage}${queryPath}`;
    const res = await fetch(url, { headers: this.getHeaders(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async getIssuesAndPRs(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ issues: UnifiedIssue[]; prs: UnifiedPullRequest[] }> {
    const base = this.getBaseUrl(hostUrl);
    const [issuesRes, prsRes] = await Promise.all([
      fetch(
        `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&page=${page}&per_page=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
      fetch(
        `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&page=${page}&per_page=${perPage}`,
        { headers: this.getHeaders(token) }
      ),
    ]);

    const issuesData = issuesRes.ok ? await issuesRes.json() : [];
    const prsData = prsRes.ok ? await prsRes.json() : [];

    const issues: UnifiedIssue[] = Array.isArray(issuesData)
      ? issuesData.filter((i: any) => !i.pull_request)
      : [];
    const prs: UnifiedPullRequest[] = Array.isArray(prsData) ? prsData : [];

    return { issues, prs };
  }

  async searchRepos(
    query: string,
    page: number = 1,
    perPage: number = 20,
    token?: string,
    hostUrl?: string
  ): Promise<UnifiedRepo[]> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
    const res = await fetch(url, { headers: this.getHeaders(token || '') });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];
    return data.items.map((r: any) => ({ ...r, provider: 'github' }));
  }

  async isRepoStarred(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const base = this.getBaseUrl(hostUrl);
    const res = await fetch(
      `${base}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: this.getHeaders(token) }
    );
    return res.status === 204;
  }

  async starRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const base = this.getBaseUrl(hostUrl);
    const res = await fetch(
      `${base}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: 'PUT',
        headers: { ...this.getHeaders(token), 'Content-Length': '0' },
      }
    );
    return res.status === 204;
  }

  async unstarRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean> {
    const base = this.getBaseUrl(hostUrl);
    const res = await fetch(
      `${base}/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token),
      }
    );
    return res.status === 204;
  }

  async deleteRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }> {
    const base = this.getBaseUrl(hostUrl);
    const res = await fetch(
      `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token),
      }
    );
    if (res.status === 204) return { success: true };
    const errData = await res.json().catch(() => null);
    return {
      success: false,
      error: errData?.message || `Failed to delete repository (${res.status}).`,
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
    branch?: string
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const body: Record<string, any> = {
      message: message.trim() || `Update ${path}`,
      content: utf8ToBase64(content),
    };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;

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
    branch?: string
  ): Promise<{ success: boolean; message?: string }> {
    const base = this.getBaseUrl(hostUrl);
    const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const body: Record<string, any> = {
      message: message.trim() || `Delete ${path}`,
    };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return { success: true };
    }
    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      message: err.message || `Failed to delete file (${res.status})`,
    };
  }
}

