import AsyncStorage from '@react-native-async-storage/async-storage';
import { GitAccount, GitProviderType, normalizeHost } from '../types/provider';

const ACCOUNTS_STORAGE_KEY = '@gitpulse_multi_accounts_v1';
const ACTIVE_ACCOUNT_ID_KEY = '@gitpulse_active_account_id';
const LEGACY_PAT_KEY = '@gitpulse_pat_token';
const LEGACY_USER_KEY = '@gitpulse_cached_user';

type AccountChangeListener = (active: GitAccount | null, accounts: GitAccount[]) => void;

class AccountServiceClass {
  private accounts: GitAccount[] = [];
  private activeAccount: GitAccount | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<GitAccount | null> | null = null;
  private listeners: Set<AccountChangeListener> = new Set();

  async init(): Promise<GitAccount | null> {
    if (this.initialized) return this.activeAccount;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [rawAccounts, rawActiveId, legacyPat, legacyUser] = await Promise.all([
          AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_ACCOUNT_ID_KEY),
          AsyncStorage.getItem(LEGACY_PAT_KEY),
          AsyncStorage.getItem(LEGACY_USER_KEY),
        ]);

        let loadedAccounts: GitAccount[] = [];
        if (rawAccounts) {
          try {
            const parsed = JSON.parse(rawAccounts);
            if (Array.isArray(parsed)) {
              loadedAccounts = parsed;
            }
          } catch {
            loadedAccounts = [];
          }
        }

        // Auto-migrate legacy GitHub account if present and not already registered
        if (legacyPat && legacyPat.trim()) {
          let legacyLogin = 'User';
          let legacyAvatar = '';
          if (legacyUser) {
            try {
              const parsed = JSON.parse(legacyUser);
              legacyLogin = parsed.login || 'User';
              legacyAvatar = parsed.avatar_url || '';
            } catch {
              // ignore
            }
          }

          const cleanPat = legacyPat.trim();
          const cleanLogin = legacyLogin.trim();

          const alreadyExists = loadedAccounts.some(
            (a) =>
              a.provider === 'github' &&
              (a.username.toLowerCase() === cleanLogin.toLowerCase() || a.token === cleanPat)
          );

          if (!alreadyExists) {
            const migratedAccount: GitAccount = {
              id: `github_${cleanLogin.toLowerCase()}_${Date.now()}`,
              provider: 'github',
              username: cleanLogin,
              displayName: cleanLogin,
              avatarUrl: legacyAvatar,
              token: cleanPat,
              createdAt: Date.now(),
            };
            loadedAccounts.push(migratedAccount);
            await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(loadedAccounts));
          }
        }

        this.accounts = loadedAccounts;

        // Determine active account
        if (rawActiveId) {
          this.activeAccount = this.accounts.find((a) => a.id === rawActiveId) || null;
        }

        if (!this.activeAccount && this.accounts.length > 0) {
          this.activeAccount = this.accounts[0];
          await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, this.activeAccount.id);
        }

        this.initialized = true;
        this.notifyListeners();
        return this.activeAccount;
      } catch (e) {
        console.warn('[AccountService] Init failed', e);
        this.initialized = true;
        return null;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  getAccounts(): GitAccount[] {
    return [...this.accounts];
  }

  getActiveAccount(): GitAccount | null {
    return this.activeAccount;
  }

  async setActiveAccount(id: string): Promise<GitAccount | null> {
    await this.init();

    const target = this.accounts.find((a) => a.id === id);
    if (!target) return null;

    this.activeAccount = target;
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, id);

    // Keep legacy PAT key synced for background services if GitHub
    if (target.provider === 'github') {
      await AsyncStorage.setItem(LEGACY_PAT_KEY, target.token);
    }

    this.notifyListeners();
    return target;
  }

  async addAccount(accountData: Omit<GitAccount, 'id' | 'createdAt'>): Promise<GitAccount> {
    await this.init();

    const cleanUsername = accountData.username.trim();
    const cleanHost = accountData.hostUrl?.trim()
      ? normalizeHost(accountData.hostUrl.trim())
      : undefined;
    const cleanToken = accountData.token.trim();

    const newAccount: GitAccount = {
      ...accountData,
      username: cleanUsername,
      hostUrl: cleanHost,
      token: cleanToken,
      id: `${accountData.provider}_${cleanUsername.toLowerCase()}_${Date.now()}`,
      createdAt: Date.now(),
    };

    // Replace if exact same provider + username + hostUrl exists
    const existingIndex = this.accounts.findIndex(
      (a) =>
        a.provider === newAccount.provider &&
        a.username.toLowerCase() === newAccount.username.toLowerCase() &&
        (a.hostUrl || '').toLowerCase() === (newAccount.hostUrl || '').toLowerCase()
    );

    if (existingIndex >= 0) {
      this.accounts[existingIndex] = {
        ...this.accounts[existingIndex],
        ...newAccount,
        id: this.accounts[existingIndex].id, // retain stable ID
      };
      this.activeAccount = this.accounts[existingIndex];
    } else {
      this.accounts.push(newAccount);
      this.activeAccount = newAccount;
    }

    // Persist full accounts list to AsyncStorage
    await Promise.all([
      AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts)),
      AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, this.activeAccount.id),
      this.activeAccount.provider === 'github'
        ? AsyncStorage.setItem(LEGACY_PAT_KEY, this.activeAccount.token)
        : Promise.resolve(),
    ]);

    this.notifyListeners();
    return this.activeAccount;
  }

  async updateAccount(
    id: string,
    updates: Partial<Omit<GitAccount, 'id' | 'createdAt'>>
  ): Promise<void> {
    await this.init();

    const idx = this.accounts.findIndex((a) => a.id === id);
    if (idx < 0) return;

    this.accounts[idx] = {
      ...this.accounts[idx],
      ...updates,
    };

    if (this.activeAccount?.id === id) {
      this.activeAccount = this.accounts[idx];
    }

    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts));
    this.notifyListeners();
  }

  async removeAccount(id: string): Promise<void> {
    await this.init();

    this.accounts = this.accounts.filter((a) => a.id !== id);

    if (this.activeAccount?.id === id) {
      this.activeAccount = this.accounts[0] || null;
      if (this.activeAccount) {
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, this.activeAccount.id);
        if (this.activeAccount.provider === 'github') {
          await AsyncStorage.setItem(LEGACY_PAT_KEY, this.activeAccount.token);
        }
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_ID_KEY);
      }
    }

    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts));
    this.notifyListeners();
  }

  subscribe(listener: AccountChangeListener): () => void {
    this.listeners.add(listener);
    if (this.initialized) {
      try {
        listener(this.activeAccount, [...this.accounts]);
      } catch (e) {
        console.warn('[AccountService] Initial subscriber notification error', e);
      }
    }
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeAccount, [...this.accounts]);
      } catch (e) {
        console.warn('[AccountService] Listener error', e);
      }
    }
  }
}

export const AccountService = new AccountServiceClass();
