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

export interface ProviderMeta {
  type: GitProviderType;
  name: string;
  icon: string;
  defaultHost: string;
  allowCustomHost: boolean;
  tokenDocsUrl: string;
  tokenPlaceholder: string;
}

export const PROVIDER_REGISTRY: Record<GitProviderType, ProviderMeta> = {
  github: {
    type: 'github',
    name: 'GitHub',
    icon: '⚡',
    defaultHost: 'https://api.github.com',
    allowCustomHost: true,
    tokenDocsUrl: 'https://github.com/settings/tokens/new',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
  },
  gitlab: {
    type: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    defaultHost: 'https://gitlab.com',
    allowCustomHost: true,
    tokenDocsUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    tokenPlaceholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
  },
  gitea: {
    type: 'gitea',
    name: 'Gitea / Codeberg',
    icon: '🍵',
    defaultHost: 'https://codeberg.org',
    allowCustomHost: true,
    tokenDocsUrl: 'https://codeberg.org/user/settings/applications',
    tokenPlaceholder: 'Personal Access Token',
  },
  bitbucket: {
    type: 'bitbucket',
    name: 'Bitbucket',
    icon: '🪣',
    defaultHost: 'https://api.bitbucket.org/2.0',
    allowCustomHost: false,
    tokenDocsUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    tokenPlaceholder: 'username:AppPassword',
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

