import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Colors, Spacing } from './src/constants/theme';
import { RepositoriesScreen } from './src/screens/RepositoriesScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { GitHubApiService } from './src/services/GitHubApiService';

type Tab = 'repos' | 'inbox' | 'profile';

export default function App() {
  // Prevent screen sleep during reading sessions / code reviews
  useKeepAwake();

  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [unreadCount, setUnreadCount] = useState<number>(2);

  useEffect(() => {
    GitHubApiService.init().then(() => {
      GitHubApiService.getNotifications().then((n) => {
        setUnreadCount(n.filter((x) => x.unread).length);
      });
    });
  }, []);

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
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {/* Top App Header */}
        <View style={styles.topNav}>
          <View style={styles.brandRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.brandTitle}>GitPulse</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v1.0</Text>
            </View>
          </View>
        </View>

        {/* Screen Switcher */}
        <View style={styles.content}>
          {activeTab === 'repos' && <RepositoriesScreen />}
          {activeTab === 'inbox' && <NotificationsScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
        </View>

        {/* Bottom Navigation Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'repos' && styles.tabItemActive]}
            onPress={() => setActiveTab('repos')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>⚡</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'repos' && styles.tabLabelActive,
              ]}
            >
              Repositories
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'inbox' && styles.tabItemActive]}
            onPress={() => setActiveTab('inbox')}
            activeOpacity={0.7}
          >
            <View style={styles.iconWithBadge}>
              <Text style={styles.tabIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'inbox' && styles.tabLabelActive,
              ]}
            >
              Inbox
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'profile' && styles.tabItemActive]}
            onPress={() => setActiveTab('profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>👤</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'profile' && styles.tabLabelActive,
              ]}
            >
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.emerald,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  versionBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingVertical: Spacing.sm,
    paddingBottom: 20,
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: Colors.cardElevated,
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
    backgroundColor: Colors.ruby,
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
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
});
