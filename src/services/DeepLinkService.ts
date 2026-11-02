import { Linking } from 'react-native';
import { parseGitUrl, ParsedGitLink } from '../utils/deepLink';
import { GitHubApiService } from './GitHubApiService';
import { GitHubRepo } from '../types/github';

type DeepLinkListener = (repo: GitHubRepo) => void;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || Date.now();
}

class DeepLinkServiceClass {
  private listeners: Set<DeepLinkListener> = new Set();
  private initialized: boolean = false;
  private lastHandledUrl: string | null = null;
  private lastHandledTime: number = 0;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Cold start deep link (App launched from link)
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          this.handleIncomingUrl(url);
        }
      })
      .catch((err) => {
        console.warn('[DeepLinkService] getInitialURL error', err);
      });

    // 2. Foreground / background incoming deep link
    Linking.addEventListener('url', ({ url }) => {
      this.handleIncomingUrl(url);
    });
  }

  parseUrl(url: string): ParsedGitLink | null {
    return parseGitUrl(url);
  }

  async handleIncomingUrl(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string') return false;

    // Debounce duplicate events within 1.5 seconds for the same URL
    const now = Date.now();
    if (this.lastHandledUrl === url && now - this.lastHandledTime < 1500) {
      return true;
    }
    this.lastHandledUrl = url;
    this.lastHandledTime = now;

    const parsed = this.parseUrl(url);
    if (!parsed) return false;

    const repo = await this.resolveRepo(parsed);
    this.notify(repo);
    return true;
  }

  async resolveRepo(parsed: ParsedGitLink): Promise<GitHubRepo> {
    const { owner, repo, provider, fullUrl } = parsed;

    try {
      if (provider === 'github') {
        const fetched = await GitHubApiService.getRepo(owner, repo);
        if (fetched) {
          return fetched;
        }
      }
    } catch (e) {
      console.warn('[DeepLinkService] Failed to fetch repo from remote API', e);
    }

    // Direct fallback repo object so offline/rate-limited/private links open without blocking
    const avatarUrl =
      provider === 'gitlab'
        ? `https://gitlab.com/${owner}.png`
        : `https://github.com/${owner}.png`;

    return {
      id: Math.abs(hashString(`${owner}/${repo}`)),
      name: repo,
      full_name: `${owner}/${repo}`,
      private: false,
      owner: {
        login: owner,
        avatar_url: avatarUrl,
      },
      html_url: fullUrl || `https://github.com/${owner}/${repo}`,
      description: null,
      fork: false,
      stargazers_count: 0,
      watchers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      language: null,
      default_branch: 'main',
      updated_at: new Date().toISOString(),
      pushed_at: new Date().toISOString(),
    };
  }

  subscribe(listener: DeepLinkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(repo: GitHubRepo): void {
    for (const listener of this.listeners) {
      try {
        listener(repo);
      } catch (e) {
        console.warn('[DeepLinkService] Listener notification error', e);
      }
    }
  }
}

export const DeepLinkService = new DeepLinkServiceClass();

