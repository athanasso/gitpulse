import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Linking,
  FlatList,
  TextInput,
} from 'react-native';
import { ThemePalette, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  GitHubRepo,
  GitHubFileItem,
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubBranch,
  GitHubRelease,
  GitHubContributor,
} from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';
import { CacheService, CacheKeys } from '../services/CacheService';
import { formatLocalDateTime, formatRepoTimestamp } from '../utils/date';
import { PaginationControl } from '../components/PaginationControl';
import { ThemedDialog, DialogButton } from '../components/ThemedDialog';
import { useCustomization } from '../context/CustomizationContext';
import { MarkdownWebView } from '../components/MarkdownWebView';

interface RepoDetailModalProps {
  visible: boolean;
  repo: GitHubRepo | null;
  onClose: () => void;
  onRepoDeleted?: (deletedRepoId: number) => void;
}

type RepoTab =
  | 'readme'
  | 'code'
  | 'commits'
  | 'issues'
  | 'actions'
  | 'releases'
  | 'insights';

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

const COMMITS_PAGE_SIZE = 30;
const ISSUES_PAGE_SIZE = 30;
const RUNS_PAGE_SIZE = 20;
const RELEASES_PAGE_SIZE = 20;

export const RepoDetailModal: React.FC<RepoDetailModalProps> = ({
  visible,
  repo,
  onClose,
  onRepoDeleted,
}) => {
  const { colors } = useTheme();
  const { settings } = useCustomization();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<RepoTab>(settings.defaultRepoDetailTab || 'readme');
  const [loading, setLoading] = useState(false);

  // App-themed Dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    icon?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
    buttons?: DialogButton[];
  }>({
    visible: false,
    title: '',
  });

  const showDialog = (config: {
    title: string;
    message?: string;
    icon?: string;
    type?: 'info' | 'success' | 'warning' | 'danger';
    buttons?: DialogButton[];
  }) => {
    setDialogConfig({
      visible: true,
      ...config,
    });
  };

  const hideDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  // GitHub-style safety modal state for repo deletion
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [isDeletingRepo, setIsDeletingRepo] = useState(false);

  const isSafetyMatched = Boolean(
    repo &&
      deleteInputText.trim().toLowerCase() === repo.full_name.toLowerCase()
  );

  const handleOpenSafetyModal = () => {
    setDeleteInputText('');
    setSafetyModalVisible(true);
  };

  const handleExecuteDelete = async () => {
    if (!repo || !isSafetyMatched) return;
    setIsDeletingRepo(true);
    const [owner, name] = repo.full_name.split('/');
    const res = await GitHubApiService.deleteRepo(owner, name);
    setIsDeletingRepo(false);
    setSafetyModalVisible(false);

    if (res.success) {
      showDialog({
        title: 'Repository Deleted',
        message: `"${repo.full_name}" was permanently deleted from GitHub.`,
        icon: '✅',
        type: 'success',
        buttons: [
          {
            text: 'Done',
            style: 'success',
            onPress: () => {
              hideDialog();
              onClose();
              onRepoDeleted?.(repo.id);
            },
          },
        ],
      });
    } else {
      showDialog({
        title: 'Deletion Failed',
        message:
          res.error ||
          'Could not delete repository. Verify that your Personal Access Token has the "delete_repo" scope enabled.',
        icon: '⚠️',
        type: 'danger',
        buttons: [{ text: 'Dismiss', style: 'primary', onPress: hideDialog }],
      });
    }
  };

  const currentUser = GitHubApiService.getCachedUser();
  const isOwner =
    Boolean(repo && currentUser && currentUser.login === repo.owner.login);

  const handlePromptDelete = () => {
    if (!repo) return;
    showDialog({
      title: 'Delete Repository',
      message: `Are you sure you want to permanently delete "${repo.full_name}"? This action cannot be undone and will delete all files, commits, branches, issues, and pull requests.`,
      icon: '🗑️',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: hideDialog },
        {
          text: 'Delete Repo',
          style: 'destructive',
          onPress: async () => {
            const [owner, name] = repo.full_name.split('/');
            showDialog({
              title: 'Deleting...',
              message: `Deleting ${repo.full_name} from GitHub...`,
              icon: '⏳',
              type: 'info',
              buttons: [],
            });
            const res = await GitHubApiService.deleteRepo(owner, name);
            if (res.success) {
              showDialog({
                title: 'Repository Deleted',
                message: `"${repo.full_name}" was permanently deleted from GitHub.`,
                icon: '✅',
                type: 'success',
                buttons: [
                  {
                    text: 'Done',
                    style: 'success',
                    onPress: () => {
                      hideDialog();
                      onClose();
                      onRepoDeleted?.(repo.id);
                    },
                  },
                ],
              });
            } else {
              showDialog({
                title: 'Deletion Failed',
                message:
                  res.error ||
                  'Could not delete repository. Verify that your Personal Access Token has the "delete_repo" scope enabled.',
                icon: '⚠️',
                type: 'danger',
                buttons: [{ text: 'Dismiss', style: 'primary', onPress: hideDialog }],
              });
            }
          },
        },
      ],
    });
  };

  // Branch switcher state
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [branchModalVisible, setBranchModalVisible] = useState(false);

  // Star state
  const [isStarred, setIsStarred] = useState(false);
  const [starsCount, setStarsCount] = useState<number>(0);
  const [starLoading, setStarLoading] = useState(false);

  // Tab Data
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [fileTree, setFileTree] = useState<GitHubFileItem[]>([]);
  const [viewingFile, setViewingFile] = useState<GitHubFileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  // Commits with pagination
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [commitsPage, setCommitsPage] = useState(1);
  const [hasMoreCommits, setHasMoreCommits] = useState(true);
  const [loadingMoreCommits, setLoadingMoreCommits] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);

  // Issues & PRs with pagination
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPrs] = useState<GitHubPullRequest[]>([]);
  const [issuesPage, setIssuesPage] = useState(1);
  const [hasMoreIssues, setHasMoreIssues] = useState(true);
  const [loadingMoreIssues, setLoadingMoreIssues] = useState(false);
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'closed'>('open');

  // Actions CI with pagination
  const [workflowRuns, setWorkflowRuns] = useState<GitHubWorkflowRun[]>([]);
  const [runsPage, setRunsPage] = useState(1);
  const [hasMoreRuns, setHasMoreRuns] = useState(true);
  const [loadingMoreRuns, setLoadingMoreRuns] = useState(false);

  // Releases with pagination
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
  const [releasesPage, setReleasesPage] = useState(1);
  const [hasMoreReleases, setHasMoreReleases] = useState(true);
  const [loadingMoreReleases, setLoadingMoreReleases] = useState(false);

  // Insights
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);

  useEffect(() => {
    if (visible && repo) {
      const defBranch = repo.default_branch || 'main';
      setSelectedBranch(defBranch);
      setStarsCount(repo.stargazers_count);
      setReadmeContent('');
      setFileTree([]);
      setCommits([]);
      setCommitsPage(1);
      setHasMoreCommits(true);
      setIssues([]);
      setPrs([]);
      setIssuesPage(1);
      setHasMoreIssues(true);
      setWorkflowRuns([]);
      setRunsPage(1);
      setHasMoreRuns(true);
      setReleases([]);
      setReleasesPage(1);
      setHasMoreReleases(true);
      setLanguages({});
      setContributors([]);
      setCurrentPath('');
      setViewingFile(null);
      setSelectedCommit(null);
      if (settings.defaultRepoDetailTab) {
        setActiveTab(settings.defaultRepoDetailTab);
      }

      const [owner, name] = repo.full_name.split('/');
      CacheService.get<string>(CacheKeys.REPO_README(owner, name)).then((cached) => {
        if (cached) setReadmeContent(cached);
      });
      GitHubApiService.isRepoStarred(owner, name).then((starred) => {
        setIsStarred(starred);
      });
      GitHubApiService.getRepoBranches(owner, name).then((bList) => {
        if (bList.length > 0) setBranches(bList);
      });
    }
  }, [visible, repo]);

  useEffect(() => {
    if (visible && repo) {
      loadTabData();
    }
  }, [visible, repo, activeTab]);

  const loadTabData = async (branchRef?: string) => {
    if (!repo) return;
    setLoading(true);
    const branch = branchRef || selectedBranch;

    try {
      const [owner, name] = repo.full_name.split('/');

      if (activeTab === 'readme') {
        const cacheKey = CacheKeys.REPO_README(owner, name);
        if (!readmeContent) {
          const cached = await CacheService.get<string>(cacheKey);
          if (cached) {
            setReadmeContent(cached);
            setLoading(false);
          }
        }
        const md = await GitHubApiService.getRepoReadme(owner, name);
        if (md) {
          setReadmeContent(md);
          CacheService.set(cacheKey, md);
        }
      } else if (activeTab === 'code' && fileTree.length === 0) {
        const tree = await GitHubApiService.getRepoTree(owner, name, currentPath, branch);
        setFileTree(tree);
      } else if (activeTab === 'commits' && commits.length === 0) {
        setCommitsPage(1);
        const cList = await GitHubApiService.getRepoCommits(
          owner,
          name,
          branch,
          1,
          COMMITS_PAGE_SIZE
        );
        setCommits(cList);
        setHasMoreCommits(cList.length >= COMMITS_PAGE_SIZE);
      } else if (activeTab === 'issues' && issues.length === 0 && prs.length === 0) {
        setIssuesPage(1);
        const { issues: iList, prs: pList } =
          await GitHubApiService.getIssuesAndPRs(
            owner,
            name,
            1,
            ISSUES_PAGE_SIZE
          );
        setIssues(iList);
        setPrs(pList);
        setHasMoreIssues(iList.length + pList.length >= ISSUES_PAGE_SIZE);
      } else if (activeTab === 'actions' && workflowRuns.length === 0) {
        setRunsPage(1);
        const runs = await GitHubApiService.getWorkflowRuns(
          owner,
          name,
          1,
          RUNS_PAGE_SIZE
        );
        setWorkflowRuns(runs);
        setHasMoreRuns(runs.length >= RUNS_PAGE_SIZE);
      } else if (activeTab === 'releases' && releases.length === 0) {
        setReleasesPage(1);
        const rels = await GitHubApiService.getRepoReleases(
          owner,
          name,
          1,
          RELEASES_PAGE_SIZE
        );
        setReleases(rels);
        setHasMoreReleases(rels.length >= RELEASES_PAGE_SIZE);
      } else if (activeTab === 'insights' && Object.keys(languages).length === 0) {
        const [langMap, contribList] = await Promise.all([
          GitHubApiService.getRepoLanguages(owner, name),
          GitHubApiService.getRepoContributors(owner, name),
        ]);
        setLanguages(langMap);
        setContributors(contribList);
      }
    } catch (e) {
      console.warn('Error loading repo tab', e);
    } finally {
      setLoading(false);
    }
  };

  const goToCommitsPage = async (newPage: number) => {
    if (!repo || loadingMoreCommits || newPage < 1) return;
    setLoadingMoreCommits(true);
    const [owner, name] = repo.full_name.split('/');
    const list = await GitHubApiService.getRepoCommits(
      owner,
      name,
      selectedBranch,
      newPage,
      COMMITS_PAGE_SIZE
    );
    setCommits(list);
    setHasMoreCommits(list.length >= COMMITS_PAGE_SIZE);
    setCommitsPage(newPage);
    setLoadingMoreCommits(false);
  };

  const goToIssuesPage = async (newPage: number) => {
    if (!repo || loadingMoreIssues || newPage < 1) return;
    setLoadingMoreIssues(true);
    const [owner, name] = repo.full_name.split('/');
    const { issues: moreI, prs: moreP } = await GitHubApiService.getIssuesAndPRs(
      owner,
      name,
      newPage,
      ISSUES_PAGE_SIZE
    );
    setIssues(moreI);
    setPrs(moreP);
    setHasMoreIssues(moreI.length + moreP.length >= ISSUES_PAGE_SIZE);
    setIssuesPage(newPage);
    setLoadingMoreIssues(false);
  };

  const goToWorkflowRunsPage = async (newPage: number) => {
    if (!repo || loadingMoreRuns || newPage < 1) return;
    setLoadingMoreRuns(true);
    const [owner, name] = repo.full_name.split('/');
    const list = await GitHubApiService.getWorkflowRuns(
      owner,
      name,
      newPage,
      RUNS_PAGE_SIZE
    );
    setWorkflowRuns(list);
    setHasMoreRuns(list.length >= RUNS_PAGE_SIZE);
    setRunsPage(newPage);
    setLoadingMoreRuns(false);
  };

  const goToReleasesPage = async (newPage: number) => {
    if (!repo || loadingMoreReleases || newPage < 1) return;
    setLoadingMoreReleases(true);
    const [owner, name] = repo.full_name.split('/');
    const list = await GitHubApiService.getRepoReleases(
      owner,
      name,
      newPage,
      RELEASES_PAGE_SIZE
    );
    setReleases(list);
    setHasMoreReleases(list.length >= RELEASES_PAGE_SIZE);
    setReleasesPage(newPage);
    setLoadingMoreReleases(false);
  };

  const handleSelectBranch = async (branchName: string) => {
    setSelectedBranch(branchName);
    setBranchModalVisible(false);
    if (!repo) return;

    const [owner, name] = repo.full_name.split('/');
    if (activeTab === 'code') {
      setLoading(true);
      setCurrentPath('');
      setViewingFile(null);
      const tree = await GitHubApiService.getRepoTree(owner, name, '', branchName);
      setFileTree(tree);
      setLoading(false);
    } else if (activeTab === 'commits') {
      setLoading(true);
      setSelectedCommit(null);
      setCommitsPage(1);
      const cList = await GitHubApiService.getRepoCommits(
        owner,
        name,
        branchName,
        1,
        COMMITS_PAGE_SIZE
      );
      setCommits(cList);
      setHasMoreCommits(cList.length >= COMMITS_PAGE_SIZE);
      setLoading(false);
    }
  };

  const handleToggleStar = async () => {
    if (!repo || starLoading) return;
    setStarLoading(true);
    const [owner, name] = repo.full_name.split('/');

    try {
      if (isStarred) {
        const ok = await GitHubApiService.unstarRepo(owner, name);
        if (ok) {
          setIsStarred(false);
          setStarsCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const ok = await GitHubApiService.starRepo(owner, name);
        if (ok) {
          setIsStarred(true);
          setStarsCount((prev) => prev + 1);
        }
      }
    } catch (e) {
      console.warn('Star toggle error', e);
    } finally {
      setStarLoading(false);
    }
  };

  const navigateToDirectory = async (dirPath: string) => {
    if (!repo) return;
    setLoading(true);
    setCurrentPath(dirPath);
    setViewingFile(null);

    const [owner, name] = repo.full_name.split('/');
    const tree = await GitHubApiService.getRepoTree(
      owner,
      name,
      dirPath,
      selectedBranch
    );
    setFileTree(tree);
    setLoading(false);
  };

  const navigateUp = async () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    await navigateToDirectory(parentPath);
  };

  const openFile = async (item: GitHubFileItem) => {
    if (!repo) return;
    setLoading(true);
    setViewingFile(item);

    const [owner, name] = repo.full_name.split('/');
    const content = await GitHubApiService.getFileContent(
      owner,
      name,
      item.path,
      selectedBranch
    );
    setFileContent(content);
    setLoading(false);
  };

  const handleShare = async () => {
    if (!repo) return;
    try {
      await Share.share({
        message: `${repo.full_name} on GitHub: ${repo.html_url}`,
        url: repo.html_url,
      });
    } catch {
      // ignore
    }
  };

  if (!repo) return null;

  // Language Breakdown Calculations
  const totalBytes = Object.values(languages).reduce((sum, b) => sum + b, 0);
  const languageList = Object.entries(languages)
    .map(([lang, bytes]) => ({
      name: lang,
      bytes,
      percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
      color: LANGUAGE_COLORS[lang] || colors.primary,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.repoName} numberOfLines={1}>
              {repo.name}
            </Text>
            <Text style={styles.repoOwner}>{repo.owner.login}</Text>
          </View>

          {/* Star & Share Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleToggleStar}
              style={[
                styles.iconButton,
                isStarred && styles.iconButtonStarred,
              ]}
              disabled={starLoading}
            >
              {starLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionIcon}>{isStarred ? '⭐' : '☆'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
              <Text style={styles.actionIcon}>🔗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats & Branch Switcher Bar */}
        <View style={styles.statsBar}>
          <TouchableOpacity
            style={styles.statPill}
            onPress={handleToggleStar}
            activeOpacity={0.7}
          >
            <Text style={styles.statIcon}>{isStarred ? '⭐' : '☆'}</Text>
            <Text style={styles.statValue}>{starsCount}</Text>
          </TouchableOpacity>

          <View style={styles.statPill}>
            <Text style={styles.statIcon}>🍴</Text>
            <Text style={styles.statValue}>{repo.forks_count}</Text>
          </View>

          {/* Branch Switcher Pill */}
          <TouchableOpacity
            style={[styles.statPill, styles.branchPill]}
            onPress={() => setBranchModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.statIcon}>🌿</Text>
            <Text style={styles.branchPillText} numberOfLines={1}>
              {selectedBranch}
            </Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </TouchableOpacity>

          {repo.language && (
            <View style={styles.statPill}>
              <View
                style={[
                  styles.languageDot,
                  {
                    backgroundColor:
                      LANGUAGE_COLORS[repo.language] || colors.primary,
                  },
                ]}
              />
              <Text style={styles.statValue}>{repo.language}</Text>
            </View>
          )}
        </View>

        {/* Local Time Meta Row */}
        <View style={styles.repoMetaTimeRow}>
          <Text style={styles.repoMetaTimeText}>
🕒 Updated {formatRepoTimestamp(repo.updated_at)}
          </Text>
          {repo.pushed_at ? (
            <Text style={styles.repoMetaTimeText}>
🚀 Pushed {formatRepoTimestamp(repo.pushed_at)}
            </Text>
          ) : null}
        </View>

        {/* Scrollable Tab Bar (Never truncated) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'readme' && styles.tabActive]}
            onPress={() => setActiveTab('readme')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'readme' && styles.tabTextActive,
              ]}
            >
              README
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'code' && styles.tabActive]}
            onPress={() => setActiveTab('code')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'code' && styles.tabTextActive,
              ]}
            >
              Code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'commits' && styles.tabActive]}
            onPress={() => setActiveTab('commits')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'commits' && styles.tabTextActive,
              ]}
            >
              Commits
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'issues' && styles.tabActive]}
            onPress={() => setActiveTab('issues')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'issues' && styles.tabTextActive,
              ]}
            >
              PR & Issues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'actions' && styles.tabActive]}
            onPress={() => setActiveTab('actions')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'actions' && styles.tabTextActive,
              ]}
            >
              Actions CI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'releases' && styles.tabActive]}
            onPress={() => setActiveTab('releases')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'releases' && styles.tabTextActive,
              ]}
            >
              Releases
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
            onPress={() => setActiveTab('insights')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'insights' && styles.tabTextActive,
              ]}
            >
              Insights
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content Body */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentPadding}
          >
            {/* README TAB */}
            {activeTab === 'readme' && (
              <>
                <View style={styles.readmeCard}>
                  <View style={styles.readmeHeader}>
                    <Text style={styles.readmeHeaderTitle}>📖 README.md</Text>
                  </View>
                  <MarkdownWebView
                    htmlContent={readmeContent}
                    colors={colors}
                    isLoading={loading && !readmeContent}
                    emptyMessage="No README.md found in this repository."
                  />
                </View>

                {/* Danger Zone: Delete Repository (if owner / admin) */}
                {isOwner && settings.enableRepoDeletion && (
                  <View style={styles.dangerZoneCard}>
                    <View style={styles.dangerZoneHeader}>
                      <Text style={styles.dangerZoneTitle}>⚠️ Danger Zone</Text>
                    </View>
                    <View style={styles.dangerZoneContent}>
                      <View style={styles.dangerZoneTextWrap}>
                        <Text style={styles.dangerActionTitle}>
                          Delete this repository
                        </Text>
                        <Text style={styles.dangerActionDesc}>
                          Permanently delete {repo?.name} and all associated data from GitHub.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteRepoBtn}
                        onPress={handleOpenSafetyModal}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.deleteRepoBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* CODE TAB */}
            {activeTab === 'code' && (
              <View style={styles.codeContainer}>
                {viewingFile ? (
                  // File Content Viewer
                  <View style={styles.fileViewer}>
                    <View style={styles.fileViewerHeader}>
                      <TouchableOpacity
                        onPress={() => setViewingFile(null)}
                        style={styles.backButton}
                      >
                        <Text style={styles.backButtonText}>
← {viewingFile.name}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.fileSizeText}>
                        {Math.round(viewingFile.size / 1024)} KB
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.codeHorizontalScroll}
                    >
                      <View style={styles.codeEditorBox}>
                        {fileContent ? (
                          fileContent.split('\n').map((line, idx) => (
                            <View key={idx} style={styles.codeLineRow}>
                              <Text style={styles.codeLineNumber}>
                                {idx + 1}
                              </Text>
                              <Text style={styles.codeLineText}>
                                {line || ' '}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.emptyDetailText}>
                            Empty file or binary content.
                          </Text>
                        )}
                      </View>
                    </ScrollView>
                  </View>
                ) : fileTree.length > 0 ? (
                  // Directory Tree
                  <View style={styles.treeContainer}>
                    {currentPath !== '' && (
                      <TouchableOpacity
                        style={styles.treeUpRow}
                        onPress={navigateUp}
                      >
                        <Text style={styles.treeIcon}>📁</Text>
                        <Text style={styles.treeUpText}>.. (Up one level)</Text>
                      </TouchableOpacity>
                    )}

                    {fileTree.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.treeItemRow}
                        onPress={() =>
                          item.type === 'dir'
                            ? navigateToDirectory(item.path)
                            : openFile(item)
                        }
                      >
                        <Text style={styles.treeIcon}>
                          {item.type === 'dir' ? '📁' : '📄'}
                        </Text>
                        <Text style={styles.treeItemName}>{item.name}</Text>
                        {item.type === 'file' && (
                          <Text style={styles.treeItemSize}>
                            {item.size > 1024
                              ? `${Math.round(item.size / 1024)}KB`
                              : `${item.size}B`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No files found in branch "{selectedBranch}".
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* COMMITS TAB WITH PAGINATION */}
            {activeTab === 'commits' && (
              <View style={styles.commitsContainer}>
                {selectedCommit ? (
                  <View style={styles.commitDetailCard}>
                    <TouchableOpacity
                      onPress={() => setSelectedCommit(null)}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>← Back to commits</Text>
                    </TouchableOpacity>

                    <Text style={styles.commitDetailMsg}>
                      {selectedCommit.commit.message}
                    </Text>

                    <View style={styles.commitShaRow}>
                      <Text style={styles.shaBadge}>
                        {selectedCommit.sha.substring(0, 7)}
                      </Text>
                      <Text style={styles.commitAuthor}>
                        {selectedCommit.commit.author.name} Â·{' '}
                        {formatLocalDateTime(selectedCommit.commit.author.date)}
                      </Text>
                    </View>

                    {selectedCommit.stats && (
                      <View style={styles.diffStatsRow}>
                        <Text style={styles.diffAdd}>
                          +{selectedCommit.stats.additions}
                        </Text>
                        <Text style={styles.diffDel}>
                          -{selectedCommit.stats.deletions}
                        </Text>
                        <Text style={styles.diffTotal}>
                          {selectedCommit.stats.total} lines changed
                        </Text>
                      </View>
                    )}
                  </View>
                ) : commits.length > 0 ? (
                  <>
                    {commits.map((c) => (
                      <TouchableOpacity
                        key={c.sha}
                        style={styles.commitItem}
                        onPress={() => setSelectedCommit(c)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.commitHeaderRow}>
                          <Text style={styles.commitShaBadge}>
                            {c.sha.substring(0, 7)}
                          </Text>
                          <Text style={styles.commitDate}>
                            {formatRepoTimestamp(c.commit.author.date)}
                          </Text>
                        </View>
                        <Text style={styles.commitMessage} numberOfLines={2}>
                          {c.commit.message}
                        </Text>
                        <Text style={styles.commitAuthorLine}>
                          by {c.commit.author.name}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {(hasMoreCommits || commitsPage > 1) && (
                      <PaginationControl
                        page={commitsPage}
                        hasNext={hasMoreCommits}
                        hasPrev={commitsPage > 1}
                        loading={loadingMoreCommits}
                        onPageChange={goToCommitsPage}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No commits found in branch "{selectedBranch}".
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ISSUES & PRs TAB WITH PAGINATION */}
            {activeTab === 'issues' && (
              <View style={styles.issuesContainer}>
                {/* Sub filter (Scrollable so chips never get squished) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.issueFilterRow}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'all' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('all')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        issueFilter === 'all' && styles.filterChipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'open' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('open')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        issueFilter === 'open' && styles.filterChipTextActive,
                      ]}
                    >
                      Open
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'closed' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('closed')}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        issueFilter === 'closed' && styles.filterChipTextActive,
                      ]}
                    >
                      Closed
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* PR Section */}
                <Text style={styles.sectionHeader}>Pull Requests ({prs.length})</Text>
                {prs.length > 0 ? (
                  prs
                    .filter((p) => issueFilter === 'all' || p.state === issueFilter)
                    .map((p) => (
                      <View key={p.id} style={styles.issueCard}>
                        <View style={styles.issueHeaderRow}>
                          <View style={styles.stateBadgePR}>
                            <Text style={styles.stateBadgeText}>🔀 #{p.number}</Text>
                          </View>
                          <Text style={styles.issueDate}>
                            {formatRepoTimestamp(p.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.issueTitle}>{p.title}</Text>
                        {p.body && (
                          <Text style={styles.issueBody} numberOfLines={2}>
                            {p.body}
                          </Text>
                        )}
                        {p.additions !== undefined && (
                          <View style={styles.diffPills}>
                            <Text style={styles.diffAdd}>+{p.additions}</Text>
                            <Text style={styles.diffDel}>-{p.deletions}</Text>
                          </View>
                        )}
                      </View>
                    ))
                ) : (
                  <Text style={styles.emptySubText}>No pull requests found.</Text>
                )}

                {/* Issues Section */}
                <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                  Issues ({issues.length})
                </Text>
                {issues.length > 0 ? (
                  issues
                    .filter((i) => issueFilter === 'all' || i.state === issueFilter)
                    .map((i) => (
                      <View key={i.id} style={styles.issueCard}>
                        <View style={styles.issueHeaderRow}>
                          <View
                            style={[
                              styles.stateBadgeIssue,
                              i.state === 'closed' && styles.stateBadgeClosed,
                            ]}
                          >
                            <Text style={styles.stateBadgeText}>
                              {i.state === 'open' ? '🟢' : '🟣'} #{i.number}
                            </Text>
                          </View>
                          <Text style={styles.issueDate}>
                            {formatRepoTimestamp(i.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.issueTitle}>{i.title}</Text>
                        {i.body && (
                          <Text style={styles.issueBody} numberOfLines={2}>
                            {i.body}
                          </Text>
                        )}
                      </View>
                    ))
                ) : (
                  <Text style={styles.emptySubText}>No issues found.</Text>
                )}

                {/* Pagination for Issues & PRs */}
                {(hasMoreIssues || issuesPage > 1) && (
                  <PaginationControl
                    page={issuesPage}
                    hasNext={hasMoreIssues}
                    hasPrev={issuesPage > 1}
                    loading={loadingMoreIssues}
                    onPageChange={goToIssuesPage}
                  />
                )}
              </View>
            )}

            {/* ACTIONS CI TAB WITH PAGINATION */}
            {activeTab === 'actions' && (
              <View style={styles.actionsContainer}>
                {workflowRuns.length > 0 ? (
                  <>
                    {workflowRuns.map((r) => (
                      <View key={r.id} style={styles.workflowCard}>
                        <View style={styles.workflowHeader}>
                          <View style={styles.conclusionBadge}>
                            <Text style={styles.conclusionIcon}>
                              {r.conclusion === 'success'
                                ? '✅'
                                : r.conclusion === 'failure'
                                ? '❌'
                                : '⏳'}
                            </Text>
                            <Text style={styles.workflowName}>{r.name}</Text>
                          </View>
                          <Text style={styles.runNumber}>#{r.run_number}</Text>
                        </View>

                        <View style={styles.workflowMetaRow}>
                          <Text style={styles.workflowBranch}>🌿 {r.head_branch}</Text>
                          <Text style={styles.workflowSha}>{r.head_sha.substring(0, 7)}</Text>
                          <Text style={styles.workflowDate}>
                            {formatRepoTimestamp(r.created_at)}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {(hasMoreRuns || runsPage > 1) && (
                      <PaginationControl
                        page={runsPage}
                        hasNext={hasMoreRuns}
                        hasPrev={runsPage > 1}
                        loading={loadingMoreRuns}
                        onPageChange={goToWorkflowRunsPage}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No GitHub Actions workflow runs found for this repository.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* RELEASES & ASSETS TAB WITH PAGINATION */}
            {activeTab === 'releases' && (
              <View style={styles.releasesContainer}>
                {releases.length > 0 ? (
                  <>
                    {releases.map((rel) => (
                      <View key={rel.id} style={styles.releaseCard}>
                        <View style={styles.releaseHeader}>
                          <View style={styles.tagBadge}>
                            <Text style={styles.tagBadgeText}>🏷️ {rel.tag_name}</Text>
                          </View>
                          {rel.prerelease && (
                            <View style={styles.prereleaseBadge}>
                              <Text style={styles.prereleaseText}>Pre-release</Text>
                            </View>
                          )}
                          <Text style={styles.releaseDate}>
                            {formatLocalDateTime(rel.published_at)}
                          </Text>
                        </View>

                        <Text style={styles.releaseTitle}>
                          {rel.name || rel.tag_name}
                        </Text>

                        {rel.body && (
                          <Text style={styles.releaseBody} numberOfLines={4}>
                            {rel.body}
                          </Text>
                        )}

                        {/* Assets Section */}
                        {rel.assets && rel.assets.length > 0 && (
                          <View style={styles.assetsSection}>
                            <Text style={styles.assetsTitle}>
📦 Assets ({rel.assets.length})
                            </Text>
                            {rel.assets.map((asset) => (
                              <TouchableOpacity
                                key={asset.id}
                                style={styles.assetRow}
                                onPress={() => Linking.openURL(asset.browser_download_url)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.assetIcon}>💾</Text>
                                <Text style={styles.assetName} numberOfLines={1}>
                                  {asset.name}
                                </Text>
                                <Text style={styles.assetSize}>
                                  {asset.size > 1048576
                                  ? `${(asset.size / 1048576).toFixed(1)} MB`
                                  : `${Math.round(asset.size / 1024)} KB`}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}

                    {(hasMoreReleases || releasesPage > 1) && (
                      <PaginationControl
                        page={releasesPage}
                        hasNext={hasMoreReleases}
                        hasPrev={releasesPage > 1}
                        loading={loadingMoreReleases}
                        onPageChange={goToReleasesPage}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No official releases found for this repository.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* INSIGHTS TAB: LANGUAGES & CONTRIBUTORS */}
            {activeTab === 'insights' && (
              <View style={styles.insightsContainer}>
                {/* Language Breakdown */}
                <View style={styles.insightSectionCard}>
                  <Text style={styles.sectionHeader}>Languages Breakdown</Text>
                  {languageList.length > 0 ? (
                    <>
                      {/* Proportional Multi-Segment Progress Bar */}
                      <View style={styles.langBarContainer}>
                        {languageList.map((l) => (
                          <View
                            key={l.name}
                            style={[
                              styles.langBarSegment,
                              {
                                flex: l.percentage,
                                backgroundColor: l.color,
                              },
                            ]}
                          />
                        ))}
                      </View>

                      {/* Language Legend Grid */}
                      <View style={styles.langLegendGrid}>
                        {languageList.map((l) => (
                          <View key={l.name} style={styles.langLegendItem}>
                            <View
                              style={[
                                styles.langLegendDot,
                                { backgroundColor: l.color },
                              ]}
                            />
                            <Text style={styles.langLegendName}>{l.name}</Text>
                            <Text style={styles.langLegendPercent}>
                              {l.percentage.toFixed(1)}%
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyDetailText}>
                      No language metrics available.
                    </Text>
                  )}
                </View>

                {/* Contributor Leaderboard */}
                <View style={styles.insightSectionCard}>
                  <Text style={styles.sectionHeader}>
                    Contributors ({contributors.length})
                  </Text>
                  {contributors.length > 0 ? (
                    contributors.map((c, idx) => (
                      <View key={c.id} style={styles.contributorRow}>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankText}>#{idx + 1}</Text>
                        </View>
                        <Text style={styles.contributorName}>@{c.login}</Text>
                        <View style={styles.contributorCountBadge}>
                          <Text style={styles.contributorCountText}>
                            {c.contributions} {c.contributions === 1 ? 'commit' : 'commits'}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyDetailText}>
                      No contributors recorded.
                    </Text>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Branch Selector Modal */}
        <Modal
          visible={branchModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setBranchModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.branchModalCard}>
              <View style={styles.branchModalHeader}>
                <Text style={styles.branchModalTitle}>Switch Branch</Text>
                <TouchableOpacity
                  onPress={() => setBranchModalVisible(false)}
                  style={styles.branchModalClose}
                >
                  <Text style={styles.branchModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={branches}
                keyExtractor={(item) => item.name}
                style={styles.branchList}
                renderItem={({ item }) => {
                  const isCurrent = item.name === selectedBranch;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.branchItem,
                        isCurrent && styles.branchItemActive,
                      ]}
                      onPress={() => handleSelectBranch(item.name)}
                    >
                      <Text style={styles.branchItemIcon}>🌿</Text>
                      <Text
                        style={[
                          styles.branchItemText,
                          isCurrent && styles.branchItemTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.protected && (
                        <View style={styles.protectedBadge}>
                          <Text style={styles.protectedText}>protected</Text>
                        </View>
                      )}
                      {isCurrent && <Text style={styles.checkIcon}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No alternate branches found.
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        {/* GitHub-Style Delete Safety Modal */}
        <Modal
          visible={safetyModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!isDeletingRepo) setSafetyModalVisible(false);
          }}
        >
          <View style={styles.safetyModalOverlay}>
            <View style={styles.safetyModalCard}>
              <View style={styles.safetyModalHeader}>
                <Text style={styles.safetyModalTitle}>⚠️ Delete repository</Text>
                <TouchableOpacity
                  onPress={() => setSafetyModalVisible(false)}
                  disabled={isDeletingRepo}
                  style={styles.safetyCloseBtn}
                >
                  <Text style={styles.safetyCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.safetyWarningBox}>
                <Text style={styles.safetyWarningTitle}>
                  Unexpected bad things will happen if you don't read this!
                </Text>
                <Text style={styles.safetyWarningDesc}>
                  This action <Text style={{ fontWeight: 'bold' }}>cannot</Text> be undone. This will permanently delete the <Text style={{ fontFamily: 'monospace', color: colors.ruby }}>{repo?.full_name}</Text> repository, wiki, issues, comments, packages, secrets, and remove all collaborator associations.
                </Text>
              </View>

              <Text style={styles.safetyPromptLabel}>
                To confirm, type <Text style={styles.safetyPromptTarget}>{repo?.full_name}</Text> in the box below:
              </Text>

              <TextInput
                style={[
                  styles.safetyInput,
                  isSafetyMatched && styles.safetyInputMatched,
                ]}
                value={deleteInputText}
                onChangeText={setDeleteInputText}
                placeholder={repo?.full_name}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isDeletingRepo}
              />

              <TouchableOpacity
                style={[
                  styles.safetyDeleteBtn,
                  (!isSafetyMatched || isDeletingRepo) && styles.safetyDeleteBtnDisabled,
                ]}
                onPress={handleExecuteDelete}
                disabled={!isSafetyMatched || isDeletingRepo}
                activeOpacity={0.8}
              >
                {isDeletingRepo ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.safetyDeleteBtnText}>
                    I understand the consequences, delete this repository
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* App-Themed Pop-Up Dialog */}
        <ThemedDialog
          visible={dialogConfig.visible}
          title={dialogConfig.title}
          message={dialogConfig.message}
          icon={dialogConfig.icon}
          type={dialogConfig.type}
          buttons={dialogConfig.buttons}
          onClose={hideDialog}
        />
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  repoName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  repoOwner: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonStarred: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  actionIcon: {
    fontSize: 16,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  branchPill: {
    maxWidth: 130,
    backgroundColor: colors.cardElevated,
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyan,
    marginRight: 4,
  },
  dropdownCaret: {
    fontSize: 10,
    color: colors.cyan,
  },
  statIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  languageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  repoMetaTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    backgroundColor: colors.backgroundElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    flexWrap: 'wrap',
  },
  repoMetaTimeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  tabsScrollView: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.backgroundElevated,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
  },
  tab: {
    flexShrink: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  contentPadding: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  readmeCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: Spacing.lg,
  },
  readmeHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  readmeHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  readmeBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  codeContainer: {
    flex: 1,
  },
  treeContainer: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  treeUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.backgroundElevated,
  },
  treeUpText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  treeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  treeIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  treeItemName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  treeItemSize: {
    fontSize: 11,
    color: colors.textMuted,
  },
  fileViewer: {
    backgroundColor: colors.codeBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.codeBorder,
    overflow: 'hidden',
  },
  fileViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  fileSizeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  codeHorizontalScroll: {
    paddingVertical: Spacing.sm,
  },
  codeEditorBox: {
    paddingHorizontal: Spacing.md,
  },
  codeLineRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  codeLineNumber: {
    width: 36,
    color: colors.codeLineNumber,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right',
    marginRight: 12,
  },
  codeLineText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  commitsContainer: {
    gap: 12,
  },
  commitItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commitShaBadge: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.cyan,
    backgroundColor: colors.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  commitDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  commitMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  commitAuthorLine: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  commitDetailCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commitDetailMsg: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  commitShaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 8,
  },
  shaBadge: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.primary,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  commitAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  diffStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  diffAdd: {
    color: colors.emerald,
    fontSize: 13,
    fontWeight: '700',
  },
  diffDel: {
    color: colors.ruby,
    fontSize: 13,
    fontWeight: '700',
  },
  diffTotal: {
    color: colors.textMuted,
    fontSize: 12,
  },
  issuesContainer: {
    gap: 12,
  },
  issueFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  issueCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  issueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stateBadgePR: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateBadgeIssue: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateBadgeClosed: {
    backgroundColor: colors.rubyMuted,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  issueDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  issueBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  diffPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  actionsContainer: {
    gap: 12,
  },
  workflowCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  workflowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conclusionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conclusionIcon: {
    fontSize: 14,
  },
  workflowName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  runNumber: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.cyan,
  },
  workflowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workflowBranch: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  workflowSha: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.primary,
  },
  workflowDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  releasesContainer: {
    gap: 14,
  },
  releaseCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: colors.cyanMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyan,
  },
  prereleaseBadge: {
    backgroundColor: colors.rubyMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prereleaseText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ruby,
  },
  releaseDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  releaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  releaseBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  assetsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 8,
  },
  assetsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  assetIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  assetName: {
    flex: 1,
    fontSize: 12,
    color: colors.cyan,
    fontWeight: '600',
  },
  assetSize: {
    fontSize: 11,
    color: colors.textMuted,
  },
  insightsContainer: {
    gap: 16,
  },
  insightSectionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  langBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.cardElevated,
    marginVertical: Spacing.md,
  },
  langBarSegment: {
    height: '100%',
  },
  langLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: Spacing.sm,
  },
  langLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  langLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  langLegendName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 4,
  },
  langLegendPercent: {
    fontSize: 11,
    color: colors.textMuted,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  rankBadge: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  contributorName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contributorCountBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contributorCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  modalLoadMoreBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: Spacing.sm,
  },
  modalLoadMoreText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyDetailText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  branchModalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  branchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  branchModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  branchModalClose: {
    padding: 4,
  },
  branchModalCloseText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  branchList: {
    padding: Spacing.md,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: 4,
  },
  branchItemActive: {
    backgroundColor: colors.cardElevated,
  },
  branchItemIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  branchItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  branchItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  protectedBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  protectedText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  checkIcon: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  dangerZoneCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  dangerZoneHeader: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  dangerZoneTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ruby,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerZoneContent: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dangerZoneTextWrap: {
    flex: 1,
  },
  dangerActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  dangerActionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  deleteRepoBtn: {
    backgroundColor: colors.ruby,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  deleteRepoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  safetyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  safetyModalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    width: '100%',
    maxWidth: 420,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  safetyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  safetyModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ruby,
    letterSpacing: 0.3,
  },
  safetyCloseBtn: {
    padding: 6,
  },
  safetyCloseText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  safetyWarningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  safetyWarningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ruby,
    marginBottom: 4,
  },
  safetyWarningDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  safetyPromptLabel: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  safetyPromptTarget: {
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.cyan,
  },
  safetyInput: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: Spacing.lg,
  },
  safetyInputMatched: {
    borderColor: colors.ruby,
  },
  safetyDeleteBtn: {
    backgroundColor: colors.ruby,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyDeleteBtnDisabled: {
    opacity: 0.35,
  },
  safetyDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
});
