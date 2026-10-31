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
import { GitHubRepo, GitHubUser } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { RepoDetailModal } from './RepoDetailModal';
import { formatRepoTimestamp } from '../utils/date';
import { PaginationControl } from '../components/PaginationControl';
import { useTheme } from '../context/ThemeContext';
import { useCustomization } from '../context/CustomizationContext';

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
  const [pageLoading, setPageLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Remote results
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<GitHubRepo[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [searchingRemote, setSearchingRemote] = useState(false);

  const { colors } = useTheme();
  const { settings } = useCustomization();

  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<RepoTypeFilter>(
    settings.defaultRepoFilter || 'all'
  );
  const [sortBy, setSortBy] = useState<RepoSortOption>(
    settings.defaultRepoSort || 'updated'
  );

  useEffect(() => {
    if (settings.defaultRepoFilter) setTypeFilter(settings.defaultRepoFilter);
  }, [settings.defaultRepoFilter]);

  useEffect(() => {
    if (settings.defaultRepoSort) setSortBy(settings.defaultRepoSort);
  }, [settings.defaultRepoSort]);

  // Detail Modal
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(
    GitHubApiService.getCachedUser()
  );

  const flatListRef = React.useRef<FlatList<GitHubRepo>>(null);

  useEffect(() => {
    loadRepos(1);
  }, []);

  const loadRepos = async (targetPage: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setPageLoading(true);
    }

    const [list, u] = await Promise.all([
      GitHubApiService.getUserRepos(targetPage, PAGE_SIZE),
      currentUser ? Promise.resolve(currentUser) : GitHubApiService.getCurrentUser(),
    ]);

    setRepos(list);
    setPage(targetPage);
    setHasMore(list.length >= PAGE_SIZE);
    if (u) setCurrentUser(u);

    if (isRefresh) {
      setRefreshing(false);
    } else {
      setPageLoading(false);
    }

    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const goToPage = async (newPage: number) => {
    if (pageLoading || searchingRemote || newPage < 1) return;
    if (searchQuery.trim().length >= 3) {
      setSearchingRemote(true);
      const results = await GitHubApiService.searchRepos(searchQuery, newPage, PAGE_SIZE);
      setRemoteResults(results);
      setHasMoreSearch(results.length >= PAGE_SIZE);
      setSearchPage(newPage);
      setSearchingRemote(false);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      await loadRepos(newPage, false);
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
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      setRemoteResults([]);
    }
  };

  const isSearch = searchQuery.trim().length >= 3 && remoteResults.length > 0;
  const searchTotal = GitHubApiService.getLastSearchTotalCount();

  // The real total number of repositories in user's GitHub account (or search result)
  const realTotalRepos = isSearch
    ? searchTotal || remoteResults.length
    : currentUser
    ? (currentUser.public_repos || 0) + (currentUser.total_private_repos || 0)
    : repos.length;

  const totalPages =
    realTotalRepos > 0 ? Math.ceil(realTotalRepos / PAGE_SIZE) : undefined;

  const sourceList = isSearch ? remoteResults : repos;

  // Extract all unique languages dynamically from repos
  const dynamicLanguages = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceList.forEach((r) => {
      if (r.language) {
        counts[r.language] = (counts[r.language] || 0) + 1;
      }
    });

    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [
      { name: 'All', count: realTotalRepos },
      ...sorted.map((lang) => ({ name: lang, count: counts[lang] })),
    ];
  }, [sourceList, realTotalRepos]);

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
    const isCompact = settings.repoCardDensity === 'compact';
    return (
      <TouchableOpacity
        style={[styles.repoCard, isCompact && { paddingVertical: 10, paddingHorizontal: 12 }]}
        onPress={() => openRepo(item)}
        activeOpacity={0.7}
      >
        <View style={styles.repoTopRow}>
          <Text style={styles.repoTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.badgesGroup}>
            {item.fork && settings.repoShowForkBadge !== false && (
              <View style={styles.forkBadge}>
                <Text style={styles.forkBadgeText}>ðŸ´ Fork</Text>
              </View>
            )}
            <View style={styles.visibilityBadge}>
              <Text style={styles.visibilityText}>
                {item.private ? 'ðŸ”’ Private' : 'Public'}
              </Text>
            </View>
          </View>
        </View>

        {item.description && !isCompact && (
          <Text style={styles.repoDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.repoFooter}>
          {item.language && (
            <View style={styles.metaItem}>
              {settings.repoShowLanguageDot !== false && (
              <View
                style={[
                  styles.langDot,
                  {
                    backgroundColor:
                      LANGUAGE_COLORS[item.language] || Colors.primary,
                  },
                ]}
              />
              )}
              <Text style={styles.metaText}>{item.language}</Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>â­</Text>
            <Text style={styles.metaText}>{item.stargazers_count}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>ðŸ´</Text>
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
        <Text style={styles.searchIcon}>ðŸ”</Text>
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
            <Text style={styles.clearSearch}>âœ•</Text>
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
            const displayText =
              t === 'all' && realTotalRepos > 0
                ? `All (${realTotalRepos})`
                : label;

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
                  {displayText}
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
            {hasActiveFilters
              ? `${filteredRepos.length} of ${realTotalRepos}`
              : `${realTotalRepos} ${realTotalRepos === 1 ? 'repo' : 'repos'}`}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Repositories List with Actual Page Controls */}
      <FlatList
        ref={flatListRef}
        data={filteredRepos}
        keyExtractor={(item) => `${item.id}-${item.full_name}`}
        renderItem={renderRepoItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRepos(1, true)}
            tintColor={Colors.primary}
          />
        }
        ListFooterComponent={
          filteredRepos.length > 0 ? (
            <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 24 }}>
              <PaginationControl
                page={isSearch ? searchPage : page}
                hasNext={isSearch ? hasMoreSearch : hasMore}
                hasPrev={(isSearch ? searchPage : page) > 1}
                totalPages={totalPages}
                totalCount={realTotalRepos}
                loading={pageLoading || searchingRemote}
                onPageChange={goToPage}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !refreshing ? (
            !GitHubApiService.isAuthenticated() && !searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>ðŸ”‘</Text>
                <Text style={styles.emptyTitle}>GitHub Token Required</Text>
                <Text style={styles.emptySubtitle}>
                  Connect your Personal Access Token in Profile to view your repositories, or search public repositories above.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>ðŸ“‚</Text>
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
        onRepoDeleted={(deletedId) => {
          setRepos((prev) => prev.filter((r) => r.id !== deletedId));
          setRemoteResults((prev) => prev.filter((r) => r.id !== deletedId));
        }}
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
