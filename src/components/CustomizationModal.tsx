import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Spacing, ThemeId } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  useCustomization,
  PROFILE_SECTIONS_META,
  ProfileSectionId,
} from '../context/CustomizationContext';

interface CustomizationModalProps {
  visible: boolean;
  onClose: () => void;
}

type SettingsTab = 'themes' | 'profile' | 'repos' | 'details';

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, themeId, setThemeId, availableThemes } = useTheme();
  const {
    settings,
    updateSettings,
    moveProfileSection,
    toggleProfileSection,
    resetToDefaults,
  } = useCustomization();

  const [activeTab, setActiveTab] = useState<SettingsTab>('themes');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                ⚙️ Customization & Themes
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Personalize themes, layouts & default screens
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.cardElevated }]}
            >
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Sub-Tabs Nav */}
          <View style={[styles.tabsBar, { borderBottomColor: colors.cardBorder, backgroundColor: colors.cardElevated }]}>
            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'themes' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('themes')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'themes' ? colors.primary : colors.textMuted },
                ]}
              >
                🎨 Themes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'profile' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('profile')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'profile' ? colors.primary : colors.textMuted },
                ]}
              >
                👤 Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'repos' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('repos')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'repos' ? colors.primary : colors.textMuted },
                ]}
              >
                📦 Repos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabItem,
                activeTab === 'details' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab('details')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'details' ? colors.primary : colors.textMuted },
                ]}
              >
                🛠️ Detail
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* THEMES TAB */}
            {activeTab === 'themes' && (
              <View style={styles.sectionGroup}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Select Color Theme
                </Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                  All backgrounds, cards, syntax colors, badges, and pop-ups instantly update.
                </Text>

                <View style={styles.themesGrid}>
                  {availableThemes.map((t) => {
                    const isSelected = themeId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.themeCard,
                          {
                            backgroundColor: t.colors.card,
                            borderColor: isSelected ? t.colors.primary : t.colors.cardBorder,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        onPress={() => setThemeId(t.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.themeCardTop}>
                          <Text style={[styles.themeCardName, { color: t.colors.textPrimary }]}>
                            {t.name}
                          </Text>
                          {isSelected && (
                            <View style={[styles.activePill, { backgroundColor: t.colors.primary }]}>
                              <Text style={styles.activePillText}>✓ Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.themeCardTagline, { color: t.colors.textSecondary }]}>
                          {t.tagline}
                        </Text>

                        {/* Swatch Previews */}
                        <View style={styles.swatchRow}>
                          <View
                            style={[
                              styles.swatch,
                              { backgroundColor: t.colors.background, borderColor: t.colors.cardBorder },
                            ]}
                          />
                          <View
                            style={[
                              styles.swatch,
                              { backgroundColor: t.colors.cardElevated, borderColor: t.colors.cardBorder },
                            ]}
                          />
                          <View style={[styles.swatch, { backgroundColor: t.colors.primary }]} />
                          <View style={[styles.swatch, { backgroundColor: t.colors.cyan }]} />
                          <View style={[styles.swatch, { backgroundColor: t.colors.emerald }]} />
                          <View style={[styles.swatch, { backgroundColor: t.colors.ruby }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* PROFILE LAYOUT TAB */}
            {activeTab === 'profile' && (
              <View style={styles.sectionGroup}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Modular Profile Sections Reordering
                </Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                  Use ▲ / ▼ buttons to move sections up or down. Toggle checkbox to show or hide.
                </Text>

                <View style={styles.reorderList}>
                  {settings.profileSectionOrder.map((sectionId, idx) => {
                    const meta = PROFILE_SECTIONS_META[sectionId];
                    const isVisible = settings.profileSectionVisibility[sectionId];
                    const isFirst = idx === 0;
                    const isLast = idx === settings.profileSectionOrder.length - 1;

                    return (
                      <View
                        key={sectionId}
                        style={[
                          styles.reorderItem,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.cardBorder,
                            opacity: isVisible ? 1 : 0.6,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.reorderToggleBtn}
                          onPress={() => toggleProfileSection(sectionId)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              {
                                backgroundColor: isVisible ? colors.primary : 'transparent',
                                borderColor: isVisible ? colors.primary : colors.cardBorder,
                              },
                            ]}
                          >
                            {isVisible && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                        </TouchableOpacity>

                        <View style={styles.reorderTextWrap}>
                          <Text style={[styles.reorderItemTitle, { color: colors.textPrimary }]}>
                            {meta.icon} {meta.title}
                          </Text>
                          <Text style={[styles.reorderItemDesc, { color: colors.textSecondary }]}>
                            {meta.desc}
                          </Text>
                        </View>

                        {/* Up / Down Controls */}
                        <View style={styles.reorderControls}>
                          <TouchableOpacity
                            style={[
                              styles.moveBtn,
                              { backgroundColor: colors.cardElevated },
                              isFirst && styles.moveBtnDisabled,
                            ]}
                            disabled={isFirst}
                            onPress={() => moveProfileSection(sectionId, 'up')}
                          >
                            <Text style={[styles.moveBtnText, { color: isFirst ? colors.textMuted : colors.textPrimary }]}>
                              ▲
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.moveBtn,
                              { backgroundColor: colors.cardElevated },
                              isLast && styles.moveBtnDisabled,
                            ]}
                            disabled={isLast}
                            onPress={() => moveProfileSection(sectionId, 'down')}
                          >
                            <Text style={[styles.moveBtnText, { color: isLast ? colors.textMuted : colors.textPrimary }]}>
                              ▼
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Default Subtab */}
                <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>
                  Default Profile Sub-Tab
                </Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      { id: 'repos', label: 'Repositories' },
                      { id: 'starred', label: 'Starred' },
                      { id: 'gists', label: 'Gists' },
                      { id: 'activity', label: 'Activity' },
                      { id: 'orgs', label: 'Orgs' },
                      { id: 'social', label: 'Network' },
                    ] as const
                  ).map((st) => {
                    const isSelected = settings.defaultProfileSubTab === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => updateSettings({ defaultProfileSubTab: st.id })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* REPOSITORIES SCREEN DEFAULTS TAB */}
            {activeTab === 'repos' && (
              <View style={styles.sectionGroup}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Repositories Screen Layout & Defaults
                </Text>

                {/* Density */}
                <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>
                  Card Density
                </Text>
                <View style={styles.densityRow}>
                  <TouchableOpacity
                    style={[
                      styles.densityCard,
                      {
                        backgroundColor:
                          settings.repoCardDensity === 'detailed'
                            ? colors.cardElevated
                            : colors.card,
                        borderColor:
                          settings.repoCardDensity === 'detailed'
                            ? colors.primary
                            : colors.cardBorder,
                      },
                    ]}
                    onPress={() => updateSettings({ repoCardDensity: 'detailed' })}
                  >
                    <Text style={[styles.densityTitle, { color: colors.textPrimary }]}>
                      Detailed Cards
                    </Text>
                    <Text style={[styles.densityDesc, { color: colors.textSecondary }]}>
                      Show name, badges, description & full metadata
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.densityCard,
                      {
                        backgroundColor:
                          settings.repoCardDensity === 'compact'
                            ? colors.cardElevated
                            : colors.card,
                        borderColor:
                          settings.repoCardDensity === 'compact'
                            ? colors.primary
                            : colors.cardBorder,
                      },
                    ]}
                    onPress={() => updateSettings({ repoCardDensity: 'compact' })}
                  >
                    <Text style={[styles.densityTitle, { color: colors.textPrimary }]}>
                      Compact Mode
                    </Text>
                    <Text style={[styles.densityDesc, { color: colors.textSecondary }]}>
                      Hide descriptions for dense, fast scrolling
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Default Sort */}
                <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>
                  Default Sort Order
                </Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      { id: 'updated', label: '🕒 Recently Updated' },
                      { id: 'stars', label: '⭐ Most Stars' },
                      { id: 'forks', label: '🍴 Most Forks' },
                      { id: 'name', label: '🔤 Alphabetical' },
                    ] as const
                  ).map((s) => {
                    const isSelected = settings.defaultRepoSort === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => updateSettings({ defaultRepoSort: s.id })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Default Type Filter */}
                <Text style={[styles.subSectionTitle, { color: colors.textPrimary }]}>
                  Default Visibility Filter
                </Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'sources', label: 'Sources' },
                      { id: 'forks', label: 'Forks' },
                      { id: 'public', label: 'Public' },
                      { id: 'private', label: 'Private' },
                    ] as const
                  ).map((f) => {
                    const isSelected = settings.defaultRepoFilter === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => updateSettings({ defaultRepoFilter: f.id })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                          ]}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* DETAIL MODAL DEFAULTS TAB */}
            {activeTab === 'details' && (
              <View style={styles.sectionGroup}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Repository Detail Defaults
                </Text>
                <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                  Choose which tab opens immediately when you tap any repository card.
                </Text>

                <View style={styles.verticalOptionList}>
                  {(
                    [
                      { id: 'readme', label: '📖 README.md', desc: 'Read overview documentation first' },
                      { id: 'code', label: '📁 Code Tree', desc: 'Jump straight into files and folder browsing' },
                      { id: 'commits', label: '🌿 Commits History', desc: 'Inspect recent commits and changes' },
                      { id: 'issues', label: '🟢 Issues & PRs', desc: 'Review open discussions and pull requests' },
                      { id: 'actions', label: '⚡ GitHub Actions CI', desc: 'Monitor build runs and workflow statuses' },
                      { id: 'releases', label: '🏷️ Releases & Tags', desc: 'Inspect version release notes & tags' },
                      { id: 'insights', label: '📊 Insights & Stats', desc: 'Language breakdowns & contributors' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = settings.defaultRepoDetailTab === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: isSelected ? colors.cardElevated : colors.card,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                          },
                        ]}
                        onPress={() => updateSettings({ defaultRepoDetailTab: opt.id })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.optionRadio}>
                          <View
                            style={[
                              styles.radioCircle,
                              {
                                borderColor: isSelected ? colors.primary : colors.cardBorder,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.optionContent}>
                          <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                            {opt.label}
                          </Text>
                          <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                            {opt.desc}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* REPO DELETION / DANGER ZONE TOGGLE */}
                <View
                  style={[
                    styles.sectionGroup,
                    {
                      marginTop: 20,
                      paddingTop: 16,
                      borderTopWidth: 1,
                      borderTopColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: colors.ruby }]}>
                    ⚠️ Danger Zone (Repository Deletion)
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                    When enabled, an admin Danger Zone appears on repositories you own, allowing permanent deletion via GitHub API.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: settings.enableRepoDeletion ? colors.cardElevated : colors.card,
                        borderColor: settings.enableRepoDeletion ? colors.ruby : colors.cardBorder,
                        marginTop: 10,
                      },
                    ]}
                    onPress={() => updateSettings({ enableRepoDeletion: !settings.enableRepoDeletion })}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: settings.enableRepoDeletion ? colors.ruby : 'transparent',
                          borderColor: settings.enableRepoDeletion ? colors.ruby : colors.cardBorder,
                        },
                      ]}
                    >
                      {settings.enableRepoDeletion && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>
                        Allow repository deletion in Danger Zone
                      </Text>
                      <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                        {settings.enableRepoDeletion
                          ? 'Enabled: Safety confirmation modal will be available on your repos.'
                          : 'Disabled: Danger Zone is hidden to prevent accidental deletion.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={[styles.modalFooter, { borderTopColor: colors.cardBorder, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardElevated }]}
              onPress={resetToDefaults}
            >
              <Text style={[styles.resetBtnText, { color: colors.ruby }]}>Reset Defaults</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalScroll: {
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    paddingVertical: Spacing.lg,
    paddingBottom: 40,
  },
  sectionGroup: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  themesGrid: {
    gap: 12,
    marginTop: 6,
  },
  themeCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    gap: 8,
  },
  themeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeCardName: {
    fontSize: 16,
    fontWeight: '800',
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  themeCardTagline: {
    fontSize: 12,
    lineHeight: 16,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  reorderList: {
    gap: 10,
    marginTop: 6,
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  reorderToggleBtn: {
    padding: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reorderTextWrap: {
    flex: 1,
  },
  reorderItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  reorderItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 6,
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  moveBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  densityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  densityCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  densityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  densityDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  verticalOptionList: {
    gap: 8,
    marginTop: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
  },
  optionRadio: {
    padding: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
