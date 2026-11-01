import AsyncStorage from '@react-native-async-storage/async-storage';

export const CacheKeys = {
  USER_REPOS_PAGE_1: 'gitpulse_cache_user_repos_p1',
  PROFILE_BUNDLE: (username: string) =>
    `gitpulse_cache_profile_${username.toLowerCase()}`,
  REPO_README: (owner: string, repo: string) =>
    `gitpulse_cache_readme_${owner.toLowerCase()}_${repo.toLowerCase()}`,
  EXPLORE_TRENDING: (timeframe: string, lang: string) =>
    `gitpulse_cache_trending_${timeframe}_${lang}`,
};

class CacheServiceClass {
  private memCache = new Map<string, any>();

  /**
   * Read cached data (checks in-memory Map first, then AsyncStorage)
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.memCache.has(key)) {
      return this.memCache.get(key) as T;
    }

    try {
      const json = await AsyncStorage.getItem(key);
      if (json) {
        const parsed = JSON.parse(json) as T;
        this.memCache.set(key, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn(`[CacheService] Failed to read ${key}`, e);
    }

    return null;
  }

  /**
   * Synchronous get from in-memory cache if warmed up
   */
  getSync<T>(key: string): T | null {
    return (this.memCache.get(key) as T) || null;
  }

  /**
   * Save data to in-memory Map and AsyncStorage
   */
  async set<T>(key: string, data: T): Promise<void> {
    try {
      this.memCache.set(key, data);
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`[CacheService] Failed to save ${key}`, e);
    }
  }

  /**
   * Invalidate a cache key
   */
  async remove(key: string): Promise<void> {
    this.memCache.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[CacheService] Failed to remove ${key}`, e);
    }
  }

  /**
   * Warm up critical keys into memory concurrently on startup
   */
  async warmup(keys: string[]): Promise<void> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value) {
          try {
            this.memCache.set(key, JSON.parse(value));
          } catch {
            // Ignore malformed JSON
          }
        }
      }
    } catch (e) {
      console.warn('[CacheService] Warmup failed', e);
    }
  }
}

export const CacheService = new CacheServiceClass();
