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
   * Fetch repository commit history
   */
  async getRepoCommits(
    owner: string,
    repo: string,
    branch: string = 'main',
    page: number = 1,
    perPage: number = 30
  ): Promise<UnifiedCommit[]> {
    const acc = this.getActiveAccount();
    const providerType = acc ? acc.provider : 'github';
    const p = this.getProvider(providerType);
    return await p.getRepoCommits(acc?.token || '', acc?.hostUrl, owner, repo, branch, page, perPage);
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
}

export const GitService = new GitServiceClass();

