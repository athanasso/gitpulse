/**
 * Date and time formatting utilities for GitPulse.
 * All functions format into the user's local timezone.
 */

/**
 * Format an ISO timestamp to local date and time.
 * E.g., "Oct 31, 4:05 PM" or "Oct 31, 2025, 16:05" (depending on device locale).
 */
export const formatLocalDateTime = (
  isoString?: string | null,
  options?: { includeYear?: boolean }
): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isCurrentYear = d.getFullYear() === now.getFullYear();
  const includeYear = options?.includeYear ?? !isCurrentYear;

  const datePart = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: includeYear ? 'numeric' : undefined,
  });

  const timePart = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${datePart}, ${timePart}`;
};

/**
 * Format repository updated/pushed timestamp with local time.
 * - Under 1 hour: "15m ago (16:05)"
 * - Today: "3h ago (16:05)"
 * - Yesterday: "yesterday (18:20)"
 * - Older: "Oct 25, 14:30" (or "Oct 25, 2024, 14:30")
 */
export const formatRepoTimestamp = (isoString?: string | null): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  const timePart = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffMins < 1) {
    return `just now (${timePart})`;
  }
  if (diffMins < 60) {
    return `${diffMins}m ago (${timePart})`;
  }
  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return `${diffHours}h ago (${timePart})`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return `yesterday (${timePart})`;
  }

  const isCurrentYear = d.getFullYear() === now.getFullYear();
  const datePart = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
  });

  return `${datePart}, ${timePart}`;
};

