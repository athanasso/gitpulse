import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubRepo } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { RepoDetailModal } from './RepoDetailModal';
import { formatRepoTimestamp } from '../utils/date';

type RepoTypeFilter = 'all' | 'sources' | 'forks' | 'public' | 'private';
type RepoSortOption = 'updated' | 'stars' | 'forks' | 'name';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Shell: '#89E051',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
};

const PAGE_SIZE = 30;

export const RepositoriesScreen: React.FC = () => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Remote results
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<GitHubRepo[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [searchingRemote, setSearchingRemote] = useState(false);

  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<RepoTypeFilter>('all');
  const [sortBy, setSortBy] = useState<RepoSortOption>('updated');

  // Detail Modal
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadRepos(true);
  }, []);

  const loadRepos = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setPage(1);
      setHasMore(true);
    }

    const currentPage = isRefresh ? 1 : page;
    const list = await GitHubApiService.getUserRepos(currentPage, PAGE_SIZE);

    if (isRefresh) {
      setRepos(list);
      setRefreshing(false);
      setHasMore(list.length >= PAGE_SIZE);
      setPage(2);
    } else {
      setRepos((prev) => [...prev, ...list]);
      setHasMore(list.length >= PAGE_SIZE);
      setPage((prev) => prev + 1);
      setLoadingMore(false);
    }
  };

  const handleEndReached = async () => {
    if (searchQuery.trim().length >= 3) {
      // Paginate search
      if (hasMoreSearch && !searchingRemote) {
        setSearchingRemote(true);
        const nextPage = searchPage + 1;
        const moreResults = await GitHubApiService.searchRepos(
          searchQuery,
          nextPage,
          PAGE_SIZE
        );
        setRemoteResults((prev) => [...prev, ...moreResults]);
        setHasMoreSearch(moreResults.length >= PAGE_SIZE);
        setSearchPage(nextPage);
        setSearchingRemote(false);
      }
    } else {
      // Paginate repos
      if (hasMore && !loadingMore && !refreshing) {
        setLoadingMore(true);
        await loadRepos(false);
      }
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);

    if (text.trim().length >= 3) {
      setSearchingRemote(true);
      setSearchPage(1);
      const results = await GitHubApiService.searchRepos(text, 1, PAGE_SIZE);
      setRemoteResults(results);
      setHasMoreSearch(results.length >= PAGE_SIZE);
      setSearchingRemote(false);
    } else {
      setRemoteResults([]);
    }
  };

  const sourceList =
    searchQuery.trim().length >= 3 && remoteResults.length > 0
      ? remoteResults
      : repos;

  // Extract all unique languages dynamically from repos
  const dynamicLanguages = useMemo(() => {
    const counts: Record<string, number> = {};
    repos.forEach((r) => {
      if (r.language) {
        counts[r.language] = (counts[r.language] || 0) + 1;
      }
    });

    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [
      { name: 'All', count: repos.length },
      ...sorted.map((lang) => ({ name: lang, count: counts[lang] })),
    ];
  }, [repos]);

  // Dynamic Filtering & Sorting
  const filteredRepos = useMemo(() => {
    let result = sourceList;

    // Search query filter (for local matching)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.language && r.language.toLowerCase().includes(q))
      );
    }

    // Language filter
    if (selectedLanguage !== 'All') {
      result = result.filter((r) => r.language === selectedLanguage);
    }

    // Type / Visibility filter
    if (typeFilter === 'public') {
      result = result.filter((r) => !r.private);
    } else if (typeFilter === 'private') {
      result = result.filter((r) => r.private);
    } else if (typeFilter === 'sources') {
      result = result.filter((r) => !r.fork);
    } else if (typeFilter === 'forks') {
      result = result.filter((r) => r.fork);
    }

    // Sort order
    return [...result].sort((a, b) => {
      if (sortBy === 'stars') return b.stargazers_count - a.stargazers_count;
      if (sortBy === 'forks') return b.forks_count - a.forks_count;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [sourceList, searchQuery, selectedLanguage, typeFilter, sortBy]);

  const openRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setModalVisible(true);
  };

  const hasActiveFilters =
    selectedLanguage !== 'All' || typeFilter !== 'all' || sortBy !== 'updated';

  const resetFilters = () => {
    setSelectedLanguage('All');
    setTypeFilter('all');
    setSortBy('updated');
  };

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => {
    return (
      <TouchableOpacity
        style={styles.repoCard}
        onPress={() => openRepo(item)}
        activeOpacity={0.7}
      >
        <View style={styles.repoTopRow}>
          <Text style={styles.repoTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.badgesGroup}>
            {item.fork && (
              <View style={styles.forkBadge}>
                <Text style={styles.forkBadgeText}>🍴 Fork</Text>
              </View>
            )}
            <View style={styles.visibilityBadge}>
              <Text style={styles.visibilityText}>
                {item.private ? '🔒 Private' : 'Public'}
              </Text>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.repoDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.repoFooter}>
          {item.language && (
            <View style={styles.metaItem}>
              <View
                style={[
                  styles.langDot,
                  {
                    backgroundColor:
                      LANGUAGE_COLORS[item.language] || Colors.primary,
                  },
                ]}
              />
              <Text style={styles.metaText}>{item.language}</Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>⭐</Text>
            <Text style={styles.metaText}>{item.stargazers_count}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>🍴</Text>
            <Text style={styles.metaText}>{item.forks_count}</Text>
          </View>

          <Text style={styles.updatedDate}>
            Updated {formatRepoTimestamp(item.updated_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search repositories, code, topics..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Type / Visibility Filter Row (Fully scrollable to prevent text clipping) */}
      <View style={styles.filterGroup}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {(['all', 'sources', 'forks', 'public', 'private'] as RepoTypeFilter[]).map((t) => {
            const isSelected = typeFilter === t;
            const label = t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <TouchableOpacity
                key={t}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                ]}
                onPress={() => setTypeFilter(t)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Dynamic Languages Scrollable Bar */}
      <View style={styles.filterGroup}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {dynamicLanguages.map((l) => {
            const isSelected = selectedLanguage === l.name;
            const color = LANGUAGE_COLORS[l.name];
            return (
              <TouchableOpacity
                key={l.name}
                style={[
                  styles.langPill,
                  isSelected && styles.langPillActive,
                ]}
                onPress={() => setSelectedLanguage(l.name)}
                activeOpacity={0.7}
              >
                {color && (
                  <View
                    style={[
                      styles.langPillDot,
                      { backgroundColor: isSelected ? '#FFFFFF' : color },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.langPillText,
                    isSelected && styles.langPillTextActive,
                  ]}
                >
                  {l.name}
                </Text>
                <Text
                  style={[
                    styles.langPillCount,
                    isSelected && styles.langPillCountActive,
                  ]}
                >
                  {l.count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sort Options & Counter Bar */}
      <View style={styles.sortBar}>
        <View style={styles.sortBarLeft}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {(['updated', 'stars', 'forks', 'name'] as RepoSortOption[]).map((s) => {
            const isSelected = sortBy === s;
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <TouchableOpacity
                key={s}
                onPress={() => setSortBy(s)}
                style={[styles.sortPill, isSelected && styles.sortPillActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortPillText,
                    isSelected && styles.sortPillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sortBarRight}>
          <Text style={styles.metaCountText}>
            {filteredRepos.length}{' '}
            {filteredRepos.length === 1 ? 'repo' : 'repos'}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Repositories List with Infinite Scroll Pagination */}
      <FlatList
        data={filteredRepos}
        keyExtractor={(item) => `${item.id}-${item.full_name}`}
        renderItem={renderRepoItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRepos(true)}
            tintColor={Colors.primary}
          />
        }
        ListFooterComponent={
          loadingMore || searchingRemote ? (
            <View style={styles.loadingMoreBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingMoreText}>Loading more repositories...</Text>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !refreshing ? (
            !GitHubApiService.isAuthenticated() && !searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔑</Text>
                <Text style={styles.emptyTitle}>GitHub Token Required</Text>
                <Text style={styles.emptySubtitle}>
                  Connect your Personal Access Token in Profile to view your repositories, or search public repositories above.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyTitle}>No Repositories Found</Text>
                <Text style={styles.emptySubtitle}>
                  No repositories match your active search or filter criteria.
                </Text>
              </View>
            )
          ) : undefined
        }
      />

      {/* Detail Modal */}
      <RepoDetailModal
        visible={modalVisible}
        repo={selectedRepo}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardElevated,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  clearSearch: {
    color: Colors.textMuted,
    fontSize: 14,
    padding: 4,
  },
  filterGroup: {
    marginBottom: 6,
  },
  filterScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.cardElevated,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  langPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  langPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 4,
  },
  langPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  langPillCount: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  langPillCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    marginBottom: 4,
  },
  sortBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginRight: 2,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sortPillActive: {
    backgroundColor: Colors.cardElevated,
    borderColor: Colors.cyan,
  },
  sortPillText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  sortPillTextActive: {
    color: Colors.cyan,
    fontWeight: '700',
  },
  sortBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaCountText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetBtnText: {
    fontSize: 11,
    color: Colors.ruby,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 80,
    gap: 12,
  },
  repoCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  repoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  repoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  forkBadge: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  forkBadgeText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  visibilityBadge: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  visibilityText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  repoDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  repoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaIcon: {
    fontSize: 11,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  updatedDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
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
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
