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
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';
import {
  GitHubRepo,
  GitHubFileItem,
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubWorkflowRun,
} from '../types/github';
import { GitHubApiService } from '../services/GitHubApiService';

interface RepoDetailModalProps {
  visible: boolean;
  repo: GitHubRepo | null;
  onClose: () => void;
}

type RepoTab = 'readme' | 'code' | 'commits' | 'issues' | 'actions';

export const RepoDetailModal: React.FC<RepoDetailModalProps> = ({
  visible,
  repo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<RepoTab>('readme');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (visible && repo) {
      loadTabData();
    }
  }, [visible, repo, activeTab]);

  const loadTabData = async () => {
    if (!repo) return;
    setLoading(true);

    try {
      const [owner, name] = repo.full_name.split('/');

      if (activeTab === 'readme' && !readmeContent) {
        const md = await GitHubApiService.getRepoReadme(owner, name);
        setReadmeContent(md);
      } else if (activeTab === 'code' && fileTree.length === 0) {
        const tree = await GitHubApiService.getRepoTree(owner, name, currentPath);
        setFileTree(tree);
      } else if (activeTab === 'commits' && commits.length === 0) {
        const cList = await GitHubApiService.getRepoCommits(owner, name);
        setCommits(cList);
      } else if (activeTab === 'issues' && issues.length === 0) {
        const { issues: iList, prs: pList } =
          await GitHubApiService.getIssuesAndPRs(owner, name);
        setIssues(iList);
        setPrs(pList);
      } else if (activeTab === 'actions' && workflowRuns.length === 0) {
        const runs = await GitHubApiService.getWorkflowRuns(owner, name);
        setWorkflowRuns(runs);
      }
    } catch (e) {
      console.warn('Error loading repo tab', e);
    } finally {
      setLoading(false);
    }
  };

  const navigateToDirectory = async (dirPath: string) => {
    if (!repo) return;
    setLoading(true);
    setCurrentPath(dirPath);
    setViewingFile(null);

    const [owner, name] = repo.full_name.split('/');
    const tree = await GitHubApiService.getRepoTree(owner, name, dirPath);
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
    const content = await GitHubApiService.getFileContent(owner, name, item.path);
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

          <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
            <Text style={styles.actionIcon}>🔗</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Pill Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statPill}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statValue}>{repo.stargazers_count}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statIcon}>🍴</Text>
            <Text style={styles.statValue}>{repo.forks_count}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statIcon}>🌿</Text>
            <Text style={styles.statValue}>{repo.default_branch}</Text>
          </View>
          {repo.language && (
            <View style={styles.statPill}>
              <View
                style={[
                  styles.languageDot,
                  {
                    backgroundColor:
                      repo.language === 'TypeScript'
                        ? '#3178C6'
                        : repo.language === 'JavaScript'
                        ? '#F7DF1E'
                        : repo.language === 'Python'
                        ? '#3572A5'
                        : Colors.primary,
                  },
                ]}
              />
              <Text style={styles.statValue}>{repo.language}</Text>
            </View>
          )}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabsRow}>
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
        </View>

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
                <Text style={styles.readmeBody}>{readmeContent}</Text>
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
                        <Text style={styles.backButtonText}>← {viewingFile.name}</Text>
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
                        {fileContent.split('\n').map((line, idx) => (
                          <View key={idx} style={styles.codeLineRow}>
                            <Text style={styles.codeLineNumber}>{idx + 1}</Text>
                            <Text style={styles.codeLineText}>{line || ' '}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : (
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
                ) : (
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
                {prs
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
                  ))}

                {/* Issues Section */}
                <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>
                  Issues ({issues.length})
                </Text>
                {issues
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
                  ))}
              </View>
            )}

            {/* ACTIONS CI TAB */}
            {activeTab === 'actions' && (
              <View style={styles.actionsContainer}>
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
                        {new Date(r.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
  },
  statsBar: {
    flexDirection: 'row',
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundElevated,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
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
    marginBottom: 6,
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
});
