import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Image,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Spacing } from './src/constants/theme';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CustomizationProvider } from './src/context/CustomizationContext';
import { CustomizationModal } from './src/components/CustomizationModal';
import { AccountSwitcherModal } from './src/components/AccountSwitcherModal';
import { AccountService } from './src/services/AccountService';
import { GitAccount, PROVIDER_REGISTRY } from './src/types/provider';
import { RepositoriesScreen } from './src/screens/RepositoriesScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { GitHubApiService } from './src/services/GitHubApiService';

type Tab = 'repos' | 'explore' | 'inbox' | 'profile';

function AppContent() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Prevent screen sleep during reading sessions / code reviews
  useKeepAwake();

  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [customizationVisible, setCustomizationVisible] = useState(false);
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [activeAccount, setActiveAccount] = useState<GitAccount | null>(() =>
    AccountService.getActiveAccount()
  );
  const [accounts, setAccounts] = useState<GitAccount[]>(() =>
    AccountService.getAccounts()
  );
  const [accountKey, setAccountKey] = useState(0);

  useEffect(() => {
    AccountService.init().then((acc) => {
      setActiveAccount(acc);
      setAccounts(AccountService.getAccounts());
    });

    const unsub = AccountService.subscribe((acc, allAccounts) => {
      setActiveAccount(acc);
      setAccounts(allAccounts);
      setAccountKey((prev) => prev + 1);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    GitHubApiService.init().then((isAuth) => {
      if (isAuth) {
        GitHubApiService.getNotifications().then((n) => {
          setUnreadCount(n.filter((x) => x.unread).length);
        });
      }
    });
  }, [accountKey]);

  // Hardware back button returns to Repositories tab
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab !== 'repos') {
        setActiveTab('repos');
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeTab]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Top App Header */}
      <View
        style={[
          styles.topNav,
          {
            borderBottomColor: colors.cardBorder,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <Image
            source={require('./assets/favicon.png')}
            style={styles.brandIcon}
          />
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            GitPulse
          </Text>
          <View
            style={[
              styles.versionBadge,
              {
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.versionText, { color: colors.primary }]}>
              v1.3.1
            </Text>
          </View>
        </View>

        {/* Right Header Actions: Multi-Provider Account Pill & Settings */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.accountPill,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.cardBorder,
              },
            ]}
            onPress={() => setAccountSwitcherVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel={`Connected accounts: ${accounts.length}. Active: @${activeAccount ? activeAccount.username : 'Account'}`}
          >
            <Text style={styles.accountPillIcon}>
              {activeAccount ? PROVIDER_REGISTRY[activeAccount.provider].icon : '⚡'}
            </Text>
            <Text
              style={[styles.accountPillUser, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              @{activeAccount ? activeAccount.username : 'Account'}
            </Text>
            <View
              style={[
                styles.accountCountBadge,
                {
                  backgroundColor:
                    accounts.length > 1 ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.accountCountBadgeText,
                  {
                    color: accounts.length > 1 ? '#FFFFFF' : colors.textMuted,
                  },
                ]}
              >
                {accounts.length}
              </Text>
            </View>
            <Text style={[styles.accountPillChevron, { color: colors.textMuted }]}>
              ▾
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerSettingsBtn,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.cardBorder,
              },
            ]}
            onPress={() => setCustomizationVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.headerSettingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Switcher */}
      <View style={styles.content} key={accountKey}>
        {activeTab === 'repos' && <RepositoriesScreen />}
        {activeTab === 'explore' && <ExploreScreen />}
        {activeTab === 'inbox' && <NotificationsScreen />}
        {activeTab === 'profile' && (
          <ProfileScreen onOpenCustomization={() => setCustomizationVisible(true)} />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.backgroundElevated,
            borderTopColor: colors.cardBorder,
            paddingBottom: Math.max(insets.bottom, 10) + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'repos' && {
              backgroundColor: colors.cardElevated,
            },
          ]}
          onPress={() => setActiveTab('repos')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>⚡</Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'repos' ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Repositories
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'explore' && {
              backgroundColor: colors.cardElevated,
            },
          ]}
          onPress={() => setActiveTab('explore')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🧭</Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'explore' ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Explore
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'inbox' && {
              backgroundColor: colors.cardElevated,
            },
          ]}
          onPress={() => setActiveTab('inbox')}
          activeOpacity={0.7}
        >
          <View style={styles.iconWithBadge}>
            <Text style={styles.tabIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View
                style={[
                  styles.unreadBadge,
                  { backgroundColor: colors.ruby },
                ]}
              >
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'inbox' ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Inbox
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'profile' && {
              backgroundColor: colors.cardElevated,
            },
          ]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>👤</Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === 'profile' ? colors.primary : colors.textMuted,
              },
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Customization & Themes Modal */}
      <CustomizationModal
        visible={customizationVisible}
        onClose={() => setCustomizationVisible(false)}
      />

      {/* Account & Multi-Provider Switcher Modal */}
      <AccountSwitcherModal
        visible={accountSwitcherVisible}
        onClose={() => setAccountSwitcherVisible(false)}
        onAccountSwitched={(acc) => {
          setActiveAccount(acc);
          setAccountKey((prev) => prev + 1);
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <CustomizationProvider>
          <AppContent />
        </CustomizationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  versionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headerSettingsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettingsIcon: {
    fontSize: 16,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 185,
  },
  accountPillIcon: {
    fontSize: 14,
  },
  accountPillUser: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  accountCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCountBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  accountPillChevron: {
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  iconWithBadge: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
