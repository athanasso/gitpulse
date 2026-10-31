import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
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

interface RepoDetailModalProps {
  visible: boolean;
  repo: GitHubRepo | null;
  onClose: () => void;
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

export const RepoDetailModal: React.FC<RepoDetailModalProps> = ({
  visible,
  repo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<RepoTab>('readme');
  const [loading, setLoading] = useState(false);

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
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [prs, setPrs] = useState<GitHubPullRequest[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<GitHubWorkflowRun[]>([]);
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'closed'>('open');

  // Extended Data: Releases & Insights
  const [releases, setReleases] = useState<GitHubRelease[]>([]);
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
      setIssues([]);
      setPrs([]);
      setWorkflowRuns([]);
      setReleases([]);
      setLanguages({});
      setContributors([]);
      setCurrentPath('');
      setViewingFile(null);
      setSelectedCommit(null);

      const [owner, name] = repo.full_name.split('/');
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

      if (activeTab === 'readme' && !readmeContent) {
        const md = await GitHubApiService.getRepoReadme(owner, name);
        setReadmeContent(md);
      } else if (activeTab === 'code' && fileTree.length === 0) {
        const tree = await GitHubApiService.getRepoTree(owner, name, currentPath, branch);
        setFileTree(tree);
      } else if (activeTab === 'commits' && commits.length === 0) {
        const cList = await GitHubApiService.getRepoCommits(owner, name, branch);
        setCommits(cList);
      } else if (activeTab === 'issues' && issues.length === 0) {
        const { issues: iList, prs: pList } =
          await GitHubApiService.getIssuesAndPRs(owner, name);
        setIssues(iList);
        setPrs(pList);
      } else if (activeTab === 'actions' && workflowRuns.length === 0) {
        const runs = await GitHubApiService.getWorkflowRuns(owner, name);
        setWorkflowRuns(runs);
      } else if (activeTab === 'releases' && releases.length === 0) {
        const rels = await GitHubApiService.getRepoReleases(owner, name);
        setReleases(rels);
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
      const cList = await GitHubApiService.getRepoCommits(owner, name, branchName);
      setCommits(cList);
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
      color: LANGUAGE_COLORS[lang] || Colors.primary,
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
                <ActivityIndicator size="small" color={Colors.primary} />
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
                      LANGUAGE_COLORS[repo.language] || Colors.primary,
                  },
                ]}
              />
              <Text style={styles.statValue}>{repo.language}</Text>
            </View>
          )}
        </View>

        {/* Scrollable Tab Bar */}
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
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentPadding}
          >
            {/* README TAB */}
            {activeTab === 'readme' && (
              <View style={styles.readmeCard}>
                <View style={styles.readmeHeader}>
                  <Text style={styles.readmeHeaderTitle}>📖 README.md</Text>
                </View>
                <Text style={styles.readmeBody}>
                  {readmeContent || 'No README.md found in this repository.'}
                </Text>
              </View>
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

            {/* COMMITS TAB */}
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
                        {selectedCommit.commit.author.name} ·{' '}
                        {new Date(
                          selectedCommit.commit.author.date
                        ).toLocaleDateString()}
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
                  commits.map((c) => (
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
                          {new Date(c.commit.author.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.commitMessage} numberOfLines={2}>
                        {c.commit.message}
                      </Text>
                      <Text style={styles.commitAuthorLine}>
                        by {c.commit.author.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No commits found in branch "{selectedBranch}".
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ISSUES & PRs TAB */}
            {activeTab === 'issues' && (
              <View style={styles.issuesContainer}>
                {/* Sub filter */}
                <View style={styles.issueFilterRow}>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'all' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('all')}
                  >
                    <Text style={styles.filterChipText}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'open' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('open')}
                  >
                    <Text style={styles.filterChipText}>Open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      issueFilter === 'closed' && styles.filterChipActive,
                    ]}
                    onPress={() => setIssueFilter('closed')}
                  >
                    <Text style={styles.filterChipText}>Closed</Text>
                  </TouchableOpacity>
                </View>

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
                            {new Date(p.created_at).toLocaleDateString()}
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
                            {new Date(i.created_at).toLocaleDateString()}
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
              </View>
            )}

            {/* ACTIONS CI TAB */}
            {activeTab === 'actions' && (
              <View style={styles.actionsContainer}>
                {workflowRuns.length > 0 ? (
                  workflowRuns.map((r) => (
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
                          {new Date(r.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyDetailText}>
                      No GitHub Actions workflow runs found for this repository.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* RELEASES & ASSETS TAB */}
            {activeTab === 'releases' && (
              <View style={styles.releasesContainer}>
                {releases.length > 0 ? (
                  releases.map((rel) => (
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
                          {new Date(rel.published_at).toLocaleDateString()}
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
                  ))
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  repoOwner: {
    fontSize: 12,
    color: Colors.textMuted,
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
    backgroundColor: Colors.cardElevated,
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
    borderBottomColor: Colors.cardBorder,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  branchPill: {
    maxWidth: 130,
    backgroundColor: Colors.cardElevated,
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.cyan,
    marginRight: 4,
  },
  dropdownCaret: {
    fontSize: 10,
    color: Colors.cyan,
  },
  statIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  languageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  tabsScrollView: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundElevated,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.textPrimary,
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
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  readmeHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  readmeHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  readmeBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  codeContainer: {
    flex: 1,
  },
  treeContainer: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  treeUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundElevated,
  },
  treeUpText: {
    color: Colors.cyan,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  treeItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  treeIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  treeItemName: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  treeItemSize: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  fileViewer: {
    backgroundColor: Colors.codeBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.codeBorder,
    overflow: 'hidden',
  },
  fileViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  fileSizeText: {
    fontSize: 12,
    color: Colors.textMuted,
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
    color: Colors.codeLineNumber,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'right',
    marginRight: 12,
  },
  codeLineText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  commitsContainer: {
    gap: 12,
  },
  commitItem: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commitShaBadge: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.cyan,
    backgroundColor: Colors.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  commitDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  commitMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  commitAuthorLine: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commitDetailCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commitDetailMsg: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    color: Colors.primary,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  commitAuthor: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  diffStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  diffAdd: {
    color: Colors.emerald,
    fontSize: 13,
    fontWeight: '700',
  },
  diffDel: {
    color: Colors.ruby,
    fontSize: 13,
    fontWeight: '700',
  },
  diffTotal: {
    color: Colors.textMuted,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  issueCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  issueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stateBadgePR: {
    backgroundColor: Colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateBadgeIssue: {
    backgroundColor: Colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateBadgeClosed: {
    backgroundColor: Colors.rubyMuted,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  issueDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  issueBody: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    color: Colors.textPrimary,
  },
  runNumber: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: Colors.cyan,
  },
  workflowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  workflowBranch: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  workflowSha: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: Colors.primary,
  },
  workflowDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  releasesContainer: {
    gap: 14,
  },
  releaseCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: Colors.cyanMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.cyan,
  },
  prereleaseBadge: {
    backgroundColor: Colors.rubyMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prereleaseText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ruby,
  },
  releaseDate: {
    fontSize: 11,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  releaseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  releaseBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  assetsSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 8,
  },
  assetsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  assetIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  assetName: {
    flex: 1,
    fontSize: 12,
    color: Colors.cyan,
    fontWeight: '600',
  },
  assetSize: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  insightsContainer: {
    gap: 16,
  },
  insightSectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  langBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: Colors.cardElevated,
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
    color: Colors.textPrimary,
    marginRight: 4,
  },
  langLegendPercent: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  rankBadge: {
    width: 28,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  contributorName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contributorCountBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contributorCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
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
  emptyDetailText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 12,
    color: Colors.textMuted,
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
    backgroundColor: Colors.card,
    borderRadius: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  branchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  branchModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  branchModalClose: {
    padding: 4,
  },
  branchModalCloseText: {
    color: Colors.textMuted,
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
    backgroundColor: Colors.cardElevated,
  },
  branchItemIcon: {
    fontSize: 14,
    marginRight: 10,
  },
  branchItemText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  branchItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  protectedBadge: {
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginRight: 8,
  },
  protectedText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  checkIcon: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
