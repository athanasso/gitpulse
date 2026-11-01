import AsyncStorage from '@react-native-async-storage/async-storage';
import { GitAccount, GitProviderType } from '../types/provider';

const ACCOUNTS_STORAGE_KEY = '@gitpulse_multi_accounts_v1';
const ACTIVE_ACCOUNT_ID_KEY = '@gitpulse_active_account_id';
const LEGACY_PAT_KEY = '@gitpulse_pat_token';
const LEGACY_USER_KEY = '@gitpulse_cached_user';

type AccountChangeListener = (active: GitAccount | null, accounts: GitAccount[]) => void;

class AccountServiceClass {
  private accounts: GitAccount[] = [];
  private activeAccount: GitAccount | null = null;
  private initialized: boolean = false;
  private listeners: Set<AccountChangeListener> = new Set();

  async init(): Promise<GitAccount | null> {
    if (this.initialized) return this.activeAccount;

    try {
      const [rawAccounts, rawActiveId, legacyPat, legacyUser] = await Promise.all([
        AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY),
        AsyncStorage.getItem(ACTIVE_ACCOUNT_ID_KEY),
        AsyncStorage.getItem(LEGACY_PAT_KEY),
        AsyncStorage.getItem(LEGACY_USER_KEY),
      ]);

      if (rawAccounts) {
        try {
          this.accounts = JSON.parse(rawAccounts);
        } catch {
          this.accounts = [];
        }
      }

      // Auto-migrate legacy GitHub account if present and no accounts exist
      if (this.accounts.length === 0 && legacyPat) {
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

        const migratedAccount: GitAccount = {
          id: `github_${legacyLogin.toLowerCase()}_${Date.now()}`,
          provider: 'github',
          username: legacyLogin,
          displayName: legacyLogin,
          avatarUrl: legacyAvatar,
          token: legacyPat,
          createdAt: Date.now(),
        };

        this.accounts.push(migratedAccount);
        await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts));
      }

      // Determine active account
      if (rawActiveId) {
        this.activeAccount = this.accounts.find((a) => a.id === rawActiveId) || null;
      }

      if (!this.activeAccount && this.accounts.length > 0) {
        this.activeAccount = this.accounts[0];
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, this.activeAccount.id);
      }

      this.initialized = true;
      return this.activeAccount;
    } catch (e) {
      console.warn('[AccountService] Init failed', e);
      this.initialized = true;
      return null;
    }
  }

  getAccounts(): GitAccount[] {
    return [...this.accounts];
  }

  getActiveAccount(): GitAccount | null {
    return this.activeAccount;
  }

  async setActiveAccount(id: string): Promise<GitAccount | null> {
    const target = this.accounts.find((a) => a.id === id);
    if (!target) return null;

    this.activeAccount = target;
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, id);
    this.notifyListeners();
    return target;
  }

  async addAccount(accountData: Omit<GitAccount, 'id' | 'createdAt'>): Promise<GitAccount> {
    const newAccount: GitAccount = {
      ...accountData,
      id: `${accountData.provider}_${accountData.username.toLowerCase()}_${Date.now()}`,
      createdAt: Date.now(),
    };

    // Replace if exact same provider + username + hostUrl exists
    const existingIndex = this.accounts.findIndex(
      (a) =>
        a.provider === newAccount.provider &&
        a.username.toLowerCase() === newAccount.username.toLowerCase() &&
        (a.hostUrl || '') === (newAccount.hostUrl || '')
    );

    if (existingIndex >= 0) {
      this.accounts[existingIndex] = newAccount;
    } else {
      this.accounts.push(newAccount);
    }

    this.activeAccount = newAccount;

    await Promise.all([
      AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts)),
      AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, newAccount.id),
    ]);

    this.notifyListeners();
    return newAccount;
  }

  async removeAccount(id: string): Promise<void> {
    this.accounts = this.accounts.filter((a) => a.id !== id);

    if (this.activeAccount?.id === id) {
      this.activeAccount = this.accounts[0] || null;
      if (this.activeAccount) {
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, this.activeAccount.id);
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_ID_KEY);
      }
    }

    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(this.accounts));
    this.notifyListeners();
  }

  subscribe(listener: AccountChangeListener): () => void {
    this.listeners.add(listener);
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

