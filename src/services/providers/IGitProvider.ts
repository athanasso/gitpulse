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

export interface IGitProvider {
  readonly type: GitProviderType;

  /**
   * Validate token and fetch authenticated user profile
   */
  validateToken(token: string, hostUrl?: string): Promise<UnifiedUser>;

  /**
   * Fetch user repositories with pagination
   */
  getUserRepos(
    token: string,
    hostUrl: string | undefined,
    page: number,
    perPage: number
  ): Promise<UnifiedRepo[]>;

  /**
   * Fetch README raw or rendered markdown for a repository
   */
  getRepoReadme(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<string>;

  /**
   * Fetch repository branches
   */
  getRepoBranches(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedBranch[]>;

  /**
   * Fetch directory file tree
   */
  getRepoTree(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path?: string,
    branch?: string
  ): Promise<UnifiedFileItem[]>;

  /**
   * Fetch file content (raw text)
   */
  getFileContent(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ): Promise<string>;

  /**
   * Fetch commit history with pagination
   */
  getRepoCommits(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branch?: string,
    page?: number,
    perPage?: number,
    path?: string
  ): Promise<UnifiedCommit[]>;

  /**
   * Fetch issues and pull requests (or merge requests)
   */
  getIssuesAndPRs(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page?: number,
    perPage?: number
  ): Promise<{ issues: UnifiedIssue[]; prs: UnifiedPullRequest[] }>;

  /**
   * Global search repositories
   */
  searchRepos(
    query: string,
    page: number,
    perPage: number,
    token?: string,
    hostUrl?: string
  ): Promise<UnifiedRepo[]>;

  /**
   * Star / Unstar checks
   */
  isRepoStarred(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean>;

  starRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean>;

  unstarRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<boolean>;

  /**
   * Delete repository
   */
  deleteRepo(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Commit and push file changes
   */
  updateFileContent(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string; commitSha?: string }>;

  /**
   * Delete a file via git commit
   */
  deleteFile(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha?: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string }>;
}

