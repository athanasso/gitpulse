import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemePalette, Spacing } from '../constants/theme';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Linking,
  ActivityIndicator,
} from 'react-native';

import { GitHubNotification } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { AccountService } from '../services/AccountService';
import { NotificationService } from '../services/NotificationService';
import { GitAccount, PROVIDER_REGISTRY } from '../types/provider';
import { formatRepoTimestamp } from '../utils/date';
import { PaginationControl } from '../components/PaginationControl';
import { ThemedDialog, DialogButton } from '../components/ThemedDialog';

type FilterType = 'unread' | 'all' | 'PullRequest' | 'Issue' | 'Release';

const PAGE_SIZE = 30;

export const NotificationsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterType>('unread');
  const [isAuth, setIsAuth] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeAccount, setActiveAccount] = useState<GitAccount | null>(() =>
    AccountService.getActiveAccount()
  );

  useEffect(() => {
    const unsub = AccountService.subscribe((active) => {
      setActiveAccount(active);
      setScopeError(null);
      loadNotifications(1);
    });
    return () => unsub();
  }, []);

  const providerMeta = PROVIDER_REGISTRY[activeAccount?.provider || 'github'];
  const manageUrl = providerMeta.manageTokensUrl(activeAccount?.hostUrl);

  // App-themed Dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    icon?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
    buttons?: DialogButton[];
  }>({
    visible: false,
    title: '',
  });

  const showDialog = (config: {
    title: string;
    message?: string;
    icon?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
    buttons?: DialogButton[];
  }) => {
    setDialogConfig({
      visible: true,
      ...config,
    });
  };

  const hideDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  const flatListRef = React.useRef<FlatList<GitHubNotification>>(null);

  useEffect(() => {
    loadNotifications(1);
  }, []);

  const loadNotifications = async (targetPage: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setScopeError(null);
    } else {
      setPageLoading(true);
    }

    const auth = await GitHubApiService.init();
    setIsAuth(auth);

    if (auth) {
      const list = await GitHubApiService.getNotifications(targetPage, PAGE_SIZE);
      const err = GitHubApiService.getLastNotificationError();
      if (err) {
        setScopeError(err);
      }

      setNotifications(list);
      setPage(targetPage);
      setHasMore(list.length >= PAGE_SIZE);

      // Keep tab badge count in sync with unread notifications
      const unreadCount = list.filter((n) => n.unread).length;
      NotificationService.setUnreadCount(unreadCount);
    } else {
      setNotifications([]);
      NotificationService.clear();
    }

    if (isRefresh) setRefreshing(false);
    else setPageLoading(false);

    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const goToPage = async (newPage: number) => {
    if (pageLoading || newPage < 1) return;
    await loadNotifications(newPage, false);
  };

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    NotificationService.decrement(1);
    // Remote GitHub API update
    await GitHubApiService.markNotificationRead(id);
  };

  const markAllAsRead = () => {
    if (markingAll || notifications.length === 0) return;
    showDialog({
      title: 'Mark All as Read',
      message: `Are you sure you want to mark all inbox notifications as read on ${providerMeta.name}?`,
      icon: '📬',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: hideDialog },
        {
          text: 'Mark All Read',
          style: 'primary',
          onPress: async () => {
            hideDialog();
            setMarkingAll(true);
            // Optimistic UI update
            setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
            NotificationService.clear();
            // Remote GitHub API update
            await GitHubApiService.markAllNotificationsRead();
            setMarkingAll(false);
          },
        },
      ],
    });
  };

  const getWebUrl = (notif: GitHubNotification): string => {
    if (notif.subject?.url) {
      if (notif.subject.url.startsWith('http://') || notif.subject.url.startsWith('https://')) {
        if (!notif.subject.url.includes('/api/')) {
          return notif.subject.url;
        }
      }
      // Map API URL: https://api.github.com/repos/owner/repo/pulls/1 -> https://github.com/owner/repo/pull/1
      const url = notif.subject.url
        .replace('https://api.github.com/repos/', 'https://github.com/')
        .replace('/pulls/', '/pull/');
      return url;
    }
    return (notif.repository as any)?.html_url || `https://github.com/${notif.repository.full_name}`;
  };

  const handleOpenNotification = async (item: GitHubNotification) => {
    if (item.unread) {
      markAsRead(item.id);
    }
    const webUrl = getWebUrl(item);
    try {
      await Linking.openURL(webUrl);
    } catch {
      // ignore
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PullRequest':
        return '🔀';
      case 'Issue':
        return '🟢';
      case 'Release':
        return '🏷️';
      case 'Commit':
        return '💬';
      case 'Discussion':
        return '🗣️';
      default:
        return '🔔';
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'unread') return n.unread;
    if (activeFilter === 'all') return true;
    return n.subject.type === activeFilter;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  const renderItem = ({ item }: { item: GitHubNotification }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          item.unread && styles.notificationCardUnread,
        ]}
        onPress={() => handleOpenNotification(item)}
        activeOpacity={0.7}
      >
        <View style={styles.topRow}>
          <Text style={styles.repoName}>{item.repository.full_name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeIcon}>
              {getTypeIcon(item.subject.type)}
            </Text>
            <Text style={styles.typeBadgeText}>{item.subject.type}</Text>
          </View>
        </View>

        <Text style={styles.subjectTitle}>{item.subject.title}</Text>

        <View style={styles.bottomRow}>
          <Text style={styles.reasonText}>
            Reason: {item.reason.replace(/_/g, ' ')}
          </Text>
          <Text style={styles.dateText}>
            {formatRepoTimestamp(item.updated_at)}
          </Text>

          {item.unread && (
            <TouchableOpacity
              style={styles.markReadButton}
              onPress={() => markAsRead(item.id)}
            >
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inbox</Text>
          <Text style={styles.subtitle}>
            {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            style={styles.markAllButton}
            disabled={markingAll}
            activeOpacity={0.7}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.cyan} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Scope Warning Banner if token missing 'notifications' permission */}
      {scopeError && (
        <View style={styles.scopeWarningCard}>
          <Text style={styles.scopeWarningIcon}>⚠️</Text>
          <View style={styles.scopeWarningContent}>
            <Text style={styles.scopeWarningTitle}>
              {providerMeta.name} Notifications Permission Needed
            </Text>
            <Text style={styles.scopeWarningText}>
              Your {providerMeta.name} token requires{' '}
              <Text style={styles.scopeBold}>
                {providerMeta.type === 'github'
                  ? 'notifications'
                  : providerMeta.type === 'gitlab'
                  ? 'api'
                  : providerMeta.type === 'gitea'
                  ? 'read:notification or read:issue'
                  : 'account:read and pullrequest:read'}
              </Text>{' '}
              permission to access your inbox.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(manageUrl)}
              style={styles.scopeLinkBtn}
            >
              <Text style={styles.scopeLinkText}>
                Edit Permissions on {providerMeta.name} ↗
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Tabs (Horizontal Scrollable View so texts are never cut off) */}
      <View style={styles.filterTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'unread' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('unread')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'unread' && styles.filterTabTextActive,
              ]}
            >
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'all' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'all' && styles.filterTabTextActive,
              ]}
            >
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'PullRequest' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('PullRequest')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'PullRequest' && styles.filterTabTextActive,
              ]}
            >
🔀 Pull Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'Issue' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('Issue')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'Issue' && styles.filterTabTextActive,
              ]}
            >
🟢 Issues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'Release' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('Release')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === 'Release' && styles.filterTabTextActive,
              ]}
            >
🏷️ Releases
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List with Actual Page Controls */}
      <FlatList
        ref={flatListRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(1, true)}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 24 }}>
              <PaginationControl
                page={page}
                hasNext={hasMore}
                hasPrev={page > 1}
                loading={pageLoading}
                onPageChange={goToPage}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !refreshing ? (
            !isAuth ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔒</Text>
                <Text style={styles.emptyTitle}>Personal Token Required</Text>
                <Text style={styles.emptySubtitle}>
                  Connect an account ({providerMeta.name}, GitLab, Gitea, or Bitbucket) with notifications permission to view your inbox.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>
                  No notifications matching the active filter.
                </Text>
              </View>
            )
          ) : undefined
        }
      />

      {/* App-Themed Pop-Up Dialog */}
      <ThemedDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        icon={dialogConfig.icon}
        type={dialogConfig.type}
        buttons={dialogConfig.buttons}
        onClose={hideDialog}
      />
    </View>
  );
};

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  markAllButton: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.cyan,
  },
  scopeWarningCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    overflow: 'hidden',
  },
  scopeWarningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  scopeWarningContent: {
    flex: 1,
  },
  scopeWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 2,
  },
  scopeWarningText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  scopeBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scopeLinkBtn: {
    marginTop: 6,
  },
  scopeLinkText: {
    fontSize: 12,
    color: colors.cyan,
    fontWeight: '600',
  },
  filterTabsContainer: {
    marginBottom: Spacing.md,
  },
  filterTabsScroll: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  filterTab: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 80,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  notificationCardUnread: {
    borderColor: colors.primary,
    backgroundColor: '#0F162B',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  repoName: {
    fontSize: 12,
    color: colors.cyan,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    gap: 4,
  },
  typeBadgeIcon: {
    fontSize: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  reasonText: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  markReadButton: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markReadText: {
    fontSize: 11,
    color: colors.emerald,
    fontWeight: '700',
  },
  loadingMoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
