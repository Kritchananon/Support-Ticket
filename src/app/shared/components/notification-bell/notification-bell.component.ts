// src/app/shared/components/notification-bell/notification-bell.component.ts

import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
 * ✅ Notification Bell Component with WebSocket Support
 * แสดง notification icon พร้อม dropdown menu
 * รองรับ Real-time updates ผ่าน WebSocket
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
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
  unreadCount = 0; // ✅ เริ่มต้นที่ 0 เสมอ
  summary: NotificationSummary | null = null;
  isDropdownOpen = false;
  isLoading = false;
  error: string | null = null;

  // ✅ WebSocket connection state
  socketConnectionState: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

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

    // Subscribe to notifications (จะได้รับ updates แบบ real-time ผ่าน WebSocket)
    this.subscribeToNotifications();

    // Subscribe to unread count
    this.subscribeToUnreadCount();

    // Subscribe to summary
    this.subscribeToSummary();

    // Subscribe to loading state
    this.subscribeToLoading();

    // Subscribe to error state
    this.subscribeToError();

    // ✅ Subscribe to WebSocket connection state
    this.subscribeToConnectionState();

    // ไม่จำเป็นต้องโหลด notifications ทันทีเพราะ:
    // 1. HeaderComponent จะเรียก connectSocket() ซึ่งจะโหลด notifications อัตโนมัติ
    // 2. Socket จะ emit notifications แบบ real-time
    // แต่ถ้าต้องการโหลดเพื่อแสดงข้อมูล cached ก็สามารถเรียกได้
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
   * จะได้รับ updates แบบ real-time จาก WebSocket
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

      console.log('🔔 Notifications updated (real-time):', this.notifications.length);
    });

    this.subscriptions.push(sub);
  }

  /**
   * ✅ FIXED: Subscribe to unread count with NaN protection
   * ป้องกันค่า NaN โดยการตรวจสอบและแปลงค่าให้ถูกต้อง
   */
  private subscribeToUnreadCount(): void {
    const sub = this.notificationService.unreadCount$.subscribe(count => {
      // ✅ ตรวจสอบและแปลงค่าให้เป็นตัวเลขที่ถูกต้อง
      const safeCount = this.getSafeNumber(count);
      this.unreadCount = safeCount;
      
      console.log('🔔 Unread count:', safeCount, '(original:', count, ')');
      
      // ✅ เพิ่มการเตือนถ้าได้รับค่าที่ไม่ถูกต้อง
      if (count !== safeCount) {
        console.warn('⚠️ Invalid unread count received:', count, '- converted to:', safeCount);
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * ✅ NEW: Helper method to safely convert value to number
   * แปลงค่าใดๆ เป็นตัวเลขที่ปลอดภัย โดยตั้งค่าเริ่มต้นเป็น 0 ถ้าไม่สามารถแปลงได้
   */
  private getSafeNumber(value: any): number {
    // ถ้าเป็น null หรือ undefined ให้คืนค่า 0
    if (value === null || value === undefined) {
      return 0;
    }

    // แปลงเป็น number
    const num = Number(value);

    // ตรวจสอบว่าเป็น NaN หรือไม่ (ใช้ Number.isNaN เพราะแม่นยำกว่า isNaN)
    if (Number.isNaN(num)) {
      return 0;
    }

    // ตรวจสอบว่าเป็นตัวเลขที่ถูกต้อง (ไม่ติดลบ และเป็นจำนวนเต็ม)
    if (!Number.isFinite(num) || num < 0) {
      return 0;
    }

    // คืนค่าเป็นจำนวนเต็มที่ปัดลง
    return Math.floor(num);
  }

  /**
   * Subscribe to summary
   */
  private subscribeToSummary(): void {
    const sub = this.notificationService.summary$.subscribe(summary => {
      this.summary = summary;
      
      // ✅ OPTIONAL: ตรวจสอบความสอดคล้องระหว่าง summary และ unreadCount
      if (summary && summary.unread !== undefined) {
        const safeSummaryUnread = this.getSafeNumber(summary.unread);
        if (safeSummaryUnread !== this.unreadCount) {
          console.log('📊 Summary unread:', safeSummaryUnread, 'vs unreadCount:', this.unreadCount);
        }
      }
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

  /**
   * ✅ Subscribe to WebSocket connection state
   */
  private subscribeToConnectionState(): void {
    const sub = this.notificationService.connectionState$.subscribe(state => {
      this.socketConnectionState = state;
      console.log('🔔 Socket connection state:', state);
    });

    this.subscriptions.push(sub);
  }

  // ===== NOTIFICATION ACTIONS ===== ✅

  /**
   * ✅ Refresh notifications จาก API (force reload)
   * ใช้เมื่อต้องการ refresh ข้อมูลใหม่จาก server
   */
  refreshNotifications(): void {
    console.log('🔄 Manually refreshing notifications from API');
    this.notificationService.fetchNotifications().subscribe({
      next: () => console.log('✅ Notifications refreshed from API'),
      error: (error) => console.error('❌ Error refreshing notifications:', error)
    });
  }

  /**
   * เปิด/ปิด dropdown
   */
  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;

    if (this.isDropdownOpen) {
      console.log('🔔 Notification dropdown opened');
      
      // ✅ Optional: refresh เมื่อเปิด dropdown (ถ้าต้องการ sync กับ server)
      // ถ้า WebSocket ทำงานดี ก็ไม่จำเป็นต้อง refresh ทุกครั้ง
      // แต่ถ้าต้องการความแน่ใจ 100% ว่าข้อมูลตรงกับ server ให้ uncomment บรรทัดด้านล่าง
      // this.refreshNotifications();
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
   * ลบ notification
   */
  deleteNotification(notification: DisplayNotification, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    console.log('🗑️ Deleting notification:', notification.id);

    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => console.log('✅ Notification deleted'),
      error: (error) => console.error('❌ Error deleting notification:', error)
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
      next: () => console.log('✅ All marked as read'),
      error: (error) => console.error('❌ Error marking all as read:', error)
    });
  }

  /**
   * ลบ notification ทั้งหมด
   */
  deleteAllNotifications(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm(this.getText(
      'Are you sure you want to delete all notifications?',
      'คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนทั้งหมด?'
    ))) {
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
   * ✅ IMPROVED: ตรวจสอบว่ามี unread notifications หรือไม่
   * เพิ่มการตรวจสอบเพิ่มเติมเพื่อความปลอดภัย
   */
  hasUnreadNotifications(): boolean {
    const safeCount = this.getSafeNumber(this.unreadCount);
    return safeCount > 0;
  }

  /**
   * ได้รับจำนวน notifications ตาม filter
   */
  getFilteredCount(): number {
    return this.getFilteredNotifications().length;
  }

  /**
   * ✅ ตรวจสอบสถานะการเชื่อมต่อ WebSocket
   */
  isSocketConnected(): boolean {
    return this.socketConnectionState === 'connected';
  }

  /**
   * ✅ ตรวจสอบว่ากำลังเชื่อมต่อหรือไม่
   */
  isSocketConnecting(): boolean {
    return this.socketConnectionState === 'connecting';
  }

  /**
   * ✅ รับข้อความแสดงสถานะการเชื่อมต่อ
   */
  getConnectionStatusText(): string {
    switch (this.socketConnectionState) {
      case 'connected':
        return this.getText('Live', 'สด');
      case 'connecting':
        return this.getText('Connecting...', 'กำลังเชื่อมต่อ...');
      case 'disconnected':
        return this.getText('Offline', 'ออฟไลน์');
      default:
        return '';
    }
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
   * ✅ UPDATED: ได้รับ notification icon (รองรับทั้ง enum และ string)
   */
  getNotificationIcon(type: NotificationType | string): string {
    const icons: { [key: string]: string } = {
      'NEW_TICKET': 'bi-plus-circle-fill',
      'new_ticket': 'bi-plus-circle-fill',
      'STATUS_CHANGE': 'bi-arrow-repeat',
      'status_change': 'bi-arrow-repeat',
      'ASSIGNMENT': 'bi-person-check-fill',
      'assignment': 'bi-person-check-fill',
      'COMMENT': 'bi-chat-dots-fill',
      'comment': 'bi-chat-dots-fill',
      'MENTION': 'bi-at',
      'mention': 'bi-at',
      'RESOLVED': 'bi-check-circle-fill',
      'resolved': 'bi-check-circle-fill',
      'CLOSED': 'bi-x-circle-fill',
      'closed': 'bi-x-circle-fill'
    };

    return icons[type] || 'bi-bell-fill'; // fallback icon
  }

  /**
   * ✅ UPDATED: ได้รับ notification color (รองรับทั้ง enum และ string)
   */
  getNotificationColor(type: NotificationType | string): string {
    const colors: { [key: string]: string } = {
      'NEW_TICKET': '#6c5ce7',
      'new_ticket': '#6c5ce7',
      'STATUS_CHANGE': '#74b9ff',
      'status_change': '#74b9ff',
      'ASSIGNMENT': '#fdcb6e',
      'assignment': '#fdcb6e',
      'COMMENT': '#00b894',
      'comment': '#00b894',
      'MENTION': '#e17055',
      'mention': '#e17055',
      'RESOLVED': '#00b894',
      'resolved': '#00b894',
      'CLOSED': '#636e72',
      'closed': '#636e72'
    };

    return colors[type] || '#6c5ce7'; // fallback color
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
   * ✅ UPDATED: ได้รับ notification type label (รองรับทั้ง enum และ string)
   */
  getNotificationTypeLabel(type: NotificationType | string): string {
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
    console.log('Unread Count:', this.unreadCount, '(safe:', this.getSafeNumber(this.unreadCount), ')');
    console.log('Summary:', this.summary);
    console.log('Filter:', this.selectedFilter);
    console.log('Type Filter:', this.selectedType);
    console.log('Filtered Count:', this.getFilteredCount());
    console.log('Is Dropdown Open:', this.isDropdownOpen);
    console.log('Is Loading:', this.isLoading);
    console.log('Socket Connection State:', this.socketConnectionState);
    console.log('Is Socket Connected:', this.isSocketConnected());
    console.log('Error:', this.error);
    console.groupEnd();
  }
}