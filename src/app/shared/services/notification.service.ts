// src/app/shared/services/notification.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, interval, timer } from 'rxjs';
import { catchError, tap, map, switchMap, filter, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

// ✅ Import models
import {
  AppNotification,
  NotificationPayload,
  NotificationResponse,
  NotificationSummary,
  NotificationQueryOptions,
  NotificationSettings,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  DisplayNotification,
  createDisplayNotification,
  DEFAULT_NOTIFICATION_SETTINGS
} from '../models/notification.model';

/**
 * ✅ Notification Service
 * จัดการ notification ทั้งหมดในระบบ
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  // ===== STATE MANAGEMENT ===== ✅

  // Notifications state
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  // Unread count state
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  // Summary state
  private summarySubject = new BehaviorSubject<NotificationSummary | null>(null);
  public summary$ = this.summarySubject.asObservable();

  // Settings state
  private settingsSubject = new BehaviorSubject<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  public settings$ = this.settingsSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Error state
  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // ===== CONFIGURATION ===== ✅

  private readonly CACHE_KEY = 'app_notifications_cache';
  private readonly SETTINGS_KEY = 'app_notification_settings';
  private readonly POLLING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_NOTIFICATIONS = 50;

  // Polling subscription
  private pollingSubscription: any = null;

  // ===== INITIALIZATION ===== ✅

  constructor() {
    console.log('✅ NotificationService initialized');
    this.initializeService();
  }

  /**
   * เริ่มต้น service
   */
  private initializeService(): void {
    // โหลด settings จาก localStorage
    this.loadSettingsFromStorage();

    // โหลด cached notifications
    this.loadCachedNotifications();

    // เริ่ม polling ถ้า user login แล้ว
    if (this.authService.isAuthenticated()) {
      this.startPolling();
    }

    // Subscribe to auth state changes
    this.authService.authState$.subscribe(state => {
      if (state.isAuthenticated) {
        this.startPolling();
        this.loadNotifications();
      } else {
        this.stopPolling();
        this.clearNotifications();
      }
    });
  }

  // ===== API METHODS ===== ✅

  /**
   * ✅ ส่ง notification ผ่าน backend API
   * @param payload ข้อมูลสำหรับส่ง notification
   * @returns Observable<NotificationResponse>
   */
  notifyTicketChanges(payload: NotificationPayload): Observable<NotificationResponse> {
    console.log('📤 Sending notification:', payload);

    return this.http.post<NotificationResponse>(
      `${this.apiUrl}/notify-changes`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Notification sent successfully:', response);
        
        if (response.success && response.data) {
          // เพิ่ม notifications ใหม่เข้า state
          this.addNotifications(response.data);
        }
      }),
      catchError(error => {
        console.error('❌ Error sending notification:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * ✅ โหลด notifications ทั้งหมด
   * @param options ตัวเลือกสำหรับ filter
   * @returns Observable<Notification[]>
   */
  loadNotifications(options?: NotificationQueryOptions): Observable<AppNotification[]> {
    console.log('📥 Loading notifications with options:', options);

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    // TODO: เปลี่ยนเป็น API endpoint ที่ดึง notifications ของ user
    // ตอนนี้ใช้ mock data ก่อน
    return this.getMockNotifications(options).pipe(
      tap(notifications => {
        console.log('✅ Notifications loaded:', notifications.length);
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
        this.updateSummary();
        this.cacheNotifications(notifications);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('❌ Error loading notifications:', error);
        this.loadingSubject.next(false);
        this.errorSubject.next('ไม่สามารถโหลดการแจ้งเตือนได้');
        return throwError(() => error);
      })
    );
  }

  /**
   * ✅ ทำเครื่องหมายว่าอ่านแล้ว
   * @param notificationId ID ของ notification
   * @returns Observable<boolean>
   */
  markAsRead(notificationId: number): Observable<boolean> {
    console.log('📖 Marking notification as read:', notificationId);

    // TODO: เรียก API เพื่ออัพเดท status
    // ตอนนี้อัพเดท local state ก่อน
    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.map(n => 
      n.id === notificationId 
        ? { ...n, status: NotificationStatus.READ, read_at: new Date().toISOString() }
        : n
    );

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.cacheNotifications(updatedNotifications);

    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * ✅ ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
   * @returns Observable<boolean>
   */
  markAllAsRead(): Observable<boolean> {
    console.log('📖 Marking all notifications as read');

    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.map(n => ({
      ...n,
      status: NotificationStatus.READ,
      read_at: n.read_at || new Date().toISOString()
    }));

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.cacheNotifications(updatedNotifications);

    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * ✅ ลบ notification
   * @param notificationId ID ของ notification
   * @returns Observable<boolean>
   */
  deleteNotification(notificationId: number): Observable<boolean> {
    console.log('🗑️ Deleting notification:', notificationId);

    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);

    this.notificationsSubject.next(updatedNotifications);
    this.updateUnreadCount();
    this.updateSummary();
    this.cacheNotifications(updatedNotifications);

    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * ✅ ลบทั้งหมด
   * @returns Observable<boolean>
   */
  deleteAllNotifications(): Observable<boolean> {
    console.log('🗑️ Deleting all notifications');

    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.summarySubject.next(null);
    this.clearCache();

    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  // ===== HELPER METHODS ===== ✅

  /**
   * เพิ่ม notifications ใหม่
   */
  private addNotifications(newNotifications: AppNotification[]): void {
    const current = this.notificationsSubject.value;
    const combined = [...newNotifications, ...current];
    
    // เก็บเฉพาะจำนวนที่กำหนด
    const limited = combined.slice(0, this.MAX_NOTIFICATIONS);
    
    this.notificationsSubject.next(limited);
    this.updateUnreadCount();
    this.updateSummary();
    this.cacheNotifications(limited);

    // แสดง toast notification ถ้ามี new notifications
    this.showToastForNewNotifications(newNotifications);
  }

  /**
   * อัพเดทจำนวน unread
   */
  private updateUnreadCount(): void {
    const notifications = this.notificationsSubject.value;
    const unread = notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
    this.unreadCountSubject.next(unread);
  }

  /**
   * อัพเดท summary
   */
  private updateSummary(): void {
    const notifications = this.notificationsSubject.value;
    
    const summary: NotificationSummary = {
      total: notifications.length,
      unread: notifications.filter(n => n.status === NotificationStatus.UNREAD).length,
      today: this.countTodayNotifications(notifications),
      high_priority: notifications.filter(n => 
        n.priority === NotificationPriority.HIGH || 
        n.priority === NotificationPriority.URGENT
      ).length,
      by_type: this.countByType(notifications)
    };

    this.summarySubject.next(summary);
  }

  /**
   * นับ notifications วันนี้
   */
  private countTodayNotifications(notifications: AppNotification[]): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return notifications.filter(n => {
      const nDate = new Date(n.created_at);
      nDate.setHours(0, 0, 0, 0);
      return nDate.getTime() === today.getTime();
    }).length;
  }

  /**
   * นับตาม type
   */
  private countByType(notifications: AppNotification[]): { [key in NotificationType]?: number } {
    const result: { [key in NotificationType]?: number } = {};

    notifications.forEach(n => {
      result[n.notification_type] = (result[n.notification_type] || 0) + 1;
    });

    return result;
  }

  /**
   * แสดง toast notification
   */
  private showToastForNewNotifications(notifications: AppNotification[]): void {
    // ตรวจสอบ settings ก่อน
    const settings = this.settingsSubject.value;
    if (!settings.push_enabled) return;

    notifications.forEach(notification => {
      // ตรวจสอบว่า type นี้เปิดใช้งานหรือไม่
      if (!settings.types[notification.notification_type]) return;

      // แสดง browser notification (ถ้า permission อนุญาต)
      this.showBrowserNotification(notification);

      // เล่นเสียง (ถ้าเปิดใช้งาน)
      if (settings.sound_enabled) {
        this.playNotificationSound();
      }
    });
  }

  /**
   * แสดง browser notification
   */
  private showBrowserNotification(notification: AppNotification): void {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      const n = new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/images/notification-icon.png',
        badge: '/assets/images/badge-icon.png',
        tag: `notification-${notification.id}`,
        requireInteraction: notification.priority === NotificationPriority.URGENT
      });

      n.onclick = () => {
        window.focus();
        // Navigate to ticket detail
        window.location.href = `/tickets/${notification.ticket_no}`;
      };
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showBrowserNotification(notification);
        }
      });
    }
  }

  /**
   * เล่นเสียงแจ้งเตือน
   */
  private playNotificationSound(): void {
    try {
      const audio = new Audio('/assets/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.warn('Cannot play notification sound:', error);
      });
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  // ===== POLLING ===== ✅

  /**
   * เริ่มต้น polling
   */
  private startPolling(): void {
    if (this.pollingSubscription) {
      return; // Already polling
    }

    console.log('🔄 Starting notification polling');

    this.pollingSubscription = interval(this.POLLING_INTERVAL).pipe(
      switchMap(() => this.loadNotifications())
    ).subscribe();
  }

  /**
   * หยุด polling
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      console.log('⏸️ Stopping notification polling');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  // ===== CACHE MANAGEMENT ===== ✅

  /**
   * บันทึก notifications ลง cache
   */
  private cacheNotifications(notifications: AppNotification[]): void {
    try {
      const cacheData = {
        notifications,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error caching notifications:', error);
    }
  }

  /**
   * โหลด notifications จาก cache
   */
  private loadCachedNotifications(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        this.notificationsSubject.next(cacheData.notifications || []);
        this.updateUnreadCount();
        this.updateSummary();
        console.log('✅ Loaded cached notifications:', cacheData.notifications.length);
      }
    } catch (error) {
      console.warn('Error loading cached notifications:', error);
    }
  }

  /**
   * ล้าง cache
   */
  private clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * ล้าง notifications
   */
  private clearNotifications(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.summarySubject.next(null);
    this.clearCache();
  }

  // ===== SETTINGS MANAGEMENT ===== ✅

  /**
   * โหลด settings จาก storage
   */
  private loadSettingsFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        this.settingsSubject.next(settings);
      }
    } catch (error) {
      console.warn('Error loading notification settings:', error);
    }
  }

  /**
   * บันทึก settings
   */
  updateSettings(settings: NotificationSettings): void {
    this.settingsSubject.next(settings);
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    console.log('✅ Notification settings updated');
  }

  /**
   * รีเซ็ต settings
   */
  resetSettings(): void {
    this.settingsSubject.next(DEFAULT_NOTIFICATION_SETTINGS);
    localStorage.removeItem(this.SETTINGS_KEY);
    console.log('✅ Notification settings reset to default');
  }

  // ===== PUBLIC GETTERS ===== ✅

  /**
   * ได้รับ notifications ปัจจุบัน
   */
  getCurrentNotifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  /**
   * ได้รับ unread count
   */
  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * ได้รับ summary
   */
  getSummary(): NotificationSummary | null {
    return this.summarySubject.value;
  }

  /**
   * ได้รับ settings
   */
  getSettings(): NotificationSettings {
    return this.settingsSubject.value;
  }

  /**
   * ได้รับ display notifications
   */
  getDisplayNotifications(): DisplayNotification[] {
    return this.notificationsSubject.value.map(n => createDisplayNotification(n));
  }

  /**
   * Filter notifications
   */
  filterNotifications(options: NotificationQueryOptions): AppNotification[] {
    let notifications = this.notificationsSubject.value;

    if (options.status) {
      notifications = notifications.filter(n => n.status === options.status);
    }

    if (options.type) {
      notifications = notifications.filter(n => n.notification_type === options.type);
    }

    if (options.priority) {
      notifications = notifications.filter(n => n.priority === options.priority);
    }

    // Sort
    if (options.sort === 'asc') {
      notifications.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Limit
    if (options.limit) {
      notifications = notifications.slice(0, options.limit);
    }

    return notifications;
  }

  // ===== MOCK DATA (สำหรับ development) ===== ✅

  /**
   * ✅ Mock notifications สำหรับ testing
   */
  private getMockNotifications(options?: NotificationQueryOptions): Observable<AppNotification[]> {
    const mockNotifications: AppNotification[] = [
      {
        id: 1,
        ticket_no: 'TK-2025-001',
        notification_type: NotificationType.NEW_TICKET,
        title: 'Ticket ใหม่ถูกสร้าง',
        message: 'มี ticket ใหม่ TK-2025-001 ถูกสร้างขึ้น',
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.MEDIUM,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
        user_id: 1,
        metadata: {
          ticket_id: 1
        }
      },
      {
        id: 2,
        ticket_no: 'TK-2025-002',
        notification_type: NotificationType.ASSIGNMENT,
        title: 'มอบหมายงานให้คุณ',
        message: 'คุณได้รับมอบหมายให้ดูแล ticket TK-2025-002',
        status: NotificationStatus.UNREAD,
        priority: NotificationPriority.HIGH,
        created_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 minutes ago
        user_id: 1,
        related_user_id: 2,
        metadata: {
          ticket_id: 2,
          assigned_by: 2,
          assigned_to: 1
        }
      }
    ];

    return new Observable(observer => {
      setTimeout(() => {
        observer.next(mockNotifications);
        observer.complete();
      }, 500);
    });
  }

  // ===== UTILITIES ===== ✅

  /**
   * ได้รับ auth headers
   */
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * จัดการ error
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 401:
          errorMessage = 'ไม่มีสิทธิ์เข้าถึง';
          break;
        case 403:
          errorMessage = 'ไม่มีสิทธิ์ในการดำเนินการนี้';
          break;
        case 404:
          errorMessage = 'ไม่พบข้อมูลที่ต้องการ';
          break;
        case 500:
          errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์';
          break;
        default:
          errorMessage = error.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      }
    }

    this.errorSubject.next(errorMessage);
    return throwError(() => errorMessage);
  }

  /**
   * ✅ Request browser notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * ✅ Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.stopPolling();
  }
}