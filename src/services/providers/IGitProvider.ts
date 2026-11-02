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

export interface IGitProvider {
  readonly type: GitProviderType;

  /**
   * Validate token and fetch authenticated user profile
   */
  validateToken(token: string, hostUrl?: string): Promise<UnifiedUser>;

  /**
   * Retrieve active scopes or permissions granted to the token
   */
  getTokenScopes?(token: string, hostUrl?: string): Promise<string[]>;

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

  /**
   * Create a new branch
   */
  createBranch?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branchName: string,
    fromBranchOrSha: string
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Delete a branch
   */
  deleteBranch?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    branchName: string
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Merge two branches
   */
  mergeBranch?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    base: string,
    head: string,
    commitMessage?: string
  ): Promise<{ success: boolean; message?: string; sha?: string }>;

  /**
   * Create a Pull Request or Merge Request
   */
  createPullRequest?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<{ success: boolean; message?: string; url?: string; number?: number }>;

  /**
   * Create a new file via commit
   */
  createFile?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string
  ): Promise<{ success: boolean; message?: string; commitSha?: string }>;

  /**
   * Fetch repo languages
   */
  getRepoLanguages?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<Record<string, number>>;

  /**
   * Fetch repo contributors
   */
  getRepoContributors?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string
  ): Promise<UnifiedContributor[]>;

  /**
   * Fetch repo releases
   */
  getRepoReleases?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page?: number,
    perPage?: number
  ): Promise<UnifiedRelease[]>;

  /**
   * Fetch CI/CD pipeline / workflow runs
   */
  getWorkflowRuns?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    page?: number,
    perPage?: number
  ): Promise<GitHubWorkflowRun[]>;

  /**
   * Fetch inbox / user notifications
   */
  getNotifications?(
    token: string,
    hostUrl: string | undefined,
    page?: number,
    perPage?: number
  ): Promise<UnifiedNotification[]>;

  /**
   * Mark a notification as read
   */
  markNotificationRead?(
    token: string,
    hostUrl: string | undefined,
    notificationId: string
  ): Promise<boolean>;

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead?(
    token: string,
    hostUrl: string | undefined
  ): Promise<boolean>;

  /**
   * Fetch user's starred repositories
   */
  getUserStarredRepos?(
    token: string,
    hostUrl: string | undefined,
    page?: number,
    perPage?: number
  ): Promise<UnifiedRepo[]>;

  /**
   * Fetch issue or pull request comments
   */
  getIssueComments?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    issueNumber: number,
    page?: number,
    perPage?: number
  ): Promise<UnifiedIssueComment[]>;

  /**
   * Post a comment on an issue or pull request
   */
  postIssueComment?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ success: boolean; comment?: UnifiedIssueComment }>;

  /**
   * Close an issue or PR
   */
  closeIssueOrPR?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    number: number,
    type: 'issue' | 'pr'
  ): Promise<{ success: boolean }>;

  /**
   * Reopen an issue or PR
   */
  reopenIssueOrPR?(
    token: string,
    hostUrl: string | undefined,
    owner: string,
    repo: string,
    number: number,
    type: 'issue' | 'pr'
  ): Promise<{ success: boolean }>;

  /**
   * Fetch user contribution activity for heatmap
   */
  getUserContributions?(
    token: string,
    hostUrl: string | undefined,
    username: string
  ): Promise<{ total: number; days: ContributionDay[] }>;

  /**
   * Fetch user organizations or groups
   */
  getOrgs?(
    token: string,
    hostUrl: string | undefined
  ): Promise<any[]>;
}

