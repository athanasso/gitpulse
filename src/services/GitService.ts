import { IGitProvider } from './providers/IGitProvider';
import { GitHubProvider } from './providers/GitHubProvider';
import { GitLabProvider } from './providers/GitLabProvider';
import { GiteaProvider } from './providers/GiteaProvider';
import { BitbucketProvider } from './providers/BitbucketProvider';
import { AccountService } from './AccountService';
import {
  GitProviderType,
  GitAccount,
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
  PROVIDER_REGISTRY,
} from '../types/provider';

class GitServiceClass {
  private providers: Record<GitProviderType, IGitProvider> = {
    github: new GitHubProvider(),
    gitlab: new GitLabProvider(),
    gitea: new GiteaProvider(),
    bitbucket: new BitbucketProvider(),
  };

  private getProvider(type: GitProviderType): IGitProvider {
    const p = this.providers[type];
    if (!p) throw new Error(`Unsupported provider: ${type}`);
    return p;
  }

  private getActiveAccount(): GitAccount | null {
    return AccountService.getActiveAccount();
  }

  getActiveProviderType(): GitProviderType {
    const acc = this.getActiveAccount();
    return acc ? acc.provider : 'github';
  }

  getActiveProviderMeta() {
    return PROVIDER_REGISTRY[this.getActiveProviderType()];
  }

  /**
   * Check active token scopes / permissions for a provider
   */
  async getTokenScopes(
    provider?: GitProviderType,
    token?: string,
    hostUrl?: string
  ): Promise<string[]> {
    const pType = provider || this.getActiveProviderType();
    const acc = this.getActiveAccount();
    const tok = token || acc?.token;
    const host = hostUrl !== undefined ? hostUrl : acc?.hostUrl;
    if (!tok) return [];
    const p = this.getProvider(pType);
    if (p.getTokenScopes) {
      return await p.getTokenScopes(tok, host);
    }
    return [];
  }

  /**
   * Validate credentials and fetch user info when connecting an account
   */
  async validateAccount(
    provider: GitProviderType,
    token: string,
    hostUrl?: string
  ): Promise<UnifiedUser> {
    const p = this.getProvider(provider);
    return await p.validateToken(token, hostUrl);
  }

  /**
   * Fetch current user info for active account
   */
  async getCurrentUser(): Promise<UnifiedUser | null> {
    const acc = this.getActiveAccount();
    if (!acc) return null;
    try {
      const p = this.getProvider(acc.provider);
      return await p.validateToken(acc.token, acc.hostUrl);
    } catch {
      return null;
    }
  }

  /**
   * Fetch repositories for active account
   */
  async getUserRepos(page: number = 1, perPage: number = 30): Promise<UnifiedRepo[]> {
    const acc = this.getActiveAccount();
    if (!acc) return [];
    const p = this.getProvider(acc.provider);
    return await p.getUserRepos(acc.token, acc.hostUrl, page, perPage);
  }

  /**
   * Fetch repository README markdown
   */
  async getRepoReadme(owner: string, repo: string): Promise<string> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getRepoReadme(acc?.token || '', acc?.hostUrl, owner, repo);
  }

  /**
   * Fetch repository branches
   */
  async getRepoBranches(owner: string, repo: string): Promise<UnifiedBranch[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getRepoBranches(acc?.token || '', acc?.hostUrl, owner, repo);
  }

  /**
   * Fetch repository directory tree
   */
  async getRepoTree(
    owner: string,
    repo: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<UnifiedFileItem[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getRepoTree(acc?.token || '', acc?.hostUrl, owner, repo, path, branch);
  }

  /**
   * Fetch file raw text
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<string> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getFileContent(acc?.token || '', acc?.hostUrl, owner, repo, path, branch);
  }

  /**
   * Commit and push file changes across active provider
   */
  async updateFileContent(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.updateFileContent(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      path,
      content,
      message,
      sha,
      branch
    );
  }

  /**
   * Delete a file via git commit
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha?: string,
    branch: string = 'main'
  ): Promise<{ success: boolean; message?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.deleteFile(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      path,
      message,
      sha,
      branch
    );
  }

  /**
   * Fetch repository commit history
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    branch: string = 'main',
    page: number = 1,
    perPage: number = 30,
    path?: string
  ): Promise<UnifiedCommit[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getRepoCommits(acc?.token || '', acc?.hostUrl, owner, repo, branch, page, perPage, path);
  }

  /**
   * Fetch issues and pull requests (or merge requests)
   */
  async getIssuesAndPRs(
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{ issues: UnifiedIssue[]; prs: UnifiedPullRequest[] }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getIssuesAndPRs(acc?.token || '', acc?.hostUrl, owner, repo, page, perPage);
  }

  /**
   * Search repositories across the active provider
   */
  async searchRepos(query: string, page: number = 1, perPage: number = 20): Promise<UnifiedRepo[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.searchRepos(query, page, perPage, acc?.token, acc?.hostUrl);
  }

  /**
   * Star checks
   */
  async isRepoStarred(owner: string, repo: string): Promise<boolean> {
    const acc = this.getActiveAccount();
    if (!acc) return false;
    const p = this.getProvider(acc.provider);
    return await p.isRepoStarred(acc.token, acc.hostUrl, owner, repo);
  }

  async starRepo(owner: string, repo: string): Promise<boolean> {
    const acc = this.getActiveAccount();
    if (!acc) return false;
    const p = this.getProvider(acc.provider);
    return await p.starRepo(acc.token, acc.hostUrl, owner, repo);
  }

  async unstarRepo(owner: string, repo: string): Promise<boolean> {
    const acc = this.getActiveAccount();
    if (!acc) return false;
    const p = this.getProvider(acc.provider);
    return await p.unstarRepo(acc.token, acc.hostUrl, owner, repo);
  }

  /**
   * Delete repository
   */
  async deleteRepo(owner: string, repo: string): Promise<{ success: boolean; error?: string }> {
    const acc = this.getActiveAccount();
    if (!acc) return { success: false, error: 'No active account.' };
    const p = this.getProvider(acc.provider);
    return await p.deleteRepo(acc.token, acc.hostUrl, owner, repo);
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranchOrSha: string
  ): Promise<{ success: boolean; message?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.createBranch) {
      return { success: false, message: `createBranch not supported on ${providerType}` };
    }
    return await p.createBranch(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      branchName,
      fromBranchOrSha
    );
  }

  /**
   * Delete an existing branch
   */
  async deleteBranch(
    owner: string,
    repo: string,
    branchName: string
  ): Promise<{ success: boolean; message?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.deleteBranch) {
      return { success: false, message: `deleteBranch not supported on ${providerType}` };
    }
    return await p.deleteBranch(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      branchName
    );
  }

  /**
   * Merge two branches
   */
  async mergeBranch(
    owner: string,
    repo: string,
    base: string,
    head: string,
    commitMessage?: string
  ): Promise<{ success: boolean; message?: string; sha?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.mergeBranch) {
      return { success: false, message: `mergeBranch not supported on ${providerType}` };
    }
    return await p.mergeBranch(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      base,
      head,
      commitMessage
    );
  }

  /**
   * Create a Pull Request or Merge Request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<{ success: boolean; message?: string; url?: string; number?: number }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.createPullRequest) {
      return { success: false, message: `createPullRequest not supported on ${providerType}` };
    }
    return await p.createPullRequest(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      title,
      head,
      base,
      body
    );
  }

  /**
   * Create a new file via git commit
   */
  async createFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string; commitSha?: string }> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.createFile) {
      return { success: false, message: `createFile not supported on ${providerType}` };
    }
    return await p.createFile(
      acc?.token || '',
      acc?.hostUrl,
      owner,
      repo,
      path,
      content,
      message,
      branch
    );
  }

  /**
   * Fetch repo languages across providers
   */
  async getRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.getRepoLanguages) return {};
    return await p.getRepoLanguages(acc?.token || '', acc?.hostUrl, owner, repo);
  }

  /**
   * Fetch repo contributors across providers
   */
  async getRepoContributors(owner: string, repo: string): Promise<UnifiedContributor[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.getRepoContributors) return [];
    return await p.getRepoContributors(acc?.token || '', acc?.hostUrl, owner, repo);
  }

  /**
   * Fetch repo releases across providers
   */
  async getRepoReleases(
    owner: string,
    repo: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<UnifiedRelease[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.getRepoReleases) return [];
    return await p.getRepoReleases(acc?.token || '', acc?.hostUrl, owner, repo, page, perPage);
  }

  /**
   * Fetch inbox notifications across providers
   */
  async getNotifications(page: number = 1, perPage: number = 30): Promise<UnifiedNotification[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.getNotifications) return [];
    return await p.getNotifications(acc?.token || '', acc?.hostUrl, page, perPage);
  }

  /**
   * Mark a notification as read across providers
   */
  async markNotificationRead(notificationId: string): Promise<boolean> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.markNotificationRead) return false;
    return await p.markNotificationRead(acc?.token || '', acc?.hostUrl, notificationId);
  }

  /**
   * Mark all notifications as read across providers
   */
  async markAllNotificationsRead(): Promise<boolean> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.markAllNotificationsRead) return false;
    return await p.markAllNotificationsRead(acc?.token || '', acc?.hostUrl);
  }

  /**
   * Fetch user starred repos across providers
   */
  async getUserStarredRepos(page: number = 1, perPage: number = 30): Promise<UnifiedRepo[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    if (!p.getUserStarredRepos) return [];
    return await p.getUserStarredRepos(acc?.token || '', acc?.hostUrl, page, perPage);
  }
}

export const GitService = new GitServiceClass();

