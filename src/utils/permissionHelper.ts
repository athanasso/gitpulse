import { GitProviderType, ScopeRequirement } from '../types/provider';

export interface EvaluatedScope {
  scope: string;
  name: string;
  desc: string;
  level: 'Required' | 'Recommended' | 'Optional';
  isGranted: boolean;
  statusBadgeText: string;
  statusBadgeColor: 'emerald' | 'danger' | 'warning' | 'muted';
}

/**
 * Checks whether a specific permission/scope is granted for the given provider
 */
export const isScopeGranted = (
  provider: GitProviderType,
  scope: string,
  grantedScopes: string[]
): boolean => {
  if (!grantedScopes || grantedScopes.length === 0) return false;

  const s = scope.toLowerCase();
  const granted = grantedScopes.map((g) => g.toLowerCase());

  // Global wildcards
  if (provider === 'gitlab' && granted.includes('api')) return true;
  if (
    provider === 'gitea' &&
    (granted.includes('all') || granted.includes('admin'))
  ) {
    return true;
  }

  switch (provider) {
    case 'github':
      if (s === 'repo') return granted.includes('repo');
      if (s === 'read:user') return granted.includes('read:user') || granted.includes('user');
      if (s === 'notifications') return granted.includes('notifications');
      if (s === 'delete_repo') return granted.includes('delete_repo');
      if (s === 'read:org') return granted.includes('read:org') || granted.includes('admin:org');
      if (s === 'gist') return granted.includes('gist');
      return granted.includes(s);

    case 'gitlab':
      if (s === 'api') return granted.includes('api');
      if (s === 'read_user') return granted.includes('api') || granted.includes('read_user');
      if (s === 'read_repository')
        return granted.includes('api') || granted.includes('read_repository');
      if (s === 'write_repository')
        return granted.includes('api') || granted.includes('write_repository');
      return granted.includes(s);

    case 'gitea':
      if (s === 'read:repository')
        return granted.includes('read:repository') || granted.includes('repo');
      if (s === 'write:repository')
        return granted.includes('write:repository') || granted.includes('repo');
      if (s === 'read:user')
        return granted.includes('read:user') || granted.includes('user');
      if (s === 'read:issue')
        return granted.includes('read:issue') || granted.includes('issue');
      if (s === 'all') return granted.includes('all') || granted.includes('admin');
      return granted.includes(s);

    case 'bitbucket':
      if (s === 'account:read')
        return granted.includes('account:read') || granted.includes('account');
      if (s === 'repository:read')
        return (
          granted.includes('repository:read') ||
          granted.includes('repository') ||
          granted.includes('repository:write')
        );
      if (s === 'repository:write') return granted.includes('repository:write');
      if (s === 'pullrequest:read')
        return granted.includes('pullrequest:read') || granted.includes('pullrequest');
      if (s === 'issue:read')
        return granted.includes('issue:read') || granted.includes('issue');
      return granted.includes(s);

    default:
      return granted.includes(s);
  }
};

/**
 * Evaluates a list of required scopes against granted scopes for a provider
 */
export const evaluateProviderScopes = (
  provider: GitProviderType,
  requirements: ScopeRequirement[],
  grantedScopes: string[]
): EvaluatedScope[] => {
  return requirements.map((req) => {
    const granted = isScopeGranted(provider, req.scope, grantedScopes);

    let statusBadgeText: string;
    let statusBadgeColor: 'emerald' | 'danger' | 'warning' | 'muted';

    if (granted) {
      statusBadgeText = '✓ GRANTED';
      statusBadgeColor = 'emerald';
    } else if (req.level === 'Required') {
      statusBadgeText = '✕ MISSING';
      statusBadgeColor = 'danger';
    } else if (req.level === 'Recommended') {
      statusBadgeText = '⚠️ RECOMMENDED';
      statusBadgeColor = 'warning';
    } else {
      statusBadgeText = '○ OPTIONAL';
      statusBadgeColor = 'muted';
    }

    return {
      scope: req.scope,
      name: req.name,
      desc: req.desc,
      level: req.level,
      isGranted: granted,
      statusBadgeText,
      statusBadgeColor,
    };
  });
};

