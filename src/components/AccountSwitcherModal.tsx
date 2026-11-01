import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountService } from '../services/AccountService';
import { GitService } from '../services/GitService';
import {
  GitAccount,
  GitProviderType,
  PROVIDER_REGISTRY,
} from '../types/provider';
import { ThemedDialog, DialogButton } from './ThemedDialog';

interface AccountSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  onAccountSwitched?: (account: GitAccount) => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  visible,
  onClose,
  onAccountSwitched,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [accounts, setAccounts] = useState<GitAccount[]>(() => AccountService.getAccounts());
  const [activeAccount, setActiveAccount] = useState<GitAccount | null>(() =>
    AccountService.getActiveAccount()
  );

  // Add Account Sub-View
  const [isAdding, setIsAdding] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<GitProviderType>('github');
  const [hostUrl, setHostUrl] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [validating, setValidating] = useState(false);

  // Themed Dialog
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
    setDialogConfig({ visible: true, ...config });
  };

  const hideDialog = () => {
    setDialogConfig((prev) => ({ ...prev, visible: false }));
  };

  const reloadData = () => {
    setAccounts(AccountService.getAccounts());
    setActiveAccount(AccountService.getActiveAccount());
  };

  const handleSwitchAccount = async (acc: GitAccount) => {
    if (activeAccount?.id === acc.id) {
      onClose();
      return;
    }
    await AccountService.setActiveAccount(acc.id);
    setActiveAccount(acc);
    onAccountSwitched?.(acc);
    onClose();
  };

  const handlePromptDeleteAccount = (acc: GitAccount) => {
    showDialog({
      title: 'Remove Account',
      message: `Are you sure you want to disconnect @${acc.username} (${PROVIDER_REGISTRY[acc.provider].name})?`,
      icon: '🗑️',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel', onPress: hideDialog },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            hideDialog();
            await AccountService.removeAccount(acc.id);
            reloadData();
          },
        },
      ],
    });
  };

  const handleConnectNewAccount = async () => {
    if (!tokenInput.trim()) {
      showDialog({
        title: 'Token Required',
        message: 'Please paste your access token or credentials.',
        icon: '⚠️',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'primary', onPress: hideDialog }],
      });
      return;
    }

    setValidating(true);
    try {
      const cleanHost = hostUrl.trim() || undefined;
      const user = await GitService.validateAccount(selectedProvider, tokenInput.trim(), cleanHost);

      const saved = await AccountService.addAccount({
        provider: selectedProvider,
        username: user.login,
        displayName: user.name || user.login,
        avatarUrl: user.avatar_url,
        token: tokenInput.trim(),
        hostUrl: cleanHost,
      });

      reloadData();
      setIsAdding(false);
      setTokenInput('');
      setHostUrl('');

      showDialog({
        title: 'Account Connected',
        message: `Successfully connected @${saved.username} on ${PROVIDER_REGISTRY[selectedProvider].name}!`,
        icon: '✅',
        type: 'success',
        buttons: [
          {
            text: 'Great!',
            style: 'success',
            onPress: () => {
              hideDialog();
              onAccountSwitched?.(saved);
              onClose();
            },
          },
        ],
      });
    } catch (err: any) {
      showDialog({
        title: 'Connection Failed',
        message: err.message || 'Could not validate account. Please verify token and URL.',
        icon: '❌',
        type: 'danger',
        buttons: [{ text: 'Retry', style: 'primary', onPress: hideDialog }],
      });
    } finally {
      setValidating(false);
    }
  };

  const currentProviderMeta = PROVIDER_REGISTRY[selectedProvider];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.background,
              borderColor: colors.cardBorder,
              paddingBottom: Math.max(insets.bottom, Spacing.md) + 4,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {isAdding ? '➕ Connect Account' : '👥 Accounts & Providers'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {isAdding
                  ? `Add a new ${currentProviderMeta.name} account`
                  : 'Switch active workspace or add another git forge'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (isAdding) setIsAdding(false);
                else onClose();
              }}
              style={[styles.closeBtn, { backgroundColor: colors.cardElevated }]}
            >
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {!isAdding ? (
            /* Accounts List View */
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.listContent}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                CONNECTED ACCOUNTS ({accounts.length})
              </Text>

              {accounts.map((acc) => {
                const meta = PROVIDER_REGISTRY[acc.provider];
                const isActive = activeAccount?.id === acc.id;

                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isActive ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => handleSwitchAccount(acc)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accountLeft}>
                      <View
                        style={[
                          styles.providerIconBadge,
                          { backgroundColor: colors.cardElevated },
                        ]}
                      >
                        <Text style={styles.providerEmoji}>{meta.icon}</Text>
                      </View>

                      <View style={styles.accountInfo}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.usernameText, { color: colors.textPrimary }]}>
                            @{acc.username}
                          </Text>
                          {isActive && (
                            <View
                              style={[
                                styles.activeBadge,
                                {
                                  backgroundColor: colors.emeraldMuted,
                                  borderColor: colors.emerald,
                                },
                              ]}
                            >
                              <Text style={[styles.activeBadgeText, { color: colors.emerald }]}>
                                ACTIVE
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.providerHostText, { color: colors.textMuted }]}>
                          {meta.name} {acc.hostUrl ? `• ${acc.hostUrl}` : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.accountRight}>
                      {accounts.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handlePromptDeleteAccount(acc)}
                          style={[styles.deleteBtn, { backgroundColor: colors.cardElevated }]}
                        >
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[
                  styles.addAccountBtn,
                  { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder },
                ]}
                onPress={() => setIsAdding(true)}
              >
                <Text style={[styles.addAccountBtnText, { color: colors.primary }]}>
                  + Connect Another Git Provider
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Add Account Form View */
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.formContent}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                SELECT GIT PROVIDER
              </Text>
              <View style={styles.providerTabsRow}>
                {(['github', 'gitlab', 'gitea', 'bitbucket'] as GitProviderType[]).map((pType) => {
                  const meta = PROVIDER_REGISTRY[pType];
                  const isSelected = selectedProvider === pType;
                  return (
                    <TouchableOpacity
                      key={pType}
                      style={[
                        styles.providerPill,
                        {
                          backgroundColor: isSelected ? colors.primaryMuted : colors.card,
                          borderColor: isSelected ? colors.primary : colors.cardBorder,
                        },
                      ]}
                      onPress={() => setSelectedProvider(pType)}
                    >
                      <Text style={styles.providerPillIcon}>{meta.icon}</Text>
                      <Text
                        style={[
                          styles.providerPillText,
                          { color: isSelected ? colors.primary : colors.textMuted },
                        ]}
                      >
                        {meta.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {currentProviderMeta.allowCustomHost && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    SERVER HOST URL (OPTIONAL FOR SELF-HOSTED)
                  </Text>
                  <TextInput
                    style={[
                      styles.inputField,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder={currentProviderMeta.defaultHost}
                    placeholderTextColor={colors.textMuted}
                    value={hostUrl}
                    onChangeText={setHostUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.labelWithHelper}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    PERSONAL ACCESS TOKEN / CREDENTIALS
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(currentProviderMeta.tokenDocsUrl)}
                  >
                    <Text style={[styles.helperLink, { color: colors.primary }]}>
                      Get Token ↗
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.inputField,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder={currentProviderMeta.tokenPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder },
                  ]}
                  onPress={() => setIsAdding(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                  onPress={handleConnectNewAccount}
                  disabled={validating}
                >
                  {validating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Verify & Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <ThemedDialog
        visible={dialogConfig.visible}
        title={dialogConfig.title}
        message={dialogConfig.message}
        icon={dialogConfig.icon}
        type={dialogConfig.type}
        buttons={dialogConfig.buttons}
        onClose={hideDialog}
      />
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
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
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
    fontSize: 14,
    fontWeight: '700',
  },
  scrollList: {
    paddingHorizontal: Spacing.lg,
  },
  listContent: {
    paddingVertical: Spacing.lg,
    gap: 12,
  },
  formContent: {
    paddingVertical: Spacing.lg,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  providerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerEmoji: {
    fontSize: 20,
  },
  accountInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usernameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  providerHostText: {
    fontSize: 12,
    marginTop: 2,
  },
  accountRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
  },
  addAccountBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  addAccountBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  labelWithHelper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  providerTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  providerPillIcon: {
    fontSize: 14,
  },
  providerPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

