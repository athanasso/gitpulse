import React, { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemePalette, Spacing } from '../constants/theme';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import { ContributionDay } from '../types/github';

interface ContributionHeatmapProps {
  days: ContributionDay[];
  total: number;
}

export const ContributionHeatmap: React.FC<ContributionHeatmapProps> = ({
  days,
  total,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedDay, setSelectedDay] = useState<ContributionDay | null>(null);

  // Chunk days into weeks of 7 days (columns)
  const weeks: ContributionDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Calculate current & longest streak
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < days.length; i++) {
    if (days[i].count > 0) {
      tempStreak += 1;
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Check from today backwards for current streak
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const getDayColor = (level: number) => {
    switch (level) {
      case 1:
        return colors.heat1;
      case 2:
        return colors.heat2;
      case 3:
        return colors.heat3;
      case 4:
        return colors.heat4;
      default:
        return colors.heat0;
    }
  };

  if (days.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyHeatmap}>
          <Text style={styles.emptyHeatmapText}>
            No public contribution data available for this user.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{total}</Text>
          <Text style={styles.metricLabel}>Contributions</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.emerald }]}>
            {currentStreak}d
          </Text>
          <Text style={styles.metricLabel}>Current Streak</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: colors.gold }]}>
            {maxStreak}d
          </Text>
          <Text style={styles.metricLabel}>Longest Streak</Text>
        </View>
      </View>

      {/* Selected Day Toast */}
      <View style={styles.selectedDayBar}>
        <Text style={styles.selectedDayText}>
          {selectedDay
            ? `${selectedDay.count} contribution${
                selectedDay.count === 1 ? '' : 's'
              } on ${selectedDay.date}`
            : 'Tap any cell in the 52-week matrix'}
        </Text>
      </View>

      {/* 52-Week Horizontal Scrollable Matrix */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.matrixScroll}
      >
        <View style={styles.matrixContainer}>
          {weeks.map((week, wIdx) => (
            <View key={wIdx} style={styles.weekColumn}>
              {week.map((d, dIdx) => (
                <TouchableOpacity
                  key={dIdx}
                  style={[
                    styles.cell,
                    { backgroundColor: getDayColor(d.level) },
                    selectedDay?.date === d.date && styles.cellSelected,
                  ]}
                  onPress={() => setSelectedDay(d)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Heatmap Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Less</Text>
        <View style={[styles.legendCell, { backgroundColor: colors.heat0 }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.heat1 }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.heat2 }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.heat3 }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.heat4 }]} />
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemePalette) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedDayBar: {
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  selectedDayText: {
    fontSize: 12,
    color: colors.cyan,
    fontWeight: '600',
  },
  matrixScroll: {
    paddingVertical: 4,
  },
  matrixContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  weekColumn: {
    flexDirection: 'column',
    gap: 3,
  },
  cell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  emptyHeatmap: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeatmapText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

