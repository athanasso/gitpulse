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
  FlatList,
  Modal,
  Linking,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import {
  GitHubUser,
  ContributionDay,
  GitHubRepo,
  GitHubGist,
  GitHubOrg,
  GitHubFollower,
  GitHubEvent,
} from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { ContributionHeatmap } from '../components/ContributionHeatmap';
import { RepoDetailModal } from './RepoDetailModal';

type ProfileSubTab =
  | 'repos'
  | 'starred'
  | 'gists'
  | 'activity'
  | 'orgs'
  | 'social';

export const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('repos');

  // Heatmap Data
  const [contributions, setContributions] = useState<{
    total: number;
    days: ContributionDay[];
  }>({ total: 0, days: [] });

  // Sub-tab Data
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [starredRepos, setStarredRepos] = useState<GitHubRepo[]>([]);
  const [gists, setGists] = useState<GitHubGist[]>([]);
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [orgs, setOrs] = useState<GitHubOrg[]>([]);
  const [followers, setFollowers] = useState<GitHubFollower[]>([]);
  const [following, setFollowing] = useState<GitHubFollower[]>([]);
  const [socialTab, setSocialTab] = useState<'followers' | 'following'>('followers');

  // Auth & Modals
  const [tokenInput, setTokenInput] = useState('');
  const [isAuth, setIsAuth] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoModalVisible, setRepoModalVisible] = useState(false);
  const [selectedGist, setSelectedGist] = useState<GitHubGist | null>(null);
  const [gistModalVisible, setGistModalVisible] = useState(false);
  const [gistFileContent, setGistFileContent] = useState<string>('');
  const [gistLoading, setGistLoading] = useState(false);

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
          setRepos(rList);
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

  const handleSubTabChange = async (tab: ProfileSubTab) => {
    setActiveSubTab(tab);
    if (!isAuth) return;

    if (tab === 'starred' && starredRepos.length === 0) {
      setSubLoading(true);
      const starred = await GitHubApiService.getUserStarredRepos();
      setStarredRepos(starred);
      setSubLoading(false);
    } else if (tab === 'gists' && gists.length === 0) {
      setSubLoading(true);
      const gList = await GitHubApiService.getGists();
      setGists(gList);
      setSubLoading(false);
    } else if (tab === 'activity' && events.length === 0) {
      setSubLoading(true);
      const eList = await GitHubApiService.getUserEvents();
      setEvents(eList);
      setSubLoading(false);
    } else if (tab === 'orgs' && orgs.length === 0) {
      setSubLoading(true);
      const oList = await GitHubApiService.getOrgs();
      setOrs(oList);
      setSubLoading(false);
    } else if (tab === 'social' && followers.length === 0 && following.length === 0) {
      setSubLoading(true);
      const [fList, folList] = await Promise.all([
        GitHubApiService.getFollowers(),
        GitHubApiService.getFollowing(),
      ]);
      setFollowers(fList);
      setFollowing(folList);
      setSubLoading(false);
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
        setRepos(rList);

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
            setStarredRepos([]);
            setGists([]);
            setEvents([]);
            setOrs([]);
            setFollowers([]);
            setFollowing([]);
          },
        },
      ]
    );
  };

  const openGist = async (gist: GitHubGist) => {
    setSelectedGist(gist);
    setGistModalVisible(true);
    setGistLoading(true);
    setGistFileContent('');

    // Load first file raw content
    const firstFile = Object.values(gist.files)[0];
    if (firstFile && firstFile.raw_url) {
      try {
        const res = await fetch(firstFile.raw_url);
        if (res.ok) {
          const txt = await res.text();
          setGistFileContent(txt);
        }
      } catch (e) {
        console.warn('Failed to load gist raw file', e);
      }
    }
    setGistLoading(false);
  };

  const getEventDescription = (ev: GitHubEvent) => {
    switch (ev.type) {
      case 'PushEvent':
        const commitCount = ev.payload?.commits?.length || 1;
        const msg = ev.payload?.commits?.[0]?.message || 'Pushed commit';
        return `Pushed ${commitCount} commit(s): "${msg.split('\n')[0]}"`;
      case 'WatchEvent':
        return 'Starred repository';
      case 'ForkEvent':
        return `Forked to ${ev.payload?.forkee?.full_name || 'new repo'}`;
      case 'CreateEvent':
        return `Created ${ev.payload?.ref_type || 'ref'} ${ev.payload?.ref || ''}`;
      case 'PullRequestEvent':
        return `${ev.payload?.action || 'updated'} PR #${ev.payload?.pull_request?.number || ''}: ${ev.payload?.pull_request?.title || ''}`;
      case 'IssuesEvent':
        return `${ev.payload?.action || 'updated'} Issue #${ev.payload?.issue?.number || ''}: ${ev.payload?.issue?.title || ''}`;
      case 'IssueCommentEvent':
        return `Commented on #${ev.payload?.issue?.number || ''}`;
      default:
        return ev.type.replace('Event', '');
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'PushEvent':
        return '🚀';
      case 'WatchEvent':
        return '⭐';
      case 'ForkEvent':
        return '🍴';
      case 'CreateEvent':
        return '✨';
      case 'PullRequestEvent':
        return '🔀';
      case 'IssuesEvent':
        return '🟢';
      case 'IssueCommentEvent':
        return '💬';
      default:
        return '📌';
    }
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
              Generate at github.com → Settings → Developer Settings → Personal Access Tokens with scopes: repo, read:user, notifications, gist.
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
                <TouchableOpacity
                  style={styles.statBox}
                  onPress={() => handleSubTabChange('repos')}
                >
                  <Text style={styles.statNumber}>{user.public_repos}</Text>
                  <Text style={styles.statLabel}>Repositories</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statBox}
                  onPress={() => {
                    setSocialTab('followers');
                    handleSubTabChange('social');
                  }}
                >
                  <Text style={styles.statNumber}>{user.followers}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statBox}
                  onPress={() => {
                    setSocialTab('following');
                    handleSubTabChange('social');
                  }}
                >
                  <Text style={styles.statNumber}>{user.following}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statBox}
                  onPress={() => handleSubTabChange('gists')}
                >
                  <Text style={styles.statNumber}>{user.public_gists}</Text>
                  <Text style={styles.statLabel}>Gists</Text>
                </TouchableOpacity>
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

          {/* Sub-Tab Navigation Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subTabScroll}
            contentContainerStyle={styles.subTabBar}
          >
            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'repos' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('repos')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'repos' && styles.subTabTextActive,
                ]}
              >
                Repositories ({repos.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'starred' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('starred')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'starred' && styles.subTabTextActive,
                ]}
              >
                Starred
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'gists' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('gists')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'gists' && styles.subTabTextActive,
                ]}
              >
                Gists
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'activity' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('activity')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'activity' && styles.subTabTextActive,
                ]}
              >
                Activity Feed
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'orgs' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('orgs')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'orgs' && styles.subTabTextActive,
                ]}
              >
                Organizations
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'social' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('social')}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'social' && styles.subTabTextActive,
                ]}
              >
                Network
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Sub-Tab Content */}
          {subLoading ? (
            <View style={styles.subLoadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : (
            <>
              {/* REPOSITORIES SUB-TAB */}
              {activeSubTab === 'repos' && (
                <View style={styles.reposGrid}>
                  {repos.length > 0 ? (
                    repos.map((repo) => (
                      <TouchableOpacity
                        key={repo.id}
                        style={styles.topRepoCard}
                        onPress={() => {
                          setSelectedRepo(repo);
                          setRepoModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.repoCardHeader}>
                          <Text style={styles.topRepoName} numberOfLines={1}>
                            {repo.name}
                          </Text>
                          <View style={styles.repoVisibilityBadge}>
                            <Text style={styles.repoVisibilityText}>
                              {repo.private ? '🔒 Private' : 'Public'}
                            </Text>
                          </View>
                        </View>
                        {repo.description ? (
                          <Text style={styles.topRepoDesc} numberOfLines={2}>
                            {repo.description}
                          </Text>
                        ) : null}
                        <View style={styles.topRepoFooter}>
                          {repo.language ? (
                            <Text style={styles.topRepoLang}>{repo.language}</Text>
                          ) : null}
                          <Text style={styles.topRepoStars}>
                            ⭐ {repo.stargazers_count}
                          </Text>
                          <Text style={styles.topRepoForks}>
                            🍴 {repo.forks_count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>No repositories found.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* STARRED SUB-TAB */}
              {activeSubTab === 'starred' && (
                <View style={styles.reposGrid}>
                  {starredRepos.length > 0 ? (
                    starredRepos.map((repo) => (
                      <TouchableOpacity
                        key={repo.id}
                        style={styles.topRepoCard}
                        onPress={() => {
                          setSelectedRepo(repo);
                          setRepoModalVisible(true);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.repoCardHeader}>
                          <Text style={styles.topRepoName} numberOfLines={1}>
                            {repo.full_name}
                          </Text>
                        </View>
                        {repo.description ? (
                          <Text style={styles.topRepoDesc} numberOfLines={2}>
                            {repo.description}
                          </Text>
                        ) : null}
                        <View style={styles.topRepoFooter}>
                          {repo.language ? (
                            <Text style={styles.topRepoLang}>{repo.language}</Text>
                          ) : null}
                          <Text style={styles.topRepoStars}>
                            ⭐ {repo.stargazers_count}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        No starred repositories found.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* GISTS SUB-TAB */}
              {activeSubTab === 'gists' && (
                <View style={styles.listContainer}>
                  {gists.length > 0 ? (
                    gists.map((g) => {
                      const fileNames = Object.keys(g.files);
                      const firstFile = g.files[fileNames[0]];
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={styles.gistCard}
                          onPress={() => openGist(g)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.gistHeader}>
                            <View style={styles.gistBadge}>
                              <Text style={styles.gistBadgeText}>
                                {g.public ? 'Public Gist' : 'Secret Gist'}
                              </Text>
                            </View>
                            <Text style={styles.gistDate}>
                              {new Date(g.created_at).toLocaleDateString()}
                            </Text>
                          </View>

                          <Text style={styles.gistDescription} numberOfLines={2}>
                            {g.description || fileNames[0] || 'Untitled Gist'}
                          </Text>

                          <View style={styles.gistFooter}>
                            <Text style={styles.gistFilesCount}>
                              📄 {fileNames.length} {fileNames.length === 1 ? 'file' : 'files'}
                            </Text>
                            {firstFile?.language && (
                              <Text style={styles.gistLang}>
                                {firstFile.language}
                              </Text>
                            )}
                            <Text style={styles.gistComments}>
                              💬 {g.comments}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>No gists found.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ACTIVITY FEED SUB-TAB */}
              {activeSubTab === 'activity' && (
                <View style={styles.listContainer}>
                  {events.length > 0 ? (
                    events.map((ev) => (
                      <View key={ev.id} style={styles.eventCard}>
                        <View style={styles.eventHeader}>
                          <Text style={styles.eventIcon}>
                            {getEventIcon(ev.type)}
                          </Text>
                          <Text style={styles.eventRepoName} numberOfLines={1}>
                            {ev.repo.name}
                          </Text>
                          <Text style={styles.eventDate}>
                            {new Date(ev.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={styles.eventDetail}>
                          {getEventDescription(ev)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        No recent public activity.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ORGANIZATIONS SUB-TAB */}
              {activeSubTab === 'orgs' && (
                <View style={styles.listContainer}>
                  {orgs.length > 0 ? (
                    orgs.map((org) => (
                      <View key={org.id} style={styles.orgCard}>
                        {org.avatar_url ? (
                          <Image
                            source={{ uri: org.avatar_url }}
                            style={styles.orgAvatar}
                          />
                        ) : (
                          <View style={[styles.orgAvatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarLetter}>
                              {org.login.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.orgInfo}>
                          <Text style={styles.orgTitle}>@{org.login}</Text>
                          {org.description ? (
                            <Text style={styles.orgDesc} numberOfLines={2}>
                              {org.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        No organization memberships found.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* SOCIAL (FOLLOWERS / FOLLOWING) SUB-TAB */}
              {activeSubTab === 'social' && (
                <View style={styles.listContainer}>
                  {/* Follower / Following sub-switch */}
                  <View style={styles.socialSwitchRow}>
                    <TouchableOpacity
                      style={[
                        styles.socialSwitchBtn,
                        socialTab === 'followers' && styles.socialSwitchBtnActive,
                      ]}
                      onPress={() => setSocialTab('followers')}
                    >
                      <Text
                        style={[
                          styles.socialSwitchText,
                          socialTab === 'followers' && styles.socialSwitchTextActive,
                        ]}
                      >
                        Followers ({followers.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.socialSwitchBtn,
                        socialTab === 'following' && styles.socialSwitchBtnActive,
                      ]}
                      onPress={() => setSocialTab('following')}
                    >
                      <Text
                        style={[
                          styles.socialSwitchText,
                          socialTab === 'following' && styles.socialSwitchTextActive,
                        ]}
                      >
                        Following ({following.length})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {(socialTab === 'followers' ? followers : following).length > 0 ? (
                    (socialTab === 'followers' ? followers : following).map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.userCard}
                        onPress={() => Linking.openURL(u.html_url)}
                        activeOpacity={0.7}
                      >
                        {u.avatar_url ? (
                          <Image
                            source={{ uri: u.avatar_url }}
                            style={styles.userCardAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.userCardAvatar,
                              styles.avatarPlaceholder,
                            ]}
                          >
                            <Text style={styles.avatarLetter}>
                              {u.login.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.userCardLogin}>@{u.login}</Text>
                        <Text style={styles.userCardArrow}>↗</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        {socialTab === 'followers'
                          ? 'No followers found.'
                          : 'Not following anyone.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* Repo Detail Modal */}
      <RepoDetailModal
        visible={repoModalVisible}
        repo={selectedRepo}
        onClose={() => setRepoModalVisible(false)}
      />

      {/* Gist Detail Modal */}
      <Modal
        visible={gistModalVisible}
        animationType="slide"
        onRequestClose={() => setGistModalVisible(false)}
      >
        <View style={styles.gistModalContainer}>
          <View style={styles.gistModalHeader}>
            <TouchableOpacity
              onPress={() => setGistModalVisible(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.gistModalTitleBox}>
              <Text style={styles.gistModalTitle} numberOfLines={1}>
                {selectedGist?.description || 'Gist'}
              </Text>
              <Text style={styles.gistModalSub}>
                {selectedGist ? Object.keys(selectedGist.files)[0] : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (selectedGist) Linking.openURL(selectedGist.html_url);
              }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>↗</Text>
            </TouchableOpacity>
          </View>

          {gistLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.gistScroll}>
              <View style={styles.gistCodeBox}>
                {gistFileContent ? (
                  gistFileContent.split('\n').map((line, idx) => (
                    <View key={idx} style={styles.gistLineRow}>
                      <Text style={styles.gistLineNum}>{idx + 1}</Text>
                      <Text style={styles.gistLineText}>{line || ' '}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Empty gist file.</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  authGateCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  authGateIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cardElevated,
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
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  tokenBox: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tokenInput: {
    backgroundColor: Colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  tokenHint: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 6,
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.cardElevated,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  nameBlock: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  authBadge: {
    backgroundColor: Colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  authBadgeText: {
    color: Colors.emerald,
    fontSize: 11,
    fontWeight: '700',
  },
  bio: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.cardElevated,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    justifyContent: 'space-around',
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
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  disconnectButtonText: {
    color: Colors.ruby,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  subTabScroll: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  subTabBar: {
    flexDirection: 'row',
    gap: 8,
  },
  subTabItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  subTabItemActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subTabTextActive: {
    color: '#FFFFFF',
  },
  subLoadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  reposGrid: {
    gap: 10,
  },
  topRepoCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  repoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRepoName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  repoVisibilityBadge: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  repoVisibilityText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  topRepoDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  topRepoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: 12,
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
  topRepoForks: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  listContainer: {
    gap: 10,
  },
  gistCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  gistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gistBadge: {
    backgroundColor: Colors.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gistBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.cyan,
  },
  gistDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  gistDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  gistFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gistFilesCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  gistLang: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  gistComments: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  eventCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  eventRepoName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  eventDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  orgAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.cardElevated,
    marginRight: Spacing.md,
  },
  orgInfo: {
    flex: 1,
  },
  orgTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  orgDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  socialSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  socialSwitchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  socialSwitchBtnActive: {
    backgroundColor: Colors.cardElevated,
    borderColor: Colors.primary,
  },
  socialSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  socialSwitchTextActive: {
    color: Colors.primary,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  userCardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: Colors.cardElevated,
  },
  userCardLogin: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  userCardArrow: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  gistModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gistModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  gistModalTitleBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  gistModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gistModalSub: {
    fontSize: 11,
    color: Colors.cyan,
    marginTop: 2,
  },
  gistScroll: {
    flex: 1,
  },
  gistCodeBox: {
    padding: Spacing.lg,
    backgroundColor: Colors.codeBackground,
    minHeight: '100%',
  },
  gistLineRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  gistLineNum: {
    width: 32,
    color: Colors.codeLineNumber,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right',
    marginRight: 10,
  },
  gistLineText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
