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
  GitHubSocialAccount,
  GitHubPinnedItem,
} from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { ContributionHeatmap } from '../components/ContributionHeatmap';
import { RepoDetailModal } from './RepoDetailModal';
import { formatLocalDateTime, formatRepoTimestamp } from '../utils/date';
import { PaginationControl } from '../components/PaginationControl';

type ProfileSubTab =
  | 'repos'
  | 'starred'
  | 'gists'
  | 'activity'
  | 'orgs'
  | 'social';

const PAGE_SIZE = 30;

const GITHUB_NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?description=GitPulse+Mobile&scopes=repo,read:user,notifications,gist,read:org';

interface ScopeSpec {
  scope: string;
  name: string;
  level: 'Required' | 'Recommended' | 'Optional';
  desc: string;
}

const SCOPES_SPECS: ScopeSpec[] = [
  {
    scope: 'repo',
    name: 'Repositories',
    level: 'Required',
    desc: 'Browse private & public repos, file trees, commit history, branches, issues, workflows, and star/unstar.',
  },
  {
    scope: 'read:user',
    name: 'User Profile',
    level: 'Required',
    desc: 'Profile bio, avatar, GraphQL contribution calendar heatmap, followers & following.',
  },
  {
    scope: 'notifications',
    name: 'Inbox & Notifications',
    level: 'Recommended',
    desc: 'Fetch notifications list, filter unread, and mark threads as read via GitHub API.',
  },
  {
    scope: 'gist',
    name: 'Gists & Snippets',
    level: 'Recommended',
    desc: 'View personal gists, inspect gist files, and read snippet source code.',
  },
  {
    scope: 'read:org',
    name: 'Organizations',
    level: 'Optional',
    desc: 'View organization memberships and team profile badges.',
  },
];

export const ProfileScreen: React.FC = () => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [tokenScopes, setTokenScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('repos');

  // Heatmap Data
  const [contributions, setContributions] = useState<{
    total: number;
    days: ContributionDay[];
  }>({ total: 0, days: [] });

  // Repos with pagination
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [pageRepos, setPageRepos] = useState(1);
  const [hasMoreRepos, setHasMoreRepos] = useState(true);
  const [loadingMoreRepos, setLoadingMoreRepos] = useState(false);

  // Starred with pagination
  const [starredRepos, setStarredRepos] = useState<GitHubRepo[]>([]);
  const [pageStarred, setPageStarred] = useState(1);
  const [hasMoreStarred, setHasMoreStarred] = useState(true);
  const [loadingMoreStarred, setLoadingMoreStarred] = useState(false);

  // Gists with pagination
  const [gists, setGists] = useState<GitHubGist[]>([]);
  const [pageGists, setPageGists] = useState(1);
  const [hasMoreGists, setHasMoreGists] = useState(true);
  const [loadingMoreGists, setLoadingMoreGists] = useState(false);

  // Events with pagination
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [pageEvents, setPageEvents] = useState(1);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false);

  // Orgs
  const [orgs, setOrs] = useState<GitHubOrg[]>([]);

  // Followers & Following with pagination
  const [followers, setFollowers] = useState<GitHubFollower[]>([]);
  const [pageFollowers, setPageFollowers] = useState(1);
  const [hasMoreFollowers, setHasMoreFollowers] = useState(true);
  const [loadingMoreFollowers, setLoadingMoreFollowers] = useState(false);

  const [following, setFollowing] = useState<GitHubFollower[]>([]);
  const [pageFollowing, setPageFollowing] = useState(1);
  const [hasMoreFollowing, setHasMoreFollowing] = useState(true);
  const [loadingMoreFollowing, setLoadingMoreFollowing] = useState(false);

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

  // Profile Extras: Links, Pinned, Readme
  const [socialAccounts, setSocialAccounts] = useState<GitHubSocialAccount[]>([]);
  const [pinnedItems, setPinnedItems] = useState<GitHubPinnedItem[]>([]);
  const [profileReadme, setProfileReadme] = useState<string>('');
  const [readmeExpanded, setReadmeExpanded] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const auth = await GitHubApiService.init();
      setIsAuth(auth);

      if (auth) {
        setTokenScopes(GitHubApiService.getTokenScopes());
        const u = await GitHubApiService.getCurrentUser();
        setUser(u);
        setTokenScopes(GitHubApiService.getTokenScopes());

        if (u) {
          const [c, rList, socials, pinned, readme] = await Promise.all([
            GitHubApiService.getContributions(),
            GitHubApiService.getUserRepos(1, PAGE_SIZE),
            GitHubApiService.getSocialAccounts(u.login),
            GitHubApiService.getPinnedItems(u.login),
            GitHubApiService.getProfileReadme(u.login),
          ]);
          setContributions(c);
          setRepos(rList);
          setHasMoreRepos(rList.length >= PAGE_SIZE);
          setPageRepos(1);
          setSocialAccounts(socials);
          setPinnedItems(pinned);
          setProfileReadme(readme);
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
      const starred = await GitHubApiService.getUserStarredRepos(1, PAGE_SIZE);
      setStarredRepos(starred);
      setHasMoreStarred(starred.length >= PAGE_SIZE);
      setPageStarred(1);
      setSubLoading(false);
    } else if (tab === 'gists' && gists.length === 0) {
      setSubLoading(true);
      const gList = await GitHubApiService.getGists(1, PAGE_SIZE);
      setGists(gList);
      setHasMoreGists(gList.length >= PAGE_SIZE);
      setPageGists(1);
      setSubLoading(false);
    } else if (tab === 'activity' && events.length === 0) {
      setSubLoading(true);
      const eList = await GitHubApiService.getUserEvents(user?.login, 1, PAGE_SIZE);
      setEvents(eList);
      setHasMoreEvents(eList.length >= PAGE_SIZE);
      setPageEvents(1);
      setSubLoading(false);
    } else if (tab === 'orgs' && orgs.length === 0) {
      setSubLoading(true);
      const oList = await GitHubApiService.getOrgs();
      setOrs(oList);
      setSubLoading(false);
    } else if (tab === 'social' && followers.length === 0 && following.length === 0) {
      setSubLoading(true);
      const [fList, folList] = await Promise.all([
        GitHubApiService.getFollowers(user?.login, 1, PAGE_SIZE),
        GitHubApiService.getFollowing(user?.login, 1, PAGE_SIZE),
      ]);
      setFollowers(fList);
      setHasMoreFollowers(fList.length >= PAGE_SIZE);
      setPageFollowers(1);

      setFollowing(folList);
      setHasMoreFollowing(folList.length >= PAGE_SIZE);
      setPageFollowing(1);
      setSubLoading(false);
    }
  };

  // True Page Navigation Handlers
  const goToReposPage = async (newPage: number) => {
    if (loadingMoreRepos || newPage < 1) return;
    setLoadingMoreRepos(true);
    const list = await GitHubApiService.getUserRepos(newPage, PAGE_SIZE);
    setRepos(list);
    setHasMoreRepos(list.length >= PAGE_SIZE);
    setPageRepos(newPage);
    setLoadingMoreRepos(false);
  };

  const goToStarredPage = async (newPage: number) => {
    if (loadingMoreStarred || newPage < 1) return;
    setLoadingMoreStarred(true);
    const list = await GitHubApiService.getUserStarredRepos(newPage, PAGE_SIZE);
    setStarredRepos(list);
    setHasMoreStarred(list.length >= PAGE_SIZE);
    setPageStarred(newPage);
    setLoadingMoreStarred(false);
  };

  const goToGistsPage = async (newPage: number) => {
    if (loadingMoreGists || newPage < 1) return;
    setLoadingMoreGists(true);
    const list = await GitHubApiService.getGists(newPage, PAGE_SIZE);
    setGists(list);
    setHasMoreGists(list.length >= PAGE_SIZE);
    setPageGists(newPage);
    setLoadingMoreGists(false);
  };

  const goToEventsPage = async (newPage: number) => {
    if (loadingMoreEvents || newPage < 1) return;
    setLoadingMoreEvents(true);
    const list = await GitHubApiService.getUserEvents(user?.login, newPage, PAGE_SIZE);
    setEvents(list);
    setHasMoreEvents(list.length >= PAGE_SIZE);
    setPageEvents(newPage);
    setLoadingMoreEvents(false);
  };

  const goToFollowersPage = async (newPage: number) => {
    if (loadingMoreFollowers || newPage < 1) return;
    setLoadingMoreFollowers(true);
    const list = await GitHubApiService.getFollowers(user?.login, newPage, PAGE_SIZE);
    setFollowers(list);
    setHasMoreFollowers(list.length >= PAGE_SIZE);
    setPageFollowers(newPage);
    setLoadingMoreFollowers(false);
  };

  const goToFollowingPage = async (newPage: number) => {
    if (loadingMoreFollowing || newPage < 1) return;
    setLoadingMoreFollowing(true);
    const list = await GitHubApiService.getFollowing(user?.login, newPage, PAGE_SIZE);
    setFollowing(list);
    setHasMoreFollowing(list.length >= PAGE_SIZE);
    setPageFollowing(newPage);
    setLoadingMoreFollowing(false);
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
        setTokenScopes(GitHubApiService.getTokenScopes());
        setTokenInput('');

        const [c, rList, socials, pinned, readme] = await Promise.all([
          GitHubApiService.getContributions(),
          GitHubApiService.getUserRepos(1, PAGE_SIZE),
          GitHubApiService.getSocialAccounts(u.login),
          GitHubApiService.getPinnedItems(u.login),
          GitHubApiService.getProfileReadme(u.login),
        ]);
        setContributions(c);
        setRepos(rList);
        setHasMoreRepos(rList.length >= PAGE_SIZE);
        setPageRepos(1);
        setSocialAccounts(socials);
        setPinnedItems(pinned);
        setProfileReadme(readme);

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
            setTokenScopes([]);
            setContributions({ total: 0, days: [] });
            setRepos([]);
            setStarredRepos([]);
            setGists([]);
            setEvents([]);
            setOrs([]);
            setFollowers([]);
            setFollowing([]);
            setSocialAccounts([]);
            setPinnedItems([]);
            setProfileReadme('');
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
          <Image
            source={require('../../assets/hero-banner.png')}
            style={styles.heroBanner}
            resizeMode="cover"
          />
          <View style={styles.authGateIconBox}>
            <Text style={styles.authGateIcon}>🔑</Text>
          </View>
          <Text style={styles.authGateTitle}>Connect GitHub Account</Text>
          <Text style={styles.authGateDesc}>
            GitPulse accesses GitHub exclusively through official authenticated APIs with zero third-party proxies. Your Personal Access Token (PAT) stays on your device.
          </Text>

          {/* Quick Setup Shortcut */}
          <TouchableOpacity
            style={styles.oneClickTokenBtn}
            onPress={() => Linking.openURL(GITHUB_NEW_TOKEN_URL)}
            activeOpacity={0.8}
          >
            <Text style={styles.oneClickTokenIcon}>⚡</Text>
            <View style={styles.oneClickTokenTextWrap}>
              <Text style={styles.oneClickTokenTitle}>Generate Token on GitHub ↗</Text>
              <Text style={styles.oneClickTokenSub}>
                Opens GitHub with all 5 required scopes pre-checked automatically
              </Text>
            </View>
          </TouchableOpacity>

          {/* Permissions Checklist */}
          <View style={styles.scopesGuideBox}>
            <Text style={styles.scopesGuideHeader}>TOKEN PERMISSIONS NEEDED</Text>
            <Text style={styles.scopesGuideHint}>
              Select these scopes on GitHub (or use the shortcut button above):
            </Text>

            {SCOPES_SPECS.map((item) => (
              <View key={item.scope} style={styles.scopeItemRow}>
                <View style={styles.scopeItemTop}>
                  <Text style={styles.scopeCodeText}>{item.scope}</Text>
                  <View
                    style={[
                      styles.scopeBadge,
                      item.level === 'Required'
                        ? styles.badgeRequired
                        : item.level === 'Recommended'
                        ? styles.badgeRecommended
                        : styles.badgeOptional,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeBadgeText,
                        item.level === 'Required'
                          ? styles.badgeTextRequired
                          : item.level === 'Recommended'
                          ? styles.badgeTextRecommended
                          : styles.badgeTextOptional,
                      ]}
                    >
                      {item.level.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.scopeItemDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.tokenBox}>
            <Text style={styles.inputLabel}>Personal Access Token (PAT)</Text>
            <TextInput
              style={styles.tokenInput}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor={Colors.textMuted}
              value={tokenInput}
              onChangeText={setTokenInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.tokenHint}>
              Classic token starting with <Text style={styles.tokenHintBold}>ghp_</Text> recommended. Stored encrypted on-device.
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
              <Image
                source={require('../../assets/hero-banner.png')}
                style={styles.profileBanner}
                resizeMode="cover"
              />
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

              {/* Profile Links & Social Accounts */}
              {(user.blog ||
                user.twitter_username ||
                user.email ||
                socialAccounts.length > 0) && (
                <View style={styles.profileLinksRow}>
                  {user.blog ? (
                    <TouchableOpacity
                      style={styles.profileLinkPill}
                      onPress={() =>
                        Linking.openURL(
                          user.blog!.startsWith('http')
                            ? user.blog!
                            : `https://${user.blog!}`
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.profileLinkIcon}>🔗</Text>
                      <Text style={styles.profileLinkText} numberOfLines={1}>
                        {user.blog.replace(/^https?:\/\//, '')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {user.twitter_username ? (
                    <TouchableOpacity
                      style={styles.profileLinkPill}
                      onPress={() =>
                        Linking.openURL(`https://x.com/${user.twitter_username}`)
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.profileLinkIcon}>𝕏</Text>
                      <Text style={styles.profileLinkText}>
                        @{user.twitter_username}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {user.email ? (
                    <TouchableOpacity
                      style={styles.profileLinkPill}
                      onPress={() => Linking.openURL(`mailto:${user.email}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.profileLinkIcon}>✉️</Text>
                      <Text style={styles.profileLinkText} numberOfLines={1}>
                        {user.email}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {socialAccounts.map((s, idx) => (
                    <TouchableOpacity
                      key={`${s.provider}-${idx}`}
                      style={styles.profileLinkPill}
                      onPress={() => Linking.openURL(s.url)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.profileLinkIcon}>🌐</Text>
                      <Text style={styles.profileLinkText}>{s.provider}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <TouchableOpacity
                  style={styles.statBox}
                  onPress={() => handleSubTabChange('repos')}
                >
                  <Text style={styles.statNumber}>
                    {(user.public_repos || 0) + (user.total_private_repos || 0)}
                  </Text>
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

              {/* Active Token Scopes Card */}
              <View style={styles.activeScopesCard}>
                <View style={styles.activeScopesHeaderRow}>
                  <Text style={styles.activeScopesHeaderTitle}>
                    🔑 Token Permissions
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://github.com/settings/tokens')}
                  >
                    <Text style={styles.editScopesLink}>Manage on GitHub ↗</Text>
                  </TouchableOpacity>
                </View>

                {tokenScopes.length === 0 ? (
                  <Text style={styles.fineGrainedNote}>
                    ● Active Personal Access Token (Resource-scoped / Fine-Grained)
                  </Text>
                ) : (
                  <>
                    <View style={styles.scopesPillsWrap}>
                      {SCOPES_SPECS.map((spec) => {
                        const hasThis =
                          tokenScopes.includes(spec.scope) ||
                          (spec.scope === 'read:user' && tokenScopes.includes('user')) ||
                          (spec.scope === 'read:org' && tokenScopes.includes('admin:org'));

                        return (
                          <View
                            key={spec.scope}
                            style={[
                              styles.scopePill,
                              hasThis ? styles.scopePillActive : styles.scopePillMissing,
                            ]}
                          >
                            <Text
                              style={[
                                styles.scopePillText,
                                hasThis
                                  ? styles.scopePillTextActive
                                  : styles.scopePillTextMissing,
                              ]}
                            >
                              {hasThis ? '✓' : spec.level === 'Required' ? '✕' : '⚠️'}{' '}
                              {spec.scope}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {!tokenScopes.includes('notifications') && (
                      <View style={styles.scopeWarningInline}>
                        <Text style={styles.scopeWarningInlineText}>
                          ⚠️ Missing <Text style={styles.scopeCodeTextInline}>notifications</Text> scope. Inbox tab notifications are disabled.
                        </Text>
                      </View>
                    )}
                  </>
                )}
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

          {/* Profile README Card ({username}/{username}/README.md) */}
          {profileReadme ? (
            <View style={styles.profileReadmeCard}>
              <View style={styles.profileReadmeHeader}>
                <View style={styles.profileReadmeTitleRow}>
                  <Text style={styles.profileReadmeIcon}>📖</Text>
                  <Text style={styles.profileReadmeTitle}>
                    {user?.login} / README.md
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setReadmeExpanded(!readmeExpanded)}
                  style={styles.readmeToggleBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.readmeToggleBtnText}>
                    {readmeExpanded ? 'Collapse ▴' : 'Expand ▾'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={styles.profileReadmeBody}
                numberOfLines={readmeExpanded ? undefined : 8}
              >
                {profileReadme}
              </Text>
            </View>
          ) : null}

          {/* Pinned Repositories (Official GraphQL API) */}
          {pinnedItems.length > 0 && (
            <View style={styles.pinnedContainer}>
              <Text style={styles.sectionHeader}>📌 Pinned Repositories</Text>
              <View style={styles.pinnedGrid}>
                {pinnedItems.map((pin) => (
                  <TouchableOpacity
                    key={pin.id}
                    style={styles.pinnedCard}
                    onPress={async () => {
                      const [owner, name] = pin.nameWithOwner.split('/');
                      const fullRepo = await GitHubApiService.getRepo(owner, name);
                      if (fullRepo) {
                        setSelectedRepo(fullRepo);
                        setRepoModalVisible(true);
                      } else {
                        Linking.openURL(pin.url);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pinnedHeaderRow}>
                      <Text style={styles.pinnedName} numberOfLines={1}>
                        {pin.name}
                      </Text>
                      <View style={styles.repoVisibilityBadge}>
                        <Text style={styles.repoVisibilityText}>
                          {pin.isPrivate ? '🔒 Private' : 'Public'}
                        </Text>
                      </View>
                    </View>

                    {pin.description ? (
                      <Text style={styles.pinnedDesc} numberOfLines={2}>
                        {pin.description}
                      </Text>
                    ) : null}

                    <View style={styles.pinnedFooter}>
                      {pin.primaryLanguage && (
                        <View style={styles.pinnedMetaItem}>
                          <View
                            style={[
                              styles.langDot,
                              {
                                backgroundColor:
                                  pin.primaryLanguage.color || Colors.primary,
                              },
                            ]}
                          />
                          <Text style={styles.pinnedMetaText}>
                            {pin.primaryLanguage.name}
                          </Text>
                        </View>
                      )}
                      <View style={styles.pinnedMetaItem}>
                        <Text style={styles.pinnedMetaIcon}>⭐</Text>
                        <Text style={styles.pinnedMetaText}>{pin.stargazerCount}</Text>
                      </View>
                      <View style={styles.pinnedMetaItem}>
                        <Text style={styles.pinnedMetaIcon}>🍴</Text>
                        <Text style={styles.pinnedMetaText}>{pin.forkCount}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Official GraphQL Contribution Heatmap */}
          <Text style={styles.sectionHeader}>Contribution Activity (Official API)</Text>
          <ContributionHeatmap
            days={contributions.days}
            total={contributions.total}
          />

          {/* Sub-Tab Navigation Bar (Fully scrollable, never clipped) */}
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
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'repos' && styles.subTabTextActive,
                ]}
              >
                Repositories (
                {(user?.public_repos || 0) + (user?.total_private_repos || 0) ||
                  repos.length}
                )
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'starred' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('starred')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'starred' && styles.subTabTextActive,
                ]}
              >
                Starred ({starredRepos.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'gists' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('gists')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'gists' && styles.subTabTextActive,
                ]}
              >
                Gists ({user?.public_gists ?? gists.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'activity' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('activity')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'activity' && styles.subTabTextActive,
                ]}
              >
                Activity Feed ({events.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'orgs' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('orgs')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'orgs' && styles.subTabTextActive,
                ]}
              >
                Organizations ({orgs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.subTabItem,
                activeSubTab === 'social' && styles.subTabItemActive,
              ]}
              onPress={() => handleSubTabChange('social')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subTabText,
                  activeSubTab === 'social' && styles.subTabTextActive,
                ]}
              >
                Network ({followers.length + following.length})
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
              {/* REPOSITORIES SUB-TAB WITH PAGINATION */}
              {activeSubTab === 'repos' && (
                <View style={styles.reposGrid}>
                  {repos.length > 0 ? (
                    <>
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
                            <Text style={styles.topRepoUpdated}>
                              Updated {formatRepoTimestamp(repo.updated_at)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                      {(hasMoreRepos || pageRepos > 1) && (
                        <PaginationControl
                          page={pageRepos}
                          hasNext={hasMoreRepos}
                          hasPrev={pageRepos > 1}
                          totalPages={
                            user
                              ? Math.ceil(
                                  ((user.public_repos || 0) +
                                    (user.total_private_repos || 0)) /
                                    PAGE_SIZE
                                )
                              : undefined
                          }
                          totalCount={
                            user
                              ? (user.public_repos || 0) +
                                (user.total_private_repos || 0)
                              : undefined
                          }
                          loading={loadingMoreRepos}
                          onPageChange={goToReposPage}
                        />
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>No repositories found.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* STARRED SUB-TAB WITH PAGINATION */}
              {activeSubTab === 'starred' && (
                <View style={styles.reposGrid}>
                  {starredRepos.length > 0 ? (
                    <>
                      {starredRepos.map((repo) => (
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
                            <Text style={styles.topRepoUpdated}>
                              Updated {formatRepoTimestamp(repo.updated_at)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}

                      {(hasMoreStarred || pageStarred > 1) && (
                        <PaginationControl
                          page={pageStarred}
                          hasNext={hasMoreStarred}
                          hasPrev={pageStarred > 1}
                          loading={loadingMoreStarred}
                          onPageChange={goToStarredPage}
                        />
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        No starred repositories found.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* GISTS SUB-TAB WITH PAGINATION */}
              {activeSubTab === 'gists' && (
                <View style={styles.listContainer}>
                  {gists.length > 0 ? (
                    <>
                      {gists.map((g) => {
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
                                {formatLocalDateTime(g.created_at)}
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
                      })}

                      {(hasMoreGists || pageGists > 1) && (
                        <PaginationControl
                          page={pageGists}
                          hasNext={hasMoreGists}
                          hasPrev={pageGists > 1}
                          totalPages={
                            user?.public_gists
                              ? Math.ceil(user.public_gists / PAGE_SIZE)
                              : undefined
                          }
                          totalCount={user?.public_gists}
                          loading={loadingMoreGists}
                          onPageChange={goToGistsPage}
                        />
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>No gists found.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ACTIVITY FEED SUB-TAB WITH PAGINATION */}
              {activeSubTab === 'activity' && (
                <View style={styles.listContainer}>
                  {events.length > 0 ? (
                    <>
                      {events.map((ev) => (
                        <View key={ev.id} style={styles.eventCard}>
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventIcon}>
                              {getEventIcon(ev.type)}
                            </Text>
                            <Text style={styles.eventRepoName} numberOfLines={1}>
                              {ev.repo.name}
                            </Text>
                            <Text style={styles.eventDate}>
                              {formatRepoTimestamp(ev.created_at)}
                            </Text>
                          </View>
                          <Text style={styles.eventDetail}>
                            {getEventDescription(ev)}
                          </Text>
                        </View>
                      ))}

                      {(hasMoreEvents || pageEvents > 1) && (
                        <PaginationControl
                          page={pageEvents}
                          hasNext={hasMoreEvents}
                          hasPrev={pageEvents > 1}
                          loading={loadingMoreEvents}
                          onPageChange={goToEventsPage}
                        />
                      )}
                    </>
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

              {/* SOCIAL (FOLLOWERS / FOLLOWING) SUB-TAB WITH PAGINATION */}
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
                    <>
                      {(socialTab === 'followers' ? followers : following).map((u) => (
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
                      ))}

                      {((socialTab === 'followers' ? hasMoreFollowers : hasMoreFollowing) ||
                        (socialTab === 'followers' ? pageFollowers : pageFollowing) > 1) && (
                        <PaginationControl
                          page={socialTab === 'followers' ? pageFollowers : pageFollowing}
                          hasNext={socialTab === 'followers' ? hasMoreFollowers : hasMoreFollowing}
                          hasPrev={(socialTab === 'followers' ? pageFollowers : pageFollowing) > 1}
                          totalPages={
                            socialTab === 'followers'
                              ? user?.followers
                                ? Math.ceil(user.followers / PAGE_SIZE)
                                : undefined
                              : user?.following
                              ? Math.ceil(user.following / PAGE_SIZE)
                              : undefined
                          }
                          totalCount={
                            socialTab === 'followers' ? user?.followers : user?.following
                          }
                          loading={
                            socialTab === 'followers'
                              ? loadingMoreFollowers
                              : loadingMoreFollowing
                          }
                          onPageChange={
                            socialTab === 'followers'
                              ? goToFollowersPage
                              : goToFollowingPage
                          }
                        />
                      )}
                    </>
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
  heroBanner: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.lg,
  },
  oneClickTokenBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  oneClickTokenIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  oneClickTokenTextWrap: {
    flex: 1,
  },
  oneClickTokenTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  oneClickTokenSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  scopesGuideBox: {
    width: '100%',
    backgroundColor: Colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  scopesGuideHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scopesGuideHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  scopeItemRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  scopeItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scopeCodeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: Colors.cyan,
  },
  scopeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeRequired: {
    backgroundColor: Colors.rubyMuted,
  },
  badgeRecommended: {
    backgroundColor: Colors.cyanMuted,
  },
  badgeOptional: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  scopeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextRequired: {
    color: Colors.ruby,
  },
  badgeTextRecommended: {
    color: Colors.cyan,
  },
  badgeTextOptional: {
    color: Colors.textSecondary,
  },
  scopeItemDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  tokenHintBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
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
  profileBanner: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    marginBottom: Spacing.md,
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
  profileLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  profileLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxWidth: '100%',
  },
  profileLinkIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  profileLinkText: {
    fontSize: 12,
    color: Colors.cyan,
    fontWeight: '600',
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
  activeScopesCard: {
    backgroundColor: Colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  activeScopesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  activeScopesHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editScopesLink: {
    fontSize: 11,
    color: Colors.cyan,
    fontWeight: '600',
  },
  fineGrainedNote: {
    fontSize: 12,
    color: Colors.emerald,
    marginTop: 4,
  },
  scopesPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  scopePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  scopePillActive: {
    backgroundColor: Colors.emeraldMuted,
    borderColor: Colors.emerald,
  },
  scopePillMissing: {
    backgroundColor: Colors.rubyMuted,
    borderColor: Colors.ruby,
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  scopePillTextActive: {
    color: Colors.emerald,
  },
  scopePillTextMissing: {
    color: Colors.ruby,
  },
  scopeWarningInline: {
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  scopeWarningInlineText: {
    fontSize: 11,
    color: Colors.gold,
    lineHeight: 15,
  },
  scopeCodeTextInline: {
    fontFamily: 'monospace',
    fontWeight: '700',
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
  profileReadmeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  profileReadmeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  profileReadmeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileReadmeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  profileReadmeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  readmeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.cardElevated,
    borderRadius: 6,
  },
  readmeToggleBtnText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  profileReadmeBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  pinnedContainer: {
    marginBottom: Spacing.xl,
  },
  pinnedGrid: {
    gap: 10,
  },
  pinnedCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  pinnedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pinnedName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.cyan,
    flex: 1,
    marginRight: 8,
  },
  pinnedDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  pinnedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  pinnedMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedMetaIcon: {
    fontSize: 11,
  },
  pinnedMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  pinnedLangBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedLangText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  langDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    alignItems: 'center',
  },
  subTabItem: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
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
    fontWeight: '700',
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
    flexWrap: 'wrap',
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
  topRepoUpdated: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
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
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
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
    fontWeight: '700',
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
  loadMoreBtn: {
    backgroundColor: Colors.cardElevated,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    color: Colors.cyan,
    fontSize: 13,
    fontWeight: '700',
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
