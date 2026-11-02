import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemePalette, Spacing } from '../constants/theme';
import { GitHubRepo, GitHubUser } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { CacheService, CacheKeys } from '../services/CacheService';
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
  const [searchScope, setSearchScope] = useState<'mine' | 'global'>('mine');
  const [remoteResults, setRemoteResults] = useState<GitHubRepo[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const flatListRef = useRef<FlatList<GitHubRepo>>(null);

  useEffect(() => {
    // 1. Hydrate from phone storage immediately (0ms)
    CacheService.get<GitHubRepo[]>(CacheKeys.USER_REPOS_PAGE_1).then((cached) => {
      if (cached && cached.length > 0 && repos.length === 0) {
        setRepos(cached);
      }
    });
    // 2. Refresh from network in background
    loadRepos(1);
  }, []);

  const loadRepos = async (targetPage: number = 1, isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (repos.length === 0) {
      setPageLoading(true);
    }

    try {
      const [list, u] = await Promise.all([
        GitHubApiService.getUserRepos(targetPage, PAGE_SIZE),
        currentUser ? Promise.resolve(currentUser) : GitHubApiService.getCurrentUser(),
      ]);

      if (list && list.length > 0) {
        setRepos(list);
        setHasMore(list.length >= PAGE_SIZE);
        if (targetPage === 1) {
          CacheService.set(CacheKeys.USER_REPOS_PAGE_1, list);
        }
      }
      setPage(targetPage);
      if (u) setCurrentUser(u);
    } catch (e) {
      console.warn('loadRepos error', e);
    } finally {
      setRefreshing(false);
      setPageLoading(false);
    }

    if (targetPage > 1) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const goToPage = async (newPage: number) => {
    if (pageLoading || searchingRemote || newPage < 1) return;
    if (searchScope === 'global' && searchQuery.trim().length >= 2) {
      setSearchingRemote(true);
      const results = await GitHubApiService.searchRepos(searchQuery.trim(), newPage, PAGE_SIZE);
      setRemoteResults(results);
      setHasMoreSearch(results.length >= PAGE_SIZE);
      setSearchPage(newPage);
      setSearchingRemote(false);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      await loadRepos(newPage, false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (text.trim().length >= 2) {
      setSearchingRemote(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          setSearchPage(1);
          const results = await GitHubApiService.searchRepos(text.trim(), 1, PAGE_SIZE);
          setRemoteResults(results);
          setHasMoreSearch(results.length >= PAGE_SIZE);
        } catch (e) {
          console.warn('Remote search failed', e);
        } finally {
          setSearchingRemote(false);
        }
      }, 350);
    } else {
      setRemoteResults([]);
      setSearchingRemote(false);
    }
  };

  const handleSwitchScope = (scope: 'mine' | 'global') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchScope(scope);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const isGlobalActive = searchScope === 'global' && searchQuery.trim().length > 0;
  const sourceList = isGlobalActive ? remoteResults : repos;
  const searchTotal = GitHubApiService.getLastSearchTotalCount();
  const globalMatchCount = searchTotal || remoteResults.length;

  // Local matching count in user's repositories
  const localMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return repos.length;
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.language && r.language.toLowerCase().includes(q))
    ).length;
  }, [repos, searchQuery]);

  // Real total number of repositories
  const realTotalRepos = isGlobalActive
    ? globalMatchCount
    : searchQuery.trim()
    ? localMatchCount
    : currentUser
    ? (currentUser.public_repos || 0) + (currentUser.total_private_repos || 0)
    : repos.length;

  const totalPages =
    realTotalRepos > 0 ? Math.ceil(realTotalRepos / PAGE_SIZE) : undefined;

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

    // Search query filter (when filtering user's repos locally)
    if (!isGlobalActive && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.language && r.language.toLowerCase().includes(q))
      );
    }

    // Language filter
    if (selectedLanguage !== 'All') {
      result = result.filter((r) => r.language === selectedLanguage);
    }

    // Type / Visibility filter (applied to user's repos)
    if (!isGlobalActive) {
      if (typeFilter === 'public') {
        result = result.filter((r) => !r.private);
      } else if (typeFilter === 'private') {
        result = result.filter((r) => r.private);
      } else if (typeFilter === 'sources') {
        result = result.filter((r) => !r.fork);
      } else if (typeFilter === 'forks') {
        result = result.filter((r) => r.fork);
      }
    }

    // Sort order
    return [...result].sort((a, b) => {
      if (sortBy === 'stars') return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if (sortBy === 'forks') return (b.forks_count || 0) - (a.forks_count || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [sourceList, isGlobalActive, searchQuery, selectedLanguage, typeFilter, sortBy]);

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
    const isGlobal = isGlobalActive;

    return (
      <TouchableOpacity
        style={[
          styles.repoCard,
          isGlobal && styles.globalRepoCard,
          isCompact && { paddingVertical: 10, paddingHorizontal: 12 },
        ]}
        onPress={() => openRepo(item)}
        activeOpacity={0.7}
      >
        <View style={styles.repoTopRow}>
          <View style={styles.titleWrap}>
            {isGlobal && item.owner?.avatar_url && (
              <Image
                source={{ uri: item.owner.avatar_url }}
                style={styles.searchOwnerAvatar}
              />
            )}
            <Text style={styles.repoTitle} numberOfLines={1}>
              {isGlobal ? item.full_name : item.name}
            </Text>
          </View>

          <View style={styles.badgesGroup}>
            {isGlobal ? (
              <View style={styles.globalBadge}>
                <Text style={styles.globalBadgeText}>🌐 Global</Text>
              </View>
            ) : (
              <>
                {item.fork && settings.repoShowForkBadge !== false && (
                  <View style={styles.forkBadge}>
                    <Text style={styles.forkBadgeText}>🍴 Fork</Text>
                  </View>
                )}
                <View style={styles.visibilityBadge}>
                  <Text style={styles.visibilityText}>
                    {item.private ? '🔒 Private' : 'Public'}
                  </Text>
                </View>
              </>
            )}
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
                      LANGUAGE_COLORS[item.language] || colors.primary,
                  },
                ]}
              />
              )}
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

  const renderSkeletonList = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={styles.skeletonTopRow}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonBadge} />
          </View>
          <View style={styles.skeletonDesc} />
          <View style={styles.skeletonDescShort} />
          <View style={styles.skeletonFooter}>
            <View style={styles.skeletonMeta} />
            <View style={styles.skeletonMeta} />
            <View style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your repos or all GitHub..."
          placeholderTextColor={colors.textMuted}
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

      {/* Scope Switcher: Appears when user is searching */}
      {searchQuery.trim().length > 0 && (
        <View style={styles.scopeBar}>
          <TouchableOpacity
            style={[
              styles.scopeTab,
              searchScope === 'mine' && styles.scopeTabActiveMine,
            ]}
            onPress={() => handleSwitchScope('mine')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.scopeTabText,
                searchScope === 'mine' && styles.scopeTabTextActiveMine,
              ]}
            >
              ⚡ My Repos ({localMatchCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.scopeTab,
              searchScope === 'global' && styles.scopeTabActiveGlobal,
            ]}
            onPress={() => handleSwitchScope('global')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.scopeTabText,
                searchScope === 'global' && styles.scopeTabTextActiveGlobal,
              ]}
            >
              🌐 All GitHub (
              {searchingRemote
                ? '...'
                : globalMatchCount > 1000
                ? `${(globalMatchCount / 1000).toFixed(1)}k`
                : globalMatchCount}
              )
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Distinct Scope Status Banner */}
      {searchQuery.trim().length > 0 && (
        <View
          style={[
            styles.scopeBanner,
            searchScope === 'global'
              ? styles.scopeBannerGlobal
              : styles.scopeBannerMine,
          ]}
        >
          <View style={styles.scopeBannerLeft}>
            <Text style={styles.scopeBannerIcon}>
              {searchScope === 'global' ? '🌐' : '⚡'}
            </Text>
            <Text
              style={[
                styles.scopeBannerTitle,
                {
                  color:
                    searchScope === 'global' ? colors.cyan : colors.primary,
                },
              ]}
            >
              {searchScope === 'global'
                ? 'Global GitHub Search'
                : 'Your Repositories'}
            </Text>
            <Text style={styles.scopeBannerQuery} numberOfLines={1}>
              "{searchQuery}"
            </Text>
          </View>
          <Text style={styles.scopeBannerCount}>
            {searchScope === 'global'
              ? `${globalMatchCount} found`
              : `${localMatchCount} matches`}
          </Text>
        </View>
      )}

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
      {pageLoading && repos.length === 0 && !searchQuery.trim() ? (
        renderSkeletonList()
      ) : (
      <FlatList
        ref={flatListRef}
        data={filteredRepos}
        keyExtractor={(item, index) => (item?.id ? `${item.id}-${item.full_name || ''}-${index}` : `${index}`)}
        renderItem={renderRepoItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRepos(1, true)}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={
          filteredRepos.length > 0 ? (
            <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: 24 }}>
              <PaginationControl
                page={isGlobalActive ? searchPage : page}
                hasNext={isGlobalActive ? hasMoreSearch : hasMore}
                hasPrev={(isGlobalActive ? searchPage : page) > 1}
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
                <Text style={styles.emptyIcon}>🔑</Text>
                <Text style={styles.emptyTitle}>GitHub Token Required</Text>
                <Text style={styles.emptySubtitle}>
                  Connect your Personal Access Token in Profile to view your repositories, or search public repositories above.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>
                  {searchQuery.trim() ? (searchScope === 'global' ? '🌐' : '⚡') : '📂'}
                </Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim()
                    ? searchScope === 'mine'
                      ? 'No Repositories In Your Account'
                      : 'No Repositories Found On GitHub'
                    : 'No Repositories Found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery.trim()
                    ? searchScope === 'mine'
                      ? `We couldn't find "${searchQuery}" in your personal repositories.`
                      : `No public repositories found across GitHub for "${searchQuery}".`
                    : 'No repositories match your active search or filter criteria.'}
                </Text>
                {searchQuery.trim().length > 0 &&
                  searchScope === 'mine' &&
                  (remoteResults.length > 0 || searchingRemote) && (
                    <TouchableOpacity
                      style={styles.switchScopeBtn}
                      onPress={() => handleSwitchScope('global')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.switchScopeBtnText}>
                        Search across all of GitHub (
                        {searchingRemote
                          ? '...'
                          : globalMatchCount > 1000
                          ? `${(globalMatchCount / 1000).toFixed(1)}k`
                          : globalMatchCount}{' '}
                        found) →
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            )
          ) : undefined
        }
      />
      )}

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

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: colors.textPrimary,
    fontSize: 14,
  },
  clearSearch: {
    color: colors.textMuted,
    fontSize: 14,
    padding: 4,
  },
  scopeBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: 8,
    gap: 8,
  },
  scopeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scopeTabActiveMine: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  scopeTabActiveGlobal: {
    backgroundColor: colors.cyanMuted,
    borderColor: colors.cyan,
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scopeTabTextActiveMine: {
    color: colors.primary,
    fontWeight: '700',
  },
  scopeTabTextActiveGlobal: {
    color: colors.cyan,
    fontWeight: '700',
  },
  scopeBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  scopeBannerMine: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder,
  },
  scopeBannerGlobal: {
    backgroundColor: colors.cyanMuted,
    borderColor: colors.cyan,
  },
  scopeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  scopeBannerIcon: {
    fontSize: 13,
  },
  scopeBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  scopeBannerQuery: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  scopeBannerCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  searchOwnerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  globalBadge: {
    backgroundColor: colors.cyanMuted,
    borderWidth: 1,
    borderColor: colors.cyan,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  globalBadgeText: {
    color: colors.cyan,
    fontSize: 10,
    fontWeight: '700',
  },
  globalRepoCard: {
    borderColor: colors.cyanMuted,
  },
  switchScopeBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.cyanMuted,
    borderWidth: 1,
    borderColor: colors.cyan,
  },
  switchScopeBtnText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  langPill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  langPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    color: colors.textSecondary,
    marginRight: 4,
  },
  langPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  langPillCount: {
    fontSize: 10,
    color: colors.textMuted,
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
    color: colors.textMuted,
    fontWeight: '600',
    marginRight: 2,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sortPillActive: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.cyan,
  },
  sortPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sortPillTextActive: {
    color: colors.cyan,
    fontWeight: '700',
  },
  sortBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaCountText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  resetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetBtnText: {
    fontSize: 11,
    color: colors.ruby,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 80,
    gap: 12,
  },
  repoCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.textPrimary,
    flex: 1,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  forkBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  forkBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  visibilityBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  visibilityText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  repoDesc: {
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  updatedDate: {
    fontSize: 11,
    color: colors.textMuted,
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
    color: colors.textMuted,
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
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: Spacing.md,
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonTitle: {
    width: '45%',
    height: 18,
    backgroundColor: colors.cardElevated,
    borderRadius: 6,
  },
  skeletonBadge: {
    width: 60,
    height: 18,
    backgroundColor: colors.cardElevated,
    borderRadius: 6,
  },
  skeletonDesc: {
    width: '85%',
    height: 12,
    backgroundColor: colors.cardElevated,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonDescShort: {
    width: '60%',
    height: 12,
    backgroundColor: colors.cardElevated,
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  skeletonMeta: {
    width: 50,
    height: 12,
    backgroundColor: colors.cardElevated,
    borderRadius: 4,
  },
});
