import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
  const [validating, setValidating] = useState(false);
  const [contributions, setContributions] = useState<{
    total: number;
    days: ContributionDay[];
  }>({ total: 0, days: [] });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoModalVisible, setRepoModalVisible] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const auth = GitHubApiService.isAuthenticated();
      setIsAuth(auth);

      if (auth) {
        const u = await GitHubApiService.getCurrentUser();
        setUser(u);

        if (u) {
          const [c, rList] = await Promise.all([
            GitHubApiService.getContributions(),
            GitHubApiService.getUserRepos(),
          ]);
          setContributions(c);
          setRepos(rList.slice(0, 6));
        }
      } else {
        setUser(null);
        setContributions({ total: 0, days: [] });
        setRepos([]);
      }
    } catch (e) {
      console.warn('Error loading profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectToken = async () => {
    const token = tokenInput.trim();
    if (!token) {
      Alert.alert('API Key Required', 'Please enter your GitHub Personal Access Token.');
      return;
    }

    setValidating(true);
    try {
      const u = await GitHubApiService.setToken(token);
      if (u) {
        setUser(u);
        setIsAuth(true);
        setTokenInput('');

        const [c, rList] = await Promise.all([
          GitHubApiService.getContributions(),
          GitHubApiService.getUserRepos(),
        ]);
        setContributions(c);
        setRepos(rList.slice(0, 6));

        Alert.alert('Connected', `Signed in as @${u.login}`);
      }
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Could not validate GitHub token.');
    } finally {
      setValidating(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect API Key',
      'Are you sure you want to remove your GitHub API key from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await GitHubApiService.setToken(null);
            setUser(null);
            setIsAuth(false);
            setContributions({ total: 0, days: [] });
            setRepos([]);
          },
        },
      ]
    );
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
      {!isAuth ? (
        // Unauthenticated: API Key Entry Gate
        <View style={styles.authGateCard}>
          <View style={styles.authGateIconBox}>
            <Text style={styles.authGateIcon}>🔑</Text>
          </View>
          <Text style={styles.authGateTitle}>Connect GitHub API Key</Text>
          <Text style={styles.authGateDesc}>
            GitPulse accesses GitHub exclusively through official authenticated
            APIs using your Personal Access Token. Zero data scraping, zero third-party proxies.
          </Text>

          <View style={styles.tokenBox}>
            <Text style={styles.inputLabel}>Personal Access Token (PAT)</Text>
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
            <Text style={styles.tokenHint}>
              Generate at github.com → Settings → Developer Settings → Personal Access Tokens with scopes: repo, read:user, notifications.
            </Text>

            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnectToken}
              disabled={validating}
              activeOpacity={0.8}
            >
              {validating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.connectButtonText}>Connect & Authenticate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Authenticated Profile
        <>
          {user && (
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
                    <View style={styles.authBadge}>
                      <Text style={styles.authBadgeText}>
                        ● Live Authenticated API
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
                style={styles.disconnectButton}
                onPress={handleDisconnect}
                activeOpacity={0.8}
              >
                <Text style={styles.disconnectButtonText}>
                  Disconnect API Key
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Official GraphQL Contribution Heatmap */}
          <Text style={styles.sectionHeader}>Contribution Activity (Official API)</Text>
          <ContributionHeatmap
            days={contributions.days}
            total={contributions.total}
          />

          {/* User's Authenticated Repositories */}
          <Text style={styles.sectionHeader}>
            Repositories ({repos.length})
          </Text>
          {repos.length > 0 ? (
            <View style={styles.reposGrid}>
              {repos.map((repo) => (
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
        </>
      )}

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
  authGateCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  authGateIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  authGateIcon: {
    fontSize: 28,
  },
  authGateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  authGateDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.xl,
    maxWidth: 320,
  },
  tokenBox: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  tokenInput: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 46,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 6,
  },
  tokenHint: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: Spacing.lg,
  },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: Colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  authBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.emerald,
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
  disconnectButton: {
    backgroundColor: Colors.cardElevated,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  disconnectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ruby,
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
});
