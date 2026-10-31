export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  html_url: string;
  company: string | null;
  location: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  topics?: string[];
}

export interface GitHubFileItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  html_url: string;
  download_url: string | null;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: Array<{
    filename: string;
    status: 'added' | 'removed' | 'modified';
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatar_url: string;
  };
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  pull_request?: {
    html_url: string;
  };
}

export interface GitHubPullRequest extends GitHubIssue {
  merged?: boolean;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  head?: {
    ref: string;
  };
  base?: {
    ref: string;
  };
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | null;
  run_number: number;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  actor: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  subject: {
    title: string;
    url: string;
    type: 'Issue' | 'PullRequest' | 'Commit' | 'Release';
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
}

export interface ContributionDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GitHubGist {
  id: string;
  description: string | null;
  public: boolean;
  created_at: string;
  updated_at: string;
  comments: number;
  html_url: string;
  files: Record<
    string,
    {
      filename: string;
      type: string;
      language: string | null;
      raw_url: string;
      size: number;
    }
  >;
}

export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  };
  assets: Array<{
    id: number;
    name: string;
    size: number;
    download_count: number;
    browser_download_url: string;
  }>;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface GitHubEvent {
  id: string;
  type: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  repo: {
    name: string;
    url: string;
  };
  created_at: string;
  payload?: any;
}

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

export interface GitHubFollower {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}


