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
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubRepo } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { RepoDetailModal } from './RepoDetailModal';

type RepoTypeFilter = 'all' | 'public' | 'private' | 'sources' | 'forks';
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

export const RepositoriesScreen: React.FC = () => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [remoteResults, setRemoteResults] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<RepoTypeFilter>('all');
  const [sortBy, setSortBy] = useState<RepoSortOption>('updated');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setRefreshing(true);
    const list = await GitHubApiService.getUserRepos();
    setRepos(list);
    setRefreshing(false);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);

    if (text.trim().length >= 3) {
      const results = await GitHubApiService.searchRepos(text);
      setRemoteResults(results);
    } else {
      setRemoteResults([]);
    }
  };

  // Base list: remote search results if searching and non-empty, otherwise user's repos
  const sourceList = searchQuery.trim().length >= 3 && remoteResults.length > 0
    ? remoteResults
    : repos;

  // Extract all unique languages dynamically from whatever repos exist in data
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
            Updated {new Date(item.updated_at).toLocaleDateString()}
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

      {/* Type / Visibility Filter Row */}
      <View style={styles.typeFilterRow}>
        {(['all', 'sources', 'forks', 'public', 'private'] as RepoTypeFilter[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.typeChip,
              typeFilter === t && styles.typeChipActive,
            ]}
            onPress={() => setTypeFilter(t)}
          >
            <Text
              style={[
                styles.typeChipText,
                typeFilter === t && styles.typeChipTextActive,
              ]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dynamic Languages Scrollable Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.langScroll}
        contentContainerStyle={styles.langScrollContent}
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

      {/* Meta Bar: Counts & Sort Switcher */}
      <View style={styles.metaBar}>
        <Text style={styles.metaBarCount}>
          {filteredRepos.length}{' '}
          {filteredRepos.length === 1 ? 'repository' : 'repositories'}
        </Text>

        <View style={styles.sortGroup}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {(['updated', 'stars', 'forks', 'name'] as RepoSortOption[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortBy(s)}
              style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortBy === s && styles.sortChipTextActive,
                ]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {hasActiveFilters && (
          <TouchableOpacity onPress={resetFilters} style={styles.resetFiltersBtn}>
            <Text style={styles.resetFiltersText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Repositories List */}
      <FlatList
        data={filteredRepos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRepoItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadRepos}
            tintColor={Colors.primary}
          />
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
    marginBottom: Spacing.xs,
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
  typeFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  typeChipActive: {
    backgroundColor: Colors.cardElevated,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  langScroll: {
    flexGrow: 0,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  langScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  },
  langPillCount: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  langPillCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  metaBarCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginRight: 2,
  },
  sortChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sortChipActive: {
    backgroundColor: Colors.cardElevated,
  },
  sortChipText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  sortChipTextActive: {
    color: Colors.cyan,
    fontWeight: '700',
  },
  resetFiltersBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetFiltersText: {
    fontSize: 11,
    color: Colors.ruby,
    fontWeight: '600',
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
