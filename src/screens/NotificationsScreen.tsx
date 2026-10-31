import React, { useState, useEffect } from 'react';
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
import { Colors, Spacing } from '../constants/theme';
import { GitHubNotification } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';

type FilterType = 'unread' | 'all' | 'PullRequest' | 'Issue' | 'Release';

const PAGE_SIZE = 30;

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [activeFilter, setActiveFilter] = useState<FilterType>('unread');
  const [isAuth, setIsAuth] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const loadNotifications = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setScopeError(null);
      setPage(1);
      setHasMore(true);
    }

    const auth = await GitHubApiService.init();
    setIsAuth(auth);

    if (auth) {
      const currentPage = isRefresh ? 1 : page;
      const list = await GitHubApiService.getNotifications(currentPage, PAGE_SIZE);
      const err = GitHubApiService.getLastNotificationError();
      if (err) {
        setScopeError(err);
      }

      if (isRefresh) {
        setNotifications(list);
        setRefreshing(false);
        setHasMore(list.length >= PAGE_SIZE);
        setPage(2);
      } else {
        setNotifications((prev) => [...prev, ...list]);
        setHasMore(list.length >= PAGE_SIZE);
        setPage((prev) => prev + 1);
        setLoadingMore(false);
      }
    } else {
      setNotifications([]);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleEndReached = async () => {
    if (hasMore && !loadingMore && !refreshing && isAuth) {
      setLoadingMore(true);
      await loadNotifications(false);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    // Remote GitHub API update
    await GitHubApiService.markNotificationRead(id);
  };

  const markAllAsRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    // Remote GitHub API update
    await GitHubApiService.markAllNotificationsRead();
    setMarkingAll(false);
  };

  const getWebUrl = (notif: GitHubNotification): string => {
    if (notif.subject?.url) {
      // Map API URL: https://api.github.com/repos/owner/repo/pulls/1 -> https://github.com/owner/repo/pull/1
      const url = notif.subject.url
        .replace('https://api.github.com/repos/', 'https://github.com/')
        .replace('/pulls/', '/pull/');
      return url;
    }
    return `https://github.com/${notif.repository.full_name}`;
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
            {new Date(item.updated_at).toLocaleDateString()}
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
              <ActivityIndicator size="small" color={Colors.cyan} />
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
            <Text style={styles.scopeWarningTitle}>Notifications Scope Needed</Text>
            <Text style={styles.scopeWarningText}>
              Your GitHub Personal Access Token requires the{' '}
              <Text style={styles.scopeBold}>notifications</Text> scope to access
              your inbox.
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL('https://github.com/settings/tokens')
              }
              style={styles.scopeLinkBtn}
            >
              <Text style={styles.scopeLinkText}>
                Edit Token Scopes on GitHub ↗
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

      {/* List with Pagination */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={Colors.primary}
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingMoreText}>Loading more notifications...</Text>
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
                  Add a GitHub Personal Access Token (PAT) with notifications
                  scope in the Profile tab to view your inbox.
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  markAllButton: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.cyan,
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
    color: Colors.gold,
    marginBottom: 2,
  },
  scopeWarningText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  scopeBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scopeLinkBtn: {
    marginTop: 6,
  },
  scopeLinkText: {
    fontSize: 12,
    color: Colors.cyan,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
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
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  notificationCardUnread: {
    borderColor: Colors.primary,
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
    color: Colors.cyan,
    fontWeight: '600',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundElevated,
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
    color: Colors.textSecondary,
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  reasonText: {
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  markReadButton: {
    backgroundColor: Colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markReadText: {
    fontSize: 11,
    color: Colors.emerald,
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
    color: Colors.textMuted,
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
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
