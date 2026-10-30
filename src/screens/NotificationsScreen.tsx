import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubNotification } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setRefreshing(true);
    const list = await GitHubApiService.getNotifications();
    setNotifications(list);
    setRefreshing(false);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const filtered = notifications.filter(
    (n) => activeFilter === 'all' || n.unread
  );

  const renderItem = ({ item }: { item: GitHubNotification }) => {
    return (
      <View
        style={[
          styles.notificationCard,
          item.unread && styles.notificationCardUnread,
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.repoName}>{item.repository.full_name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.subject.type}</Text>
          </View>
        </View>

        <Text style={styles.subjectTitle}>{item.subject.title}</Text>

        <View style={styles.bottomRow}>
          <Text style={styles.reasonText}>Reason: {item.reason}</Text>
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inbox</Text>
          <Text style={styles.subtitle}>
            {notifications.filter((n) => n.unread).length} unread notifications
          </Text>
        </View>

        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === 'unread' && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter('unread')}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === 'unread' && styles.filterTabTextActive,
            ]}
          >
            Unread
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            activeFilter === 'all' && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === 'all' && styles.filterTabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadNotifications}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No unread notifications across your repositories.
            </Text>
          </View>
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
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
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
  },
  typeBadge: {
    backgroundColor: Colors.backgroundElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
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
  },
});
