import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemePalette, Spacing } from '../constants/theme';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';


export interface PaginationControlProps {
  page: number;
  hasNext: boolean;
  hasPrev?: boolean;
  totalPages?: number;
  totalCount?: number;
  loading?: boolean;
  onPageChange: (newPage: number) => void;
  compact?: boolean;
}

export const PaginationControl: React.FC<PaginationControlProps> = ({
  page,
  hasNext,
  hasPrev = page > 1,
  totalPages,
  totalCount,
  loading = false,
  onPageChange,
  compact = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canGoPrev = hasPrev && !loading;
  const canGoNext = hasNext && !loading;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Previous Button */}
      <TouchableOpacity
        style={[styles.pageButton, !canGoPrev && styles.pageButtonDisabled]}
        onPress={() => {
          if (canGoPrev) onPageChange(page - 1);
        }}
        disabled={!canGoPrev}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.pageButtonText,
            !canGoPrev && styles.pageButtonTextDisabled,
          ]}
        >
          ◀ Prev
        </Text>
      </TouchableOpacity>

      {/* Page Info */}
      <View style={styles.infoBox}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.cyan} />
        ) : (
          <View style={styles.centerCol}>
            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>
                Page {page}
                {totalPages ? ` of ${totalPages}` : ''}
              </Text>
            </View>
            {totalCount !== undefined && totalCount > 0 ? (
              <Text style={styles.totalText}>{totalCount} total</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[styles.pageButton, !canGoNext && styles.pageButtonDisabled]}
        onPress={() => {
          if (canGoNext) onPageChange(page + 1);
        }}
        disabled={!canGoNext}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.pageButtonText,
            !canGoNext && styles.pageButtonTextDisabled,
          ]}
        >
          Next ▶
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginVertical: Spacing.md,
  },
  containerCompact: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 80,
  },
  pageButtonDisabled: {
    borderColor: colors.cardBorder,
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  pageButtonText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  pageButtonTextDisabled: {
    color: colors.textMuted,
  },
  infoBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  centerCol: {
    alignItems: 'center',
  },
  pageBadge: {
    backgroundColor: colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pageBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  totalText: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
