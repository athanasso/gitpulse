import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing } from '../constants/theme';

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
          <ActivityIndicator size="small" color={Colors.cyan} />
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: Colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 80,
  },
  pageButtonDisabled: {
    borderColor: Colors.cardBorder,
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  pageButtonText: {
    color: Colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  pageButtonTextDisabled: {
    color: Colors.textMuted,
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
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pageBadgeText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  totalText: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});

