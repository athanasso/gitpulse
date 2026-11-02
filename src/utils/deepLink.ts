export interface ParsedGitLink {
  provider: 'github' | 'gitlab' | 'gitea' | 'bitbucket';
  owner: string;
  repo: string;
  subPath?: string;
  fullUrl: string;
}

const NON_REPO_PATHS = new Set([
  'about',
  'account',
  'apps',
  'codespaces',
  'collections',
  'contact',
  'discussions',
  'enterprise',
  'explore',
  'features',
  'inbox',
  'issues',
  'join',
  'login',
  'logout',
  'marketplace',
  'notifications',
  'organizations',
  'orgs',
  'pricing',
  'pulls',
  'search',
  'security',
  'settings',
  'signup',
  'site',
  'sponsors',
  'stars',
  'team',
  'topics',
  'trending',
]);

const GIT_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

/**
 * Parses a web or custom scheme URL into Git repository coordinates.
 * Returns null if the URL does not point to a valid repository.
 */
export function parseGitUrl(rawUrl: string): ParsedGitLink | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Custom scheme: gitpulse://
  if (trimmed.startsWith('gitpulse://')) {
    let path = trimmed.slice('gitpulse://'.length).replace(/^\/+/, '');
    if (path.startsWith('repo/')) {
      path = path.slice('repo/'.length);
    } else if (path.startsWith('github.com/')) {
      path = path.slice('github.com/'.length);
    } else if (path.startsWith('gitlab.com/')) {
      path = path.slice('gitlab.com/'.length);
    }

    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0].replace(/^@/, '');
    const repo = parts[1].replace(/\.git$/, '');

    if (!GIT_NAME_REGEX.test(owner) || !GIT_NAME_REGEX.test(repo)) return null;

    const isGitLab = trimmed.includes('gitlab.com');
    return {
      provider: isGitLab ? 'gitlab' : 'github',
      owner,
      repo,
      subPath: parts.slice(2).join('/') || undefined,
      fullUrl: trimmed,
    };
  }

  // Standard Web URLs: http:// or https://
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      // Extract hostname and pathname
      const withoutProto = trimmed.replace(/^https?:\/\//i, '');
      const slashIndex = withoutProto.indexOf('/');
      if (slashIndex < 0) return null;

      const host = withoutProto.slice(0, slashIndex).toLowerCase();
      const rawPath = withoutProto.slice(slashIndex + 1);

      // Remove query and fragments
      const cleanPath = rawPath.split(/[?#]/)[0];
      const parts = cleanPath.split('/').filter(Boolean);

      if (parts.length < 2) return null;

      const firstSegment = parts[0].toLowerCase();
      if (NON_REPO_PATHS.has(firstSegment)) return null;

      const owner = parts[0].replace(/^@/, '');
      const repo = parts[1].replace(/\.git$/, '');

      if (!GIT_NAME_REGEX.test(owner) || !GIT_NAME_REGEX.test(repo)) return null;

      let provider: 'github' | 'gitlab' | 'gitea' | 'bitbucket' = 'github';
      if (host.includes('gitlab')) {
        provider = 'gitlab';
      } else if (host.includes('bitbucket')) {
        provider = 'bitbucket';
      } else if (host.includes('gitea') || host.includes('codeberg')) {
        provider = 'gitea';
      } else if (!host.includes('github')) {
        // Unknown host, assume github-compatible git forge
        provider = 'github';
      }

      return {
        provider,
        owner,
        repo,
        subPath: parts.slice(2).join('/') || undefined,
        fullUrl: trimmed,
      };
    } catch {
      return null;
    }
  }

  return null;
}

