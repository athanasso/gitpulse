import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubRepo } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { RepoDetailModal } from './RepoDetailModal';

export const RepositoriesScreen: React.FC = () => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
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
    setFilteredRepos(list);
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterList(text, selectedLanguage, repos);
  };

  const handleLanguageFilter = (lang: string) => {
    setSelectedLanguage(lang);
    filterList(searchQuery, lang, repos);
  };

  const filterList = (query: string, lang: string, list: GitHubRepo[]) => {
    let result = list;

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    if (lang !== 'All') {
      result = result.filter((r) => r.language === lang);
    }

    setFilteredRepos(result);
  };

  const openRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setModalVisible(true);
  };

  const languages = ['All', 'TypeScript', 'JavaScript', 'Python'];

  const renderRepoItem = ({ item }: { item: GitHubRepo }) => {
    return (
      <TouchableOpacity
        style={styles.repoCard}
        onPress={() => openRepo(item)}
        activeOpacity={0.7}
      >
        <View style={styles.repoTopRow}>
          <Text style={styles.repoTitle}>{item.name}</Text>
          <View style={styles.visibilityBadge}>
            <Text style={styles.visibilityText}>
              {item.private ? '🔒 Private' : 'Public'}
            </Text>
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
                      item.language === 'TypeScript'
                        ? '#3178C6'
                        : item.language === 'JavaScript'
                        ? '#F7DF1E'
                        : '#3572A5',
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

      {/* Language Filter Chips */}
      <View style={styles.filterRow}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.filterPill,
              selectedLanguage === lang && styles.filterPillActive,
            ]}
            onPress={() => handleLanguageFilter(lang)}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedLanguage === lang && styles.filterPillTextActive,
              ]}
            >
              {lang}
            </Text>
          </TouchableOpacity>
        ))}
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
    marginBottom: Spacing.sm,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
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
});
