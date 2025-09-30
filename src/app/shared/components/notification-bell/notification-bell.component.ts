// src/app/shared/components/notification-bell/notification-bell.component.ts

import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms'; // ✅ NEW: เพิ่ม FormsModule
import { Subscription } from 'rxjs';

// ✅ Import Services
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

// ✅ Import Models
import {
  DisplayNotification,
  NotificationSummary,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  getNotificationTypeLabel,
  getNotificationPriorityLabel
} from '../../models/notification.model';

// ✅ Import Permission Models
import { permissionEnum, UserRole, ROLES } from '../../models/permission.model';

/**
 * ✅ Notification Bell Component
 * แสดง notification icon พร้อม dropdown menu
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule  // ✅ NEW: เพิ่ม FormsModule
  ],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  // ===== DEPENDENCY INJECTION ===== ✅
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // ===== COMPONENT STATE ===== ✅
  notifications: DisplayNotification[] = [];
  unreadCount = 0;
  summary: NotificationSummary | null = null;
  isDropdownOpen = false;
  isLoading = false;
  error: string | null = null;

  // ===== FILTER STATE ===== ✅
  selectedFilter: 'all' | 'unread' | 'today' = 'all';
  selectedType: NotificationType | 'all' = 'all';

  // ===== SUBSCRIPTIONS ===== ✅
  private subscriptions: Subscription[] = [];

  // ===== ENUMS FOR TEMPLATE ===== ✅
  readonly NotificationType = NotificationType;
  readonly NotificationStatus = NotificationStatus;
  readonly NotificationPriority = NotificationPriority;
  readonly ROLES = ROLES;

  // ===== CURRENT LANGUAGE ===== ✅
  currentLanguage: 'th' | 'en' = 'th';

  // ===== LIFECYCLE HOOKS ===== ✅

  ngOnInit(): void {
    console.log('🔔 NotificationBellComponent initialized');
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    console.log('🔔 NotificationBellComponent destroyed');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== INITIALIZATION ===== ✅

  private initializeComponent(): void {
    // โหลด language preference
    this.loadLanguagePreference();

    // Subscribe to notifications
    this.subscribeToNotifications();

    // Subscribe to unread count
    this.subscribeToUnreadCount();

    // Subscribe to summary
    this.subscribeToSummary();

    // Subscribe to loading state
    this.subscribeToLoading();

    // Subscribe to error state
    this.subscribeToError();

    // โหลด notifications ครั้งแรก
    this.loadNotifications();
  }

  /**
   * โหลด language preference
   */
  private loadLanguagePreference(): void {
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'th') {
      this.currentLanguage = saved;
    }

    // Listen for language changes
    window.addEventListener('language-changed', (event: any) => {
      this.currentLanguage = event.detail.language;
    });
  }

  /**
   * Subscribe to notifications
   */
  private subscribeToNotifications(): void {
    const sub = this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications.map(n => ({
        ...n,
        timeAgo: this.formatTimeAgo(n.created_at),
        icon: this.getNotificationIcon(n.notification_type),
        color: this.getNotificationColor(n.notification_type),
        route: `/tickets/${n.ticket_no}`
      }));

      console.log('🔔 Notifications updated:', this.notifications.length);
    });

    this.subscriptions.push(sub);
  }

  /**
   * Subscribe to unread count
   */
  private subscribeToUnreadCount(): void {
    const sub = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
      console.log('🔔 Unread count:', count);
    });

    this.subscriptions.push(sub);
  }

  /**
   * Subscribe to summary
   */
  private subscribeToSummary(): void {
    const sub = this.notificationService.summary$.subscribe(summary => {
      this.summary = summary;
    });

    this.subscriptions.push(sub);
  }

  /**
   * Subscribe to loading state
   */
  private subscribeToLoading(): void {
    const sub = this.notificationService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });

    this.subscriptions.push(sub);
  }

  /**
   * Subscribe to error state
   */
  private subscribeToError(): void {
    const sub = this.notificationService.error$.subscribe(error => {
      this.error = error;
    });

    this.subscriptions.push(sub);
  }

  // ===== NOTIFICATION ACTIONS ===== ✅

  /**
   * โหลด notifications
   */
  loadNotifications(): void {
    this.notificationService.loadNotifications().subscribe({
      next: () => console.log('✅ Notifications loaded'),
      error: (error) => console.error('❌ Error loading notifications:', error)
    });
  }

  /**
   * Refresh notifications
   */
  refreshNotifications(): void {
    console.log('🔄 Refreshing notifications');
    this.loadNotifications();
  }

  /**
   * เปิด/ปิด dropdown
   */
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;

    if (this.isDropdownOpen) {
      console.log('🔔 Notification dropdown opened');
      // Refresh เมื่อเปิด dropdown
      this.refreshNotifications();
    }
  }

  /**
   * ปิด dropdown
   */
  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  /**
   * คลิกที่ notification
   */
  onNotificationClick(notification: DisplayNotification, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    console.log('🔔 Notification clicked:', notification.id);

    // ทำเครื่องหมายว่าอ่านแล้ว
    if (notification.status === NotificationStatus.UNREAD) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }

    // ปิด dropdown
    this.closeDropdown();

    // Navigate to ticket detail
    if (notification.route) {
      this.router.navigate([notification.route]);
    }
  }

  /**
   * ทำเครื่องหมายว่าอ่านแล้ว
   */
  markAsRead(notification: DisplayNotification, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    console.log('📖 Marking as read:', notification.id);

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => console.log('✅ Marked as read'),
      error: (error) => console.error('❌ Error marking as read:', error)
    });
  }

  /**
   * ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
   */
  markAllAsRead(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    console.log('📖 Marking all as read');

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        console.log('✅ All marked as read');
        this.closeDropdown();
      },
      error: (error) => console.error('❌ Error marking all as read:', error)
    });
  }

  /**
   * ลบ notification
   */
  deleteNotification(notification: DisplayNotification, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm(this.getText('Delete this notification?', 'ลบการแจ้งเตือนนี้?'))) {
      return;
    }

    console.log('🗑️ Deleting notification:', notification.id);

    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => console.log('✅ Notification deleted'),
      error: (error) => console.error('❌ Error deleting notification:', error)
    });
  }

  /**
   * ลบทั้งหมด
   */
  deleteAllNotifications(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm(this.getText('Delete all notifications?', 'ลบการแจ้งเตือนทั้งหมด?'))) {
      return;
    }

    console.log('🗑️ Deleting all notifications');

    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        console.log('✅ All notifications deleted');
        this.closeDropdown();
      },
      error: (error) => console.error('❌ Error deleting all notifications:', error)
    });
  }

  // ===== FILTER METHODS ===== ✅

  /**
   * เปลี่ยน filter
   */
  changeFilter(filter: 'all' | 'unread' | 'today'): void {
    this.selectedFilter = filter;
    console.log('🔍 Filter changed:', filter);
  }

  /**
   * เปลี่ยน type filter
   */
  changeTypeFilter(type: NotificationType | 'all'): void {
    this.selectedType = type;
    console.log('🔍 Type filter changed:', type);
  }

  /**
   * ได้รับ filtered notifications
   */
  getFilteredNotifications(): DisplayNotification[] {
    let filtered = [...this.notifications];

    // Filter by read status
    if (this.selectedFilter === 'unread') {
      filtered = filtered.filter(n => n.status === NotificationStatus.UNREAD);
    } else if (this.selectedFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(n => {
        const nDate = new Date(n.created_at);
        nDate.setHours(0, 0, 0, 0);
        return nDate.getTime() === today.getTime();
      });
    }

    // Filter by type
    if (this.selectedType !== 'all') {
      filtered = filtered.filter(n => n.notification_type === this.selectedType);
    }

    return filtered;
  }

  // ===== HELPER METHODS ===== ✅

  /**
   * ตรวจสอบว่ามี notifications หรือไม่
   */
  hasNotifications(): boolean {
    return this.notifications.length > 0;
  }

  /**
   * ตรวจสอบว่ามี unread notifications หรือไม่
   */
  hasUnreadNotifications(): boolean {
    return this.unreadCount > 0;
  }

  /**
   * ได้รับจำนวน notifications ตาม filter
   */
  getFilteredCount(): number {
    return this.getFilteredNotifications().length;
  }

  /**
   * Format time ago
   */
  formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) {
      return this.currentLanguage === 'th' ? 'เมื่อสักครู่' : 'Just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return this.currentLanguage === 'th' 
        ? `${minutes} นาทีที่แล้ว` 
        : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return this.currentLanguage === 'th' 
        ? `${hours} ชั่วโมงที่แล้ว` 
        : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return this.currentLanguage === 'th' 
      ? `${days} วันที่แล้ว` 
      : `${days} day${days > 1 ? 's' : ''} ago`;
  }

  /**
   * ได้รับ notification icon
   */
  getNotificationIcon(type: NotificationType): string {
    const icons: { [key in NotificationType]: string } = {
      [NotificationType.NEW_TICKET]: 'bi-plus-circle-fill',
      [NotificationType.STATUS_CHANGE]: 'bi-arrow-repeat',
      [NotificationType.ASSIGNMENT]: 'bi-person-check-fill',
      [NotificationType.COMMENT]: 'bi-chat-dots-fill',
      [NotificationType.MENTION]: 'bi-at',
      [NotificationType.RESOLVED]: 'bi-check-circle-fill',
      [NotificationType.CLOSED]: 'bi-x-circle-fill'
    };

    return icons[type];
  }

  /**
   * ได้รับ notification color
   */
  getNotificationColor(type: NotificationType): string {
    const colors: { [key in NotificationType]: string } = {
      [NotificationType.NEW_TICKET]: '#6c5ce7',
      [NotificationType.STATUS_CHANGE]: '#74b9ff',
      [NotificationType.ASSIGNMENT]: '#fdcb6e',
      [NotificationType.COMMENT]: '#00b894',
      [NotificationType.MENTION]: '#e17055',
      [NotificationType.RESOLVED]: '#00b894',
      [NotificationType.CLOSED]: '#636e72'
    };

    return colors[type];
  }

  /**
   * ได้รับ priority badge class
   */
  getPriorityBadgeClass(priority: NotificationPriority): string {
    const classes: { [key in NotificationPriority]: string } = {
      [NotificationPriority.LOW]: 'badge-success',
      [NotificationPriority.MEDIUM]: 'badge-info',
      [NotificationPriority.HIGH]: 'badge-warning',
      [NotificationPriority.URGENT]: 'badge-danger'
    };

    return classes[priority];
  }

  /**
   * ได้รับ notification type label
   */
  getNotificationTypeLabel(type: NotificationType): string {
    return getNotificationTypeLabel(type, this.currentLanguage);
  }

  /**
   * ได้รับ notification priority label
   */
  getNotificationPriorityLabel(priority: NotificationPriority): string {
    return getNotificationPriorityLabel(priority, this.currentLanguage);
  }

  /**
   * ได้รับข้อความตาม language
   */
  getText(en: string, th: string): string {
    return this.currentLanguage === 'th' ? th : en;
  }

  trackByNotificationId(index: number, notification: DisplayNotification): number {
    return notification.id;
  }

  /**
   * Truncate text
   */
  truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // ===== PERMISSION CHECKS ===== ✅

  /**
   * ตรวจสอบว่า user มีสิทธิ์ดู notifications หรือไม่
   */
  canViewNotifications(): boolean {
    // ตอนนี้อนุญาตให้ทุก role ดู notifications
    return this.authService.isAuthenticated();
  }

  /**
   * ตรวจสอบว่า user เป็น supporter/admin หรือไม่
   */
  isSupporterOrAdmin(): boolean {
    return this.authService.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  // ===== HOST LISTENER ===== ✅

  /**
   * ปิด dropdown เมื่อคลิกข้างนอก
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.notification-bell-container');

    if (!clickedInside && this.isDropdownOpen) {
      this.closeDropdown();
    }
  }

  /**
   * ป้องกันการปิด dropdown เมื่อคลิกภายใน
   */
  onDropdownClick(event: Event): void {
    event.stopPropagation();
  }

  // ===== NAVIGATION ===== ✅

  /**
   * Navigate to all notifications page
   */
  viewAllNotifications(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.closeDropdown();
    this.router.navigate(['/notifications']);
  }

  /**
   * Navigate to settings
   */
  openNotificationSettings(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.closeDropdown();
    this.router.navigate(['/settings/notifications']);
  }

  // ===== DEBUG METHODS ===== ✅

  /**
   * Debug component state
   */
  debugState(): void {
    console.group('🔔 Notification Bell Debug');
    console.log('Notifications:', this.notifications);
    console.log('Unread Count:', this.unreadCount);
    console.log('Summary:', this.summary);
    console.log('Filter:', this.selectedFilter);
    console.log('Type Filter:', this.selectedType);
    console.log('Filtered Count:', this.getFilteredCount());
    console.log('Is Dropdown Open:', this.isDropdownOpen);
    console.log('Is Loading:', this.isLoading);
    console.log('Error:', this.error);
    console.groupEnd();
  }
}