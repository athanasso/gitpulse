import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemePalette, Spacing } from '../constants/theme';
import { GitHubRepo, GitHubUser } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { RepoDetailModal } from './RepoDetailModal';
import { PaginationControl } from '../components/PaginationControl';
import { useTheme } from '../context/ThemeContext';

type ExploreTab = 'trending' | 'topics' | 'developers';
type Timeframe = 'day' | 'week' | 'month';

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const LANGUAGES = [
  'All',
  'TypeScript',
  'JavaScript',
  'Python',
  'Rust',
  'Go',
  'Swift',
  'Kotlin',
  'C++',
  'Java',
  'Dart',
];

const FEATURED_TOPICS = [
  { id: 'ai', label: '🤖 AI & Agents' },
  { id: 'react-native', label: '📱 React Native' },
  { id: 'rust', label: '🦀 Rust' },
  { id: 'typescript', label: '🔷 TypeScript' },
  { id: 'python', label: '🐍 Python' },
  { id: 'devops', label: '☁️ DevOps' },
  { id: 'security', label: '🛡️ Security' },
  { id: 'developer-tools', label: '🛠️ Developer Tools' },
  { id: 'mobile', label: '📲 Mobile Apps' },
  { id: 'web3', label: '🌐 Web3' },
];

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

const PAGE_SIZE = 20;

export const ExploreScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<ExploreTab>('trending');
  const [timeframe, setTimeframe] = useState<Timeframe>('week');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('ai');

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);

  // Data & State
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [developers, setDevelopers] = useState<GitHubUser[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Repo Detail Modal
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const loadData = useCallback(
    async (targetPage: number = 1, isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        if (isSearchActive && searchQuery.trim()) {
          const results = await GitHubApiService.searchRepos(
            searchQuery.trim(),
            targetPage,
            PAGE_SIZE
          );
          setRepos(results);
          setTotalCount(GitHubApiService.getLastSearchTotalCount());
        } else if (activeTab === 'trending') {
          const { items, totalCount: count } =
            await GitHubApiService.getExploreTrending(
              timeframe,
              selectedLanguage === 'All' ? '' : selectedLanguage,
              targetPage,
              PAGE_SIZE
            );
          setRepos(items);
          setTotalCount(count);
        } else if (activeTab === 'topics') {
          const { items, totalCount: count } =
            await GitHubApiService.getExploreByTopic(
              selectedTopic,
              targetPage,
              PAGE_SIZE
            );
          setRepos(items);
          setTotalCount(count);
        } else if (activeTab === 'developers') {
          const { items, totalCount: count } =
            await GitHubApiService.getExploreDevelopers(targetPage, PAGE_SIZE);
          setDevelopers(items);
          setTotalCount(count);
        }
      } catch (e) {
        console.warn('Explore loadData failed', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeTab,
      timeframe,
      selectedLanguage,
      selectedTopic,
      isSearchActive,
      searchQuery,
    ]
  );

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [
    activeTab,
    timeframe,
    selectedLanguage,
    selectedTopic,
    isSearchActive,
  ]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setIsSearchActive(true);
      setPage(1);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
    setPage(1);
  };

  const handleSelectTab = (tab: ExploreTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setIsSearchActive(false);
    setSearchQuery('');
  };

  const formatStars = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const renderRepoCard = ({
    item,
    index,
  }: {
    item: GitHubRepo;
    index: number;
  }) => {
    const rank = (page - 1) * PAGE_SIZE + index + 1;
    const langColor =
      (item.language && LANGUAGE_COLORS[item.language]) || colors.primary;

    return (
      <TouchableOpacity
        style={styles.repoCard}
        onPress={() => {
          setSelectedRepo(item);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
          {item.owner?.avatar_url && (
            <Image
              source={{ uri: item.owner.avatar_url }}
              style={styles.ownerAvatar}
            />
          )}
          <Text style={styles.repoTitle} numberOfLines={1}>
            {item.full_name}
          </Text>
        </View>

        {item.description ? (
          <Text style={styles.repoDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          {item.language ? (
            <View style={styles.metricItem}>
              <View
                style={[styles.languageDot, { backgroundColor: langColor }]}
              />
              <Text style={styles.metricText}>{item.language}</Text>
            </View>
          ) : null}

          <View style={styles.metricItem}>
            <Text style={styles.metricIcon}>★</Text>
            <Text style={styles.metricText}>
              {formatStars(item.stargazers_count)}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricIcon}>⑂</Text>
            <Text style={styles.metricText}>
              {formatStars(item.forks_count)}
            </Text>
          </View>

          {item.topics && item.topics.length > 0 && (
            <View style={styles.topicPill}>
              <Text style={styles.topicPillText}>#{item.topics[0]}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDeveloperCard = ({
    item,
    index,
  }: {
    item: GitHubUser;
    index: number;
  }) => {
    const rank = (page - 1) * PAGE_SIZE + index + 1;

    return (
      <View style={styles.devCard}>
        <View style={styles.devLeft}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
          <Image source={{ uri: item.avatar_url }} style={styles.devAvatar} />
          <View style={styles.devInfo}>
            <Text style={styles.devLogin} numberOfLines={1}>
              {item.login}
            </Text>
            <Text style={styles.devSubtitle}>GitHub Creator</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.devProfileBtn}
          onPress={() => Linking.openURL(item.html_url).catch(() => {})}
          activeOpacity={0.7}
        >
          <Text style={styles.devProfileBtnText}>Profile ↗</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search all of GitHub..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearBtn}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Explore Tab Segments */}
      {!isSearchActive && (
        <View style={styles.tabSegmentBar}>
          <TouchableOpacity
            style={[
              styles.tabSegment,
              activeTab === 'trending' && styles.tabSegmentActive,
            ]}
            onPress={() => handleSelectTab('trending')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabSegmentText,
                activeTab === 'trending' && styles.tabSegmentTextActive,
              ]}
            >
              🔥 Trending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabSegment,
              activeTab === 'topics' && styles.tabSegmentActive,
            ]}
            onPress={() => handleSelectTab('topics')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabSegmentText,
                activeTab === 'topics' && styles.tabSegmentTextActive,
              ]}
            >
              🏷️ Topics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabSegment,
              activeTab === 'developers' && styles.tabSegmentActive,
            ]}
            onPress={() => handleSelectTab('developers')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabSegmentText,
                activeTab === 'developers' && styles.tabSegmentTextActive,
              ]}
            >
              👥 Developers
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Row for Trending */}
      {!isSearchActive && activeTab === 'trending' && (
        <View style={styles.filterSection}>
          {/* Timeframe Chips */}
          <View style={styles.timeframeRow}>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.id}
                style={[
                  styles.timeframeChip,
                  timeframe === tf.id && styles.timeframeChipActive,
                ]}
                onPress={() => {
                  setTimeframe(tf.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.timeframeChipText,
                    timeframe === tf.id && styles.timeframeChipTextActive,
                  ]}
                >
                  {tf.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Languages Horizontal Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.langScroll}
            contentContainerStyle={styles.langContent}
          >
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.filterChip,
                  selectedLanguage === lang && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSelectedLanguage(lang);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedLanguage === lang && styles.filterChipTextActive,
                  ]}
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter Row for Topics */}
      {!isSearchActive && activeTab === 'topics' && (
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.langScroll}
            contentContainerStyle={styles.langContent}
          >
            {FEATURED_TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={[
                  styles.filterChip,
                  selectedTopic === topic.id && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSelectedTopic(topic.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedTopic === topic.id && styles.filterChipTextActive,
                  ]}
                >
                  {topic.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Active Search Banner */}
      {isSearchActive && (
        <View style={styles.searchBanner}>
          <Text style={styles.searchBannerText}>
            Results for "{searchQuery}" ({totalCount} found)
          </Text>
          <TouchableOpacity onPress={handleClearSearch}>
            <Text style={styles.searchBannerClear}>Exit Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Discovering GitHub...</Text>
        </View>
      ) : activeTab === 'developers' && !isSearchActive ? (
        <FlatList
          data={developers}
          renderItem={renderDeveloperCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(1, true)}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            <PaginationControl
              page={page}
              hasNext={page * PAGE_SIZE < totalCount}
              totalPages={Math.ceil(totalCount / PAGE_SIZE)}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              loading={loading}
            />
          }
        />
      ) : (
        <FlatList
          data={repos}
          renderItem={renderRepoCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(1, true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No repositories found.</Text>
            </View>
          }
          ListFooterComponent={
            <PaginationControl
              page={page}
              hasNext={page * PAGE_SIZE < totalCount}
              totalPages={Math.ceil(totalCount / PAGE_SIZE)}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              loading={loading}
            />
          }
        />
      )}

      {/* Shared Repo Detail Modal */}
      <RepoDetailModal
        visible={modalVisible}
        repo={selectedRepo}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const createStyles = (colors: ThemePalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchSection: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: Spacing.md,
      height: 42,
    },
    searchIcon: {
      fontSize: 15,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: 0,
    },
    clearBtn: {
      padding: 4,
    },
    clearBtnText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    tabSegmentBar: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs,
      gap: 8,
    },
    tabSegment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.cardElevated,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    tabSegmentActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    tabSegmentText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabSegmentTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    filterSection: {
      paddingVertical: Spacing.xs,
    },
    timeframeRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      gap: 6,
      marginBottom: 6,
    },
    timeframeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    timeframeChipActive: {
      backgroundColor: colors.cardElevated,
      borderColor: colors.cardBorderActive,
    },
    timeframeChipText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
    },
    timeframeChipTextActive: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    langScroll: {
      paddingHorizontal: Spacing.lg,
    },
    langContent: {
      gap: 6,
      paddingRight: Spacing.xl,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterChipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    searchBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      backgroundColor: colors.cardElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    searchBannerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    searchBannerClear: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '700',
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    repoCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    rankBadge: {
      backgroundColor: colors.cardElevated,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    rankText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    ownerAvatar: {
      width: 20,
      height: 20,
      borderRadius: 5,
    },
    repoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    repoDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 10,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    },
    metricItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metricIcon: {
      fontSize: 12,
      color: colors.textMuted,
    },
    metricText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    languageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    topicPill: {
      backgroundColor: colors.cardElevated,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    topicPillText: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: '600',
    },
    devCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    devLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    devAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    devInfo: {
      flex: 1,
    },
    devLogin: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    devSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    devProfileBtn: {
      backgroundColor: colors.cardElevated,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    devProfileBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 13,
      color: colors.textMuted,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  });
