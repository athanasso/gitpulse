import { GitHubApiService } from './GitHubApiService';

type NotificationCountListener = (count: number) => void;

class NotificationServiceClass {
  private unreadCount: number = 0;
  private listeners: Set<NotificationCountListener> = new Set();

  getUnreadCount(): number {
    return this.unreadCount;
  }

  setUnreadCount(count: number): void {
    this.unreadCount = Math.max(0, count);
    this.notify();
  }

  decrement(by: number = 1): void {
    this.unreadCount = Math.max(0, this.unreadCount - by);
    this.notify();
  }

  clear(): void {
    this.unreadCount = 0;
    this.notify();
  }

  async refresh(): Promise<number> {
    try {
      const auth = await GitHubApiService.init();
      if (!auth) {
        this.clear();
        return 0;
      }
      const notifs = await GitHubApiService.getNotifications(1, 50);
      const count = notifs.filter((n) => n.unread).length;
      this.setUnreadCount(count);
      return count;
    } catch {
      return this.unreadCount;
    }
  }

  subscribe(listener: NotificationCountListener): () => void {
    this.listeners.add(listener);
    listener(this.unreadCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.unreadCount);
    }
  }
}

export const NotificationService = new NotificationServiceClass();

