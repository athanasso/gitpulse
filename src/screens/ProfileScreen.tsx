import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubUser, ContributionDay, GitHubRepo } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { ContributionHeatmap } from '../components/ContributionHeatmap';
import { RepoDetailModal } from './RepoDetailModal';

export const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [contributions, setContributions] = useState<{
    total: number;
    days: ContributionDay[];
  }>({ total: 0, days: [] });
  const [topRepos, setTopRepos] = useState<GitHubRepo[]>([]);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoModalVisible, setRepoModalVisible] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const u = await GitHubApiService.getCurrentUser();
    setUser(u);
    setIsAuth(GitHubApiService.isAuthenticated());

    const c = GitHubApiService.getAnnualContributions();
    setContributions(c);

    const repos = await GitHubApiService.getUserRepos();
    setTopRepos(repos.slice(0, 4));
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Empty Token', 'Please enter a valid GitHub Personal Access Token.');
      return;
    }

    await GitHubApiService.setToken(tokenInput.trim());
    setTokenModalVisible(false);
    setTokenInput('');
    await loadProfile();
    Alert.alert('Success', 'GitHub PAT saved and authenticated.');
  };

  const handleLogout = async () => {
    await GitHubApiService.setToken(null);
    setTokenModalVisible(false);
    await loadProfile();
    Alert.alert('Logged Out', 'Switched back to offline demo mode.');
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.username}>@{user.login}</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.authBadge,
                  isAuth ? styles.authBadgeGreen : styles.authBadgeMuted,
                ]}
              >
                <Text style={styles.authBadgeText}>
                  {isAuth ? '● Authenticated PAT' : '○ Demo / Public Mode'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        <View style={styles.detailsRow}>
          {user.company && (
            <Text style={styles.detailText}>🏢 {user.company}</Text>
          )}
          {user.location && (
            <Text style={styles.detailText}>📍 {user.location}</Text>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{user.public_repos}</Text>
            <Text style={styles.statLabel}>Repositories</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{user.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{user.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setTokenModalVisible(true)}
        >
          <Text style={styles.settingsButtonText}>
            {isAuth ? '⚙️ Manage Access Token' : '🔑 Connect GitHub Account (PAT)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contribution Heatmap Section */}
      <Text style={styles.sectionHeader}>Contribution Activity</Text>
      <ContributionHeatmap
        days={contributions.days}
        total={contributions.total}
      />

      {/* Top Repositories */}
      <Text style={styles.sectionHeader}>Top Repositories</Text>
      <View style={styles.reposGrid}>
        {topRepos.map((repo) => (
          <TouchableOpacity
            key={repo.id}
            style={styles.topRepoCard}
            onPress={() => {
              setSelectedRepo(repo);
              setRepoModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.topRepoName} numberOfLines={1}>
              {repo.name}
            </Text>
            {repo.description && (
              <Text style={styles.topRepoDesc} numberOfLines={2}>
                {repo.description}
              </Text>
            )}
            <View style={styles.topRepoFooter}>
              {repo.language && (
                <Text style={styles.topRepoLang}>{repo.language}</Text>
              )}
              <Text style={styles.topRepoStars}>⭐ {repo.stargazers_count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* PAT Modal */}
      <Modal
        visible={tokenModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTokenModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>GitHub Authentication</Text>
            <Text style={styles.modalDesc}>
              Enter a GitHub Personal Access Token (classic or fine-grained) with{' '}
              <Text style={{ color: Colors.cyan }}>repo</Text> and{' '}
              <Text style={{ color: Colors.cyan }}>read:user</Text> scopes to
              access private repositories and personal notifications.
            </Text>

            <TextInput
              style={styles.tokenInput}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor={Colors.textMuted}
              value={tokenInput}
              onChangeText={setTokenInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setTokenModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleSaveToken}
              >
                <Text style={styles.modalSaveText}>Save Token</Text>
              </TouchableOpacity>
            </View>

            {isAuth && (
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText}>Disconnect Token</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Repo Detail Modal */}
      <RepoDetailModal
        visible={repoModalVisible}
        repo={selectedRepo}
        onClose={() => setRepoModalVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: Spacing.md,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  authBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  authBadgeGreen: {
    backgroundColor: Colors.emeraldMuted,
  },
  authBadgeMuted: {
    backgroundColor: Colors.backgroundElevated,
  },
  authBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  bio: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: Spacing.md,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  settingsButton: {
    backgroundColor: Colors.cardElevated,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.cyan,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  reposGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  topRepoCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  topRepoName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  topRepoDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  topRepoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRepoLang: {
    fontSize: 11,
    color: Colors.cyan,
    fontWeight: '600',
  },
  topRepoStars: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  tokenInput: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalSave: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: Spacing.lg,
    paddingVertical: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.ruby,
    fontSize: 13,
    fontWeight: '600',
  },
});
