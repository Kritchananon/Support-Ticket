// src/app/shared/services/notification.service.ts

import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, Subject, timer } from 'rxjs';
import { catchError, tap, takeUntil, map, switchMap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

// ✅ Import models
import {
  AppNotification,
  NotificationSummary,
  NotificationQueryOptions,
  NotificationSettings,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  DisplayNotification,
  createDisplayNotification,
  DEFAULT_NOTIFICATION_SETTINGS,
  BackendNotificationListResponse,
  transformBackendToApp,
  transformBackendSummary,
  NotificationPayload,
  NotificationResponse
} from '../models/notification.model';

/**
 * ✅ UPDATED: Notification Service - New Backend API Compatible
 * 
 * New Backend API Endpoints:
 * - GET /api/notifications/list - รายการ notifications ทั้งหมด
 * 
 * Backend Response Format:
 * {
 *   "success": true,
 *   "data": {
 *     "notifications": [...],
 *     "summary": {
 *       "total": 2,
 *       "unread_count": 1
 *     }
 *   }
 * }
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;
  
  // ===== WEBSOCKET CONFIGURATION ===== ✅
  
  private socket: Socket | null = null;
  private readonly SOCKET_URL = 'http://localhost:4200'; // WebSocket URL
  private readonly SOCKET_NAMESPACE = '/notifications';
  
  // Connection state
  private connectionStateSubject = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');
  public connectionState$ = this.connectionStateSubject.asObservable();

  // ===== STATE MANAGEMENT ===== ✅

  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private summarySubject = new BehaviorSubject<NotificationSummary | null>(null);
  public summary$ = this.summarySubject.asObservable();

  private settingsSubject = new BehaviorSubject<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  public settings$ = this.settingsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // ===== CONFIGURATION ===== ✅

  private readonly CACHE_KEY = 'app_notifications_cache';
  private readonly SETTINGS_KEY = 'app_notification_settings';
  private readonly MAX_NOTIFICATIONS = 50;
  private readonly POLLING_INTERVAL = 30000; // 30 วินาที
  
  private destroy$ = new Subject<void>();
  private pollingSubscription: any = null;

  // ===== INITIALIZATION ===== ✅

  constructor() {
    console.log('✅ NotificationService initialized - New Backend API Compatible');
    this.initializeService();
  }

  private initializeService(): void {
    this.loadSettingsFromStorage();
    this.loadCachedNotifications();

    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.isAuthenticated) {
          // ✅ เรียก API ทันทีเมื่อ login
          this.fetchNotifications().subscribe();
          
          // ✅ เริ่ม polling
          this.startPolling();
          
          // ✅ เชื่อมต่อ WebSocket (ถ้ามี)
          this.connectSocket();
        } else {
          this.stopPolling();
          this.disconnectSocket();
          this.clearNotifications();
        }
      });
  }

  // ===== NEW BACKEND API METHODS ===== ✅

  /**
   * ✅ NEW: เรียก GET /api/notifications/list
   * ดึงรายการ notifications ทั้งหมดพร้อม summary
   */
  public fetchNotifications(): Observable<AppNotification[]> {
    console.log('📡 Fetching notifications from NEW API: GET /api/notifications/list');
    
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<BackendNotificationListResponse>(
      `${this.apiUrl}/notifications/list`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('📡 Backend API response:', response);
        
        if (response.success && response.data) {
          // ✅ แปลง Backend notifications เป็น Frontend format
          const transformedNotifications = response.data.notifications.map(n => 
            transformBackendToApp(n)
          );
          
          console.log('✅ Transformed notifications:', transformedNotifications.length);
          
          // ✅ อัพเดท notifications state
          this.notificationsSubject.next(transformedNotifications);
          
          // ✅ อัพเดท unread count จาก summary
          const unreadCount = this.getSafeNumber(response.data.summary.unread_count);
          this.unreadCountSubject.next(unreadCount);
          
          // ✅ แปลง summary
          const transformedSummary = transformBackendSummary(
            response.data.summary,
            transformedNotifications
          );
          this.summarySubject.next(transformedSummary);
          
          // ✅ Cache notifications
          this.cacheNotifications(transformedNotifications);
          
          console.log('📊 Summary:', {
            total: response.data.summary.total,
            unread: unreadCount
          });
        }
      }),
      map(response => {
        const transformed = response.data.notifications.map(n => transformBackendToApp(n));
        this.loadingSubject.next(false);
        return transformed;
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * ✅ Mark notification as read (keep existing API)
   * PUT /api/mark-read/:notificationId
   */
  public markAsRead(notificationId: number): Observable<any> {
    console.log('✅ Marking notification as read:', notificationId);

    return this.http.put(
      `${this.apiUrl}/mark-read/${notificationId}`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        // อัพเดท local state
        const notifications = this.notificationsSubject.value;
        const updatedNotifications = notifications.map(n =>
          n.id === notificationId
            ? { ...n, status: NotificationStatus.READ, read_at: new Date().toISOString() }
            : n
        );
        
        this.notificationsSubject.next(updatedNotifications);
        
        // อัพเดท unread count
        const newUnreadCount = Math.max(0, this.unreadCountSubject.value - 1);
        this.unreadCountSubject.next(newUnreadCount);
        
        this.updateSummary();
        this.cacheNotifications(updatedNotifications);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ✅ Mark all notifications as read
   * PUT /api/mark-all-read
   */
  public markAllAsRead(): Observable<any> {
    console.log('✅ Marking all notifications as read');

    return this.http.put(
      `${this.apiUrl}/mark-all-read`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        // อัพเดท local state
        const notifications = this.notificationsSubject.value;
        const updatedNotifications = notifications.map(n => ({
          ...n,
          status: NotificationStatus.READ,
          read_at: new Date().toISOString()
        }));
        
        this.notificationsSubject.next(updatedNotifications);
        this.unreadCountSubject.next(0);
        
        this.updateSummary();
        this.cacheNotifications(updatedNotifications);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ✅ Delete notification
   * DELETE /api/delete-notification/:notificationId
   */
  public deleteNotification(notificationId: number): Observable<any> {
    console.log('🗑️ Deleting notification:', notificationId);

    return this.http.delete(
      `${this.apiUrl}/delete-notification/${notificationId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        // อัพเดท local state
        const notifications = this.notificationsSubject.value;
        const notificationToDelete = notifications.find(n => n.id === notificationId);
        const updatedNotifications = notifications.filter(n => n.id !== notificationId);
        
        this.notificationsSubject.next(updatedNotifications);
        
        // ถ้าเป็น unread ให้ลด count
        if (notificationToDelete && notificationToDelete.status === NotificationStatus.UNREAD) {
          const newUnreadCount = Math.max(0, this.unreadCountSubject.value - 1);
          this.unreadCountSubject.next(newUnreadCount);
        }
        
        this.updateSummary();
        this.cacheNotifications(updatedNotifications);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ✅ Delete all notifications
   * DELETE /api/delete-all-notifications
   */
  public deleteAllNotifications(): Observable<any> {
    console.log('🗑️ Deleting all notifications');

    return this.http.delete(
      `${this.apiUrl}/delete-all-notifications`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.notificationsSubject.next([]);
        this.unreadCountSubject.next(0);
        this.summarySubject.next({
          total: 0,
          unread: 0,
          today: 0,
          high_priority: 0,
          by_type: {}
        });
        this.clearCache();
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * ✅ Notify ticket changes (สำหรับส่ง notification เมื่อมีการเปลี่ยนแปลง ticket)
   * POST /api/notify-changes
   * 
   * ใช้เมื่อ:
   * - สร้าง ticket ใหม่
   * - เปลี่ยนสถานะ ticket
   * - มอบหมายงาน
   */
  public notifyTicketChanges(payload: NotificationPayload): Observable<NotificationResponse> {
    console.log('📤 Notifying ticket changes:', payload);

    return this.http.post<{
      success: boolean;
      message: string;
      data: any[];
      summary?: any;
    }>(
      `${this.apiUrl}/notify-changes`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('✅ Ticket changes notified:', response);
        
        // อัพเดท local state ถ้า Backend ส่ง notifications กลับมา
        if (response.success && response.data && response.data.length > 0) {
          const transformedNotifications = response.data.map(n => 
            transformBackendToApp(n)
          );
          
          // เพิ่ม notifications ใหม่เข้า list
          const currentNotifications = this.notificationsSubject.value;
          const updatedNotifications = [...transformedNotifications, ...currentNotifications];
          this.notificationsSubject.next(updatedNotifications.slice(0, this.MAX_NOTIFICATIONS));
          
          // อัพเดท summary ถ้ามี
          if (response.summary) {
            const transformedSummary = transformBackendSummary(
              response.summary,
              updatedNotifications
            );
            this.summarySubject.next(transformedSummary);
          }
          
          this.cacheNotifications(updatedNotifications);
        }
        
        // Refresh notifications จาก API
        this.fetchNotifications().subscribe();
      }),
      map(response => ({
        success: response.success,
        message: response.message,
        data: response.data?.map(n => transformBackendToApp(n)) || [],
        summary: response.summary
      })),
      catchError(this.handleError.bind(this))
    );
  }

  // ===== POLLING ===== ✅

  /**
   * ✅ เริ่ม polling เพื่อดึง notifications ทุกๆ 30 วินาที
   */
  private startPolling(): void {
    if (this.pollingSubscription) {
      return;
    }

    console.log('🔄 Starting notifications polling (interval:', this.POLLING_INTERVAL, 'ms)');
    
    this.pollingSubscription = timer(this.POLLING_INTERVAL, this.POLLING_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.fetchNotifications())
      )
      .subscribe({
        next: (notifications) => console.log('🔄 Polling update - notifications:', notifications.length),
        error: (error) => console.error('❌ Polling error:', error)
      });
  }

  /**
   * ✅ หยุด polling
   */
  private stopPolling(): void {
    if (this.pollingSubscription) {
      console.log('🛑 Stopping notifications polling...');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  // ===== WEBSOCKET METHODS ===== ✅

  public connectSocket(): void {
    const token = this.authService.getToken();
    if (!token) {
      console.warn('⚠️ No token available, cannot connect socket');
      return;
    }

    if (this.socket?.connected) {
      console.log('ℹ️ Socket already connected');
      return;
    }

    console.log('🔌 Connecting to WebSocket server...');
    this.connectionStateSubject.next('connecting');

    try {
      this.socket = io(`${this.SOCKET_URL}${this.SOCKET_NAMESPACE}`, {
        auth: { token: token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 10000
      });

      this.setupSocketListeners();

    } catch (error) {
      console.error('❌ Error creating socket connection:', error);
      this.connectionStateSubject.next('disconnected');
      this.errorSubject.next('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์แจ้งเตือนได้');
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // ===== CONNECTION EVENTS ===== ✅
    
    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully:', this.socket?.id);
      this.connectionStateSubject.next('connected');
      this.errorSubject.next(null);
    });

    this.socket.on('connection_success', (data: any) => {
      console.log('✅ Connection success event received:', data);
      this.connectionStateSubject.next('connected');
      this.errorSubject.next(null);
      
      // เรียก API เมื่อเชื่อมต่อสำเร็จ
      this.fetchNotifications().subscribe();
    });

    this.socket.on('subscribed', (data: any) => {
      console.log('✅ Subscribed to notifications:', data);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('⚠️ Socket disconnected:', reason);
      this.connectionStateSubject.next('disconnected');
      
      if (reason === 'io server disconnect') {
        console.log('🔄 Server forced disconnect, attempting manual reconnect...');
        setTimeout(() => this.socket?.connect(), 3000);
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error.message);
      this.connectionStateSubject.next('disconnected');
      
      if (error.message.includes('Authentication') || error.message.includes('jwt')) {
        this.errorSubject.next('การตรวจสอบสิทธิ์ล้มเหลว กรุณาเข้าสู่ระบบใหม่');
        this.authService.logout();
      } else {
        this.errorSubject.next('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์');
      }
    });

    // ===== NOTIFICATION EVENTS ===== ✅

    this.socket.on('new_notification', (data: any) => {
      console.log('🔔 New notification event received:', data);
      
      // Refresh notifications from API
      this.fetchNotifications().subscribe();
    });

    this.socket.on('unread_count_update', (data: { unread_count: number }) => {
      console.log('📊 Unread count update event received:', data);
      
      if (data && data.unread_count !== undefined) {
        const safeCount = this.getSafeNumber(data.unread_count);
        this.unreadCountSubject.next(safeCount);
        this.updateSummaryWithCount(safeCount);
      }
    });

    this.socket.on('notification_read', (data: { notificationId: number }) => {
      console.log('✅ Notification read event received:', data);
      
      // อัพเดท local state
      const notifications = this.notificationsSubject.value;
      const updatedNotifications = notifications.map(n =>
        n.id === data.notificationId
          ? { ...n, status: NotificationStatus.READ, read_at: new Date().toISOString() }
          : n
      );
      
      this.notificationsSubject.next(updatedNotifications);
      
      // อัพเดท unread count
      const newUnreadCount = Math.max(0, this.unreadCountSubject.value - 1);
      this.unreadCountSubject.next(newUnreadCount);
      
      this.updateSummary();
    });

    this.socket.on('notification_deleted', (data: { notificationId: number }) => {
      console.log('🗑️ Notification deleted event received:', data);
      
      const notifications = this.notificationsSubject.value;
      const notificationToDelete = notifications.find(n => n.id === data.notificationId);
      const updatedNotifications = notifications.filter(n => n.id !== data.notificationId);
      
      this.notificationsSubject.next(updatedNotifications);
      
      if (notificationToDelete && notificationToDelete.status === NotificationStatus.UNREAD) {
        const newUnreadCount = Math.max(0, this.unreadCountSubject.value - 1);
        this.unreadCountSubject.next(newUnreadCount);
      }
      
      this.updateSummary();
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      console.error('❌ Socket error event:', error);
      this.errorSubject.next(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    });
  }

  public disconnectSocket(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.connectionStateSubject.next('disconnected');
    }
  }

  public reconnectSocket(): void {
    console.log('🔄 Manually reconnecting socket...');
    this.disconnectSocket();
    setTimeout(() => this.connectSocket(), 1000);
  }

  // ===== SUMMARY MANAGEMENT ===== ✅

  private updateSummary(): void {
    try {
      const notifications = this.notificationsSubject.value;
      const unreadCount = this.unreadCountSubject.value;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const todayNotifications = notifications.filter(n => {
        try {
          return n && n.created_at && new Date(n.created_at) >= today;
        } catch {
          return false;
        }
      });

      const highPriorityNotifications = notifications.filter(n =>
        n && (
          n.priority === NotificationPriority.HIGH || 
          n.priority === NotificationPriority.URGENT
        )
      );

      const byType: { [key: string]: number } = {};
      notifications.forEach(n => {
        const type = n.notification_type.toString();
        byType[type] = (byType[type] || 0) + 1;
      });

      const summary: NotificationSummary = {
        total: notifications.length,
        unread: unreadCount,
        today: todayNotifications.length,
        high_priority: highPriorityNotifications.length,
        by_type: byType
      };

      this.summarySubject.next(summary);
    } catch (error) {
      console.error('❌ Error updating summary:', error);
      this.summarySubject.next(null);
    }
  }

  private updateSummaryWithCount(unreadCount: number): void {
    const currentSummary = this.summarySubject.value;
    const notifications = this.notificationsSubject.value;
    
    const updatedSummary: NotificationSummary = {
      total: currentSummary?.total || notifications.length,
      unread: unreadCount,
      today: currentSummary?.today || 0,
      high_priority: currentSummary?.high_priority || 0,
      by_type: currentSummary?.by_type || {}
    };
    
    this.summarySubject.next(updatedSummary);
  }

  /**
   * ✅ Helper method to safely convert any value to a valid number
   */
  private getSafeNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const num = Number(value);

    if (Number.isNaN(num)) {
      return 0;
    }

    if (!Number.isFinite(num) || num < 0) {
      return 0;
    }

    return Math.floor(num);
  }

  private showBrowserNotification(notification: AppNotification): void {
    const settings = this.settingsSubject.value;
    
    if (!settings.push_enabled) {
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/assets/icons/notification-icon.png',
          badge: '/assets/icons/badge-icon.png',
          tag: `notification-${notification.id}`,
          requireInteraction: notification.priority === NotificationPriority.URGENT
        });

        browserNotification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          console.log('Browser notification clicked:', notification.ticket_no);
        };

      } catch (error) {
        console.warn('Error showing browser notification:', error);
      }
    }
  }

  private playNotificationSound(): void {
    try {
      const audio = new Audio('/assets/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(error => {
        console.warn('Could not play notification sound:', error);
      });
    } catch (error) {
      console.warn('Error playing notification sound:', error);
    }
  }

  // ===== CACHE MANAGEMENT ===== ✅

  private cacheNotifications(notifications: AppNotification[]): void {
    try {
      const cacheData = { notifications, timestamp: new Date().toISOString() };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error caching notifications:', error);
    }
  }

  private loadCachedNotifications(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        this.notificationsSubject.next(cacheData.notifications || []);
        this.updateSummary();
        console.log('✅ Loaded cached notifications:', cacheData.notifications.length);
      }
    } catch (error) {
      console.warn('Error loading cached notifications:', error);
    }
  }

  private clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }

  private clearNotifications(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.summarySubject.next(null);
    this.clearCache();
  }

  // ===== SETTINGS MANAGEMENT ===== ✅

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

  updateSettings(settings: NotificationSettings): void {
    this.settingsSubject.next(settings);
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    console.log('✅ Notification settings updated');
  }

  resetSettings(): void {
    this.settingsSubject.next(DEFAULT_NOTIFICATION_SETTINGS);
    localStorage.removeItem(this.SETTINGS_KEY);
    console.log('✅ Notification settings reset to default');
  }

  // ===== PUBLIC GETTERS ===== ✅

  getCurrentNotifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  getUnreadCount(): number {
    return this.getSafeNumber(this.unreadCountSubject.value);
  }

  getSummary(): NotificationSummary | null {
    return this.summarySubject.value;
  }

  getSettings(): NotificationSettings {
    return this.settingsSubject.value;
  }

  getConnectionState(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStateSubject.value;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getDisplayNotifications(): DisplayNotification[] {
    return this.notificationsSubject.value.map(n => createDisplayNotification(n));
  }

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

    if (options.sort === 'asc') {
      notifications.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    if (options.limit) {
      notifications = notifications.slice(0, options.limit);
    }

    return notifications;
  }

  // ===== UTILITIES ===== ✅

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

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

  ngOnDestroy(): void {
    console.log('🧹 NotificationService cleanup');
    this.stopPolling();
    this.disconnectSocket();
    this.destroy$.next();
    this.destroy$.complete();
  }
}