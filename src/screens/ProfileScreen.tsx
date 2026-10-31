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
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import { GitHubUser, ContributionDay, GitHubRepo } from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { ContributionHeatmap } from '../components/ContributionHeatmap';
import { RepoDetailModal } from './RepoDetailModal';

export const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<{
    total: number;
    days: ContributionDay[];
  }>({ total: 0, days: [] });
  const [topRepos, setTopRepos] = useState<GitHubRepo[]>([]);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoModalVisible, setRepoModalVisible] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const u = await GitHubApiService.getCurrentUser();
      setUser(u);
      setIsAuth(GitHubApiService.isAuthenticated());
      setUsernameInput(GitHubApiService.getUsername());

      if (u) {
        const [c, repos] = await Promise.all([
          GitHubApiService.getAnnualContributions(u.login),
          GitHubApiService.getUserRepos(u.login),
        ]);
        setContributions(c);
        setTopRepos(repos.slice(0, 6));
      } else {
        setContributions({ total: 0, days: [] });
        setTopRepos([]);
      }
    } catch (e) {
      console.warn('Error loading profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (usernameInput.trim()) {
      await GitHubApiService.setUsername(usernameInput.trim());
    }

    if (tokenInput.trim()) {
      await GitHubApiService.setToken(tokenInput.trim());
    }

    setSettingsModalVisible(false);
    setTokenInput('');
    await loadProfile();
    Alert.alert('Settings Updated', 'Account configuration refreshed.');
  };

  const handleDisconnectToken = async () => {
    await GitHubApiService.setToken(null);
    setSettingsModalVisible(false);
    setTokenInput('');
    await loadProfile();
    Alert.alert('Token Removed', 'Switched to public profile mode.');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      {user ? (
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>
                  {user.login.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.nameBlock}>
              <Text style={styles.name}>{user.name || user.login}</Text>
              <Text style={styles.username}>@{user.login}</Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.authBadge,
                    isAuth ? styles.authBadgeGreen : styles.authBadgeMuted,
                  ]}
                >
                  <Text style={styles.authBadgeText}>
                    {isAuth ? '● Authenticated PAT' : '○ Public GitHub Profile'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

          <View style={styles.detailsRow}>
            {user.company ? (
              <Text style={styles.detailText}>🏢 {user.company}</Text>
            ) : null}
            {user.location ? (
              <Text style={styles.detailText}>📍 {user.location}</Text>
            ) : null}
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
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={styles.settingsButtonText}>
              {isAuth ? '⚙️ Account & Token Settings' : '🔑 Connect PAT or Change User'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyUserCard}>
          <Text style={styles.emptyUserTitle}>GitHub User Not Found</Text>
          <Text style={styles.emptyUserDesc}>
            Connect a Personal Access Token or enter a valid GitHub username to view repositories and activity.
          </Text>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={styles.primaryActionText}>Configure Account</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Real Contribution Heatmap Section */}
      <Text style={styles.sectionHeader}>Contribution Activity</Text>
      <ContributionHeatmap
        days={contributions.days}
        total={contributions.total}
      />

      {/* Real Repositories Section */}
      <Text style={styles.sectionHeader}>
        Repositories ({topRepos.length})
      </Text>
      {topRepos.length > 0 ? (
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
              {repo.description ? (
                <Text style={styles.topRepoDesc} numberOfLines={2}>
                  {repo.description}
                </Text>
              ) : null}
              <View style={styles.topRepoFooter}>
                {repo.language ? (
                  <Text style={styles.topRepoLang}>{repo.language}</Text>
                ) : null}
                <Text style={styles.topRepoStars}>⭐ {repo.stargazers_count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyReposCard}>
          <Text style={styles.emptyReposText}>No repositories found.</Text>
        </View>
      )}

      {/* Account & Token Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>GitHub Account Settings</Text>

            <Text style={styles.inputLabel}>GitHub Username</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. athanasso"
              placeholderTextColor={Colors.textMuted}
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Personal Access Token (PAT) (Optional)</Text>
            <Text style={styles.inputHint}>
              Required for private repositories and notification inbox.
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={isAuth ? '••••••••••••••••••••' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
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
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleSaveSettings}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            {isAuth && (
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleDisconnectToken}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  avatarPlaceholder: {
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
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
  emptyUserCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
  },
  emptyUserTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptyUserDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  primaryActionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  emptyReposCard: {
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  emptyReposText: {
    fontSize: 13,
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
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: Spacing.sm,
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
    marginTop: Spacing.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.ruby,
    fontSize: 13,
    fontWeight: '600',
  },
});
