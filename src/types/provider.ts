import {
  GitHubRepo,
  GitHubUser,
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubBranch,
  GitHubFileItem,
  GitHubRelease,
  GitHubContributor,
} from './github';

export type GitProviderType = 'github' | 'gitlab' | 'gitea' | 'bitbucket';

export interface ScopeRequirement {
  scope: string;
  name: string;
  level: 'Required' | 'Recommended' | 'Optional';
  desc: string;
}

export interface ProviderMeta {
  type: GitProviderType;
  name: string;
  icon: string;
  defaultHost: string;
  allowCustomHost: boolean;
  tokenDocsUrl: string;
  tokenPlaceholder: string;
  tokenFormatHint: string;
  hasPreconfiguredScopes: boolean;
  getTokenUrl: (customHost?: string) => string;
  manageTokensUrl: (customHost?: string) => string;
  scopes: ScopeRequirement[];
}

const normalizeHost = (host?: string, defaultBase = ''): string => {
  let h = host?.trim();
  if (!h) return defaultBase;
  if (!h.startsWith('http://') && !h.startsWith('https://')) {
    h = `https://${h}`;
  }
  return h.replace(/\/+$/, '');
};

export const PROVIDER_REGISTRY: Record<GitProviderType, ProviderMeta> = {
  github: {
    type: 'github',
    name: 'GitHub',
    icon: '⚡',
    defaultHost: 'https://api.github.com',
    allowCustomHost: true,
    tokenDocsUrl:
      'https://github.com/settings/tokens/new?description=GitPulse+Mobile&scopes=repo,read:user,notifications,delete_repo,read:org',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    tokenFormatHint:
      'Classic token starting with ghp_ recommended. Stored encrypted on-device.',
    hasPreconfiguredScopes: true,
    getTokenUrl: (customHost?: string) => {
      const base = normalizeHost(customHost);
      const targetBase =
        base && !base.includes('api.github.com')
          ? base.replace(/\/api\/v3\/?$/, '')
          : 'https://github.com';
      return `${targetBase}/settings/tokens/new?description=GitPulse+Mobile&scopes=repo,read:user,notifications,delete_repo,read:org`;
    },
    manageTokensUrl: (customHost?: string) => {
      const base = normalizeHost(customHost);
      const targetBase =
        base && !base.includes('api.github.com')
          ? base.replace(/\/api\/v3\/?$/, '')
          : 'https://github.com';
      return `${targetBase}/settings/tokens`;
    },
    scopes: [
      {
        scope: 'repo',
        name: 'Repositories & Code',
        level: 'Required',
        desc: 'Browse public & private repos, branches, directory trees, view & push code edits, commits, PRs, and issues.',
      },
      {
        scope: 'read:user',
        name: 'User Profile',
        level: 'Required',
        desc: 'Profile bio, avatar, GraphQL contribution calendar heatmap, and user profile data.',
      },
      {
        scope: 'notifications',
        name: 'Inbox & Notifications',
        level: 'Recommended',
        desc: 'Notification triage, thread updates, and marking notifications read.',
      },
      {
        scope: 'delete_repo',
        name: 'Delete Repositories',
        level: 'Optional',
        desc: 'Permit deleting repositories you own directly from Danger Zone settings.',
      },
      {
        scope: 'read:org',
        name: 'Organizations',
        level: 'Optional',
        desc: 'View organization memberships, team repositories, and affiliations.',
      },
    ],
  },
  gitlab: {
    type: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    defaultHost: 'https://gitlab.com',
    allowCustomHost: true,
    tokenDocsUrl:
      'https://gitlab.com/-/user_settings/personal_access_tokens?name=GitPulse+Mobile&scopes=api,read_user,read_repository,write_repository',
    tokenPlaceholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    tokenFormatHint:
      'Personal access token starting with glpat-. Stored encrypted on-device.',
    hasPreconfiguredScopes: true,
    getTokenUrl: (customHost?: string) => {
      const base = normalizeHost(customHost, 'https://gitlab.com').replace(/\/api\/v4\/?$/, '');
      return `${base}/-/user_settings/personal_access_tokens?name=GitPulse+Mobile&scopes=api,read_user,read_repository,write_repository`;
    },
    manageTokensUrl: (customHost?: string) => {
      const base = normalizeHost(customHost, 'https://gitlab.com').replace(/\/api\/v4\/?$/, '');
      return `${base}/-/user_settings/personal_access_tokens`;
    },
    scopes: [
      {
        scope: 'api',
        name: 'Full API Access',
        level: 'Required',
        desc: 'Complete access to browse projects, view merge requests, issues, commit trees, and push code changes.',
      },
      {
        scope: 'read_user',
        name: 'User Profile',
        level: 'Required',
        desc: 'Read user account details, avatar, and group memberships.',
      },
      {
        scope: 'read_repository',
        name: 'Read Repositories',
        level: 'Required',
        desc: 'Read repository source code, files, branches, and commit history.',
      },
      {
        scope: 'write_repository',
        name: 'Write Repositories',
        level: 'Recommended',
        desc: 'Push code commits and file modifications or deletions to remote branches.',
      },
    ],
  },
  gitea: {
    type: 'gitea',
    name: 'Gitea / Codeberg',
    icon: '🍵',
    defaultHost: 'https://codeberg.org',
    allowCustomHost: true,
    tokenDocsUrl: 'https://codeberg.org/user/settings/applications',
    tokenPlaceholder: 'Personal Access Token',
    tokenFormatHint:
      'Generated under Settings -> Applications. Select repo, user, and issue scopes.',
    hasPreconfiguredScopes: false,
    getTokenUrl: (customHost?: string) => {
      const base = normalizeHost(customHost, 'https://codeberg.org').replace(/\/api\/v1\/?$/, '');
      return `${base}/user/settings/applications`;
    },
    manageTokensUrl: (customHost?: string) => {
      const base = normalizeHost(customHost, 'https://codeberg.org').replace(/\/api\/v1\/?$/, '');
      return `${base}/user/settings/applications`;
    },
    scopes: [
      {
        scope: 'read:repository',
        name: 'Read Repositories',
        level: 'Required',
        desc: 'Browse repositories, directory trees, file contents, and commit logs.',
      },
      {
        scope: 'write:repository',
        name: 'Write Repositories',
        level: 'Recommended',
        desc: 'Push mobile code edits and commits, or delete files on remote branches.',
      },
      {
        scope: 'read:user',
        name: 'User Profile',
        level: 'Required',
        desc: 'Read user profile info, avatar, and repository ownership.',
      },
      {
        scope: 'read:issue',
        name: 'Issues & PRs',
        level: 'Recommended',
        desc: 'View repository issue tracking, discussions, and pull requests.',
      },
      {
        scope: 'all',
        name: 'All Scopes (Alternative)',
        level: 'Optional',
        desc: 'Quick alternative: grants full access across all Gitea endpoints.',
      },
    ],
  },
  bitbucket: {
    type: 'bitbucket',
    name: 'Bitbucket',
    icon: '🪣',
    defaultHost: 'https://api.bitbucket.org/2.0',
    allowCustomHost: false,
    tokenDocsUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    tokenPlaceholder: 'username:AppPassword',
    tokenFormatHint:
      'Format: username:AppPassword. Create an App Password with Repositories and Account permissions.',
    hasPreconfiguredScopes: false,
    getTokenUrl: () => 'https://bitbucket.org/account/settings/app-passwords/',
    manageTokensUrl: () => 'https://bitbucket.org/account/settings/app-passwords/',
    scopes: [
      {
        scope: 'account:read',
        name: 'Account (Read)',
        level: 'Required',
        desc: 'Read user profile details, email, and workspace memberships.',
      },
      {
        scope: 'repository:read',
        name: 'Repositories (Read)',
        level: 'Required',
        desc: 'Browse workspace repositories, directory trees, source code, and commit logs.',
      },
      {
        scope: 'repository:write',
        name: 'Repositories (Write)',
        level: 'Recommended',
        desc: 'Push commits and code changes directly from mobile code editor.',
      },
      {
        scope: 'pullrequest:read',
        name: 'Pull Requests (Read)',
        level: 'Recommended',
        desc: 'Inspect pull requests, review comments, and diff summaries.',
      },
      {
        scope: 'issue:read',
        name: 'Issues (Read)',
        level: 'Optional',
        desc: 'Read repository issue tracker if issues are enabled.',
      },
    ],
  },
};

export interface GitAccount {
  id: string; // unique id: `${provider}_${username}_${Date.now()}`
  provider: GitProviderType;
  username: string;
  displayName: string;
  avatarUrl?: string;
  token: string;
  hostUrl?: string; // Optional for self-hosted: e.g. https://gitlab.mycorp.com
  createdAt: number;
}

// Unified types extending or matching existing GitHub types for seamless screen compatibility
export type UnifiedRepo = GitHubRepo & {
  provider?: GitProviderType;
  created_at?: string;
};

export type UnifiedUser = GitHubUser & {
  provider?: GitProviderType;
};

export type UnifiedCommit = GitHubCommit;
export type UnifiedIssue = GitHubIssue;
export type UnifiedPullRequest = GitHubPullRequest;
export type UnifiedBranch = GitHubBranch;
export type UnifiedFileItem = GitHubFileItem;
export type UnifiedRelease = GitHubRelease;
export type UnifiedContributor = GitHubContributor;

