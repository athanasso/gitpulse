import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive' | 'primary' | 'success';
  onPress?: () => void;
  loading?: boolean;
}

export interface ThemedDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  buttons?: DialogButton[];
  onClose?: () => void;
  dismissable?: boolean;
}

export const ThemedDialog: React.FC<ThemedDialogProps> = ({
  visible,
  title,
  message,
  icon,
  type = 'info',
  buttons = [{ text: 'OK', style: 'primary' }],
  onClose,
  dismissable = true,
}) => {
  const { colors } = useTheme();

  const getBadgeStyle = () => {
    switch (type) {
      case 'danger':
        return {
          bg: colors.rubyMuted,
          border: colors.ruby,
          defaultIcon: '🛑',
        };
      case 'warning':
        return {
          bg: colors.goldMuted,
          border: colors.gold,
          defaultIcon: '⚠️',
        };
      case 'success':
        return {
          bg: colors.emeraldMuted,
          border: colors.emerald,
          defaultIcon: '✅',
        };
      default:
        return {
          bg: colors.primaryMuted,
          border: colors.primary,
          defaultIcon: 'ℹ️',
        };
    }
  };

  const badge = getBadgeStyle();
  const displayIcon = icon || badge.defaultIcon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissable && onClose) onClose();
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (dismissable && onClose) onClose();
        }}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              {/* Type Icon Badge */}
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: badge.bg, borderColor: badge.border },
                ]}
              >
                <Text style={styles.iconText}>{displayIcon}</Text>
              </View>

              {/* Title & Message */}
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>
              {message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonsContainer,
                  buttons.length > 2 && styles.buttonsStacked,
                ]}
              >
                {buttons.map((btn, idx) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';
                  const isSuccess = btn.style === 'success';

                  let btnBg = colors.primary;
                  let textColor = '#FFFFFF';
                  let borderWidth = 0;
                  let borderColor = 'transparent';

                  if (isCancel) {
                    btnBg = colors.cardElevated;
                    textColor = colors.textSecondary;
                    borderWidth = 1;
                    borderColor = colors.cardBorder;
                  } else if (isDestructive) {
                    btnBg = colors.ruby;
                    textColor = '#FFFFFF';
                  } else if (isSuccess) {
                    btnBg = colors.emerald;
                    textColor = '#FFFFFF';
                  }

                  return (
                    <TouchableOpacity
                      key={`dialog-btn-${idx}`}
                      style={[
                        styles.btnBase,
                        {
                          backgroundColor: btnBg,
                          borderWidth,
                          borderColor,
                        },
                        buttons.length === 2 && styles.btnHalf,
                      ]}
                      onPress={() => {
                        if (btn.onPress) {
                          btn.onPress();
                        } else if (onClose) {
                          onClose();
                        }
                      }}
                      activeOpacity={0.7}
                      disabled={btn.loading}
                    >
                      {btn.loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={[styles.btnTextBase, { color: textColor }]}>
                          {btn.text}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    justifyContent: 'center',
  },
  buttonsStacked: {
    flexDirection: 'column',
  },
  btnBase: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnHalf: {
    flex: 1,
  },
  btnTextBase: {
    fontSize: 14,
    fontWeight: '700',
  },
});
