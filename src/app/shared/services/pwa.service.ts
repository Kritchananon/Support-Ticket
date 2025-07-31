import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// ✅ แก้ไข interface สำหรับ Navigator และ NotificationOptions
declare global {
  interface Navigator {
    standalone?: boolean;
  }
  
  interface NotificationOptions {
    actions?: NotificationAction[];
    vibrate?: number[];
  }
  
  interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
  }
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private installPromptEvent: BeforeInstallPromptEvent | null = null;
  private readonly isInstallableSubject = new BehaviorSubject<boolean>(false);
  private readonly isInstalledSubject = new BehaviorSubject<boolean>(false);
  private readonly isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    this.initializePwaFeatures();
    this.checkInstallationStatus();
    this.monitorNetworkStatus();
  }

  /**
   * Observable สำหรับตรวจสอบว่าแอปสามารถติดตั้งได้หรือไม่
   */
  get isInstallable$(): Observable<boolean> {
    return this.isInstallableSubject.asObservable();
  }

  /**
   * Observable สำหรับตรวจสอบว่าแอปถูกติดตั้งแล้วหรือไม่
   */
  get isInstalled$(): Observable<boolean> {
    return this.isInstalledSubject.asObservable();
  }

  /**
   * Observable สำหรับตรวจสอบสถานะการเชื่อมต่ออินเทอร์เน็ต
   */
  get isOnline$(): Observable<boolean> {
    return this.isOnlineSubject.asObservable();
  }

  /**
   * ตรวจสอบว่าเบราว์เซอร์รองรับ PWA หรือไม่
   */
  get isPwaSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * ตรวจสอบว่าแอปทำงานในโหมด standalone หรือไม่
   */
  get isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           navigator.standalone === true; // ✅ แก้ไข type
  }

  /**
   * เริ่มต้นฟีเจอร์ PWA
   */
  private initializePwaFeatures(): void {
    // ตรวจจับ beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      event.preventDefault();
      this.installPromptEvent = event as BeforeInstallPromptEvent;
      this.isInstallableSubject.next(true);
      console.log('[PWA Service] App is installable');
    });

    // ตรวจจับเมื่อแอปถูกติดตั้ง
    window.addEventListener('appinstalled', () => {
      console.log('[PWA Service] App was installed');
      this.isInstalledSubject.next(true);
      this.isInstallableSubject.next(false);
      this.installPromptEvent = null;
    });
  }

  /**
   * แสดง install prompt
   */
  async promptInstall(): Promise<boolean> {
    if (!this.installPromptEvent) {
      console.warn('[PWA Service] No install prompt available');
      return false;
    }

    try {
      await this.installPromptEvent.prompt();
      const { outcome } = await this.installPromptEvent.userChoice;
      
      console.log(`[PWA Service] Install prompt ${outcome}`);
      
      if (outcome === 'accepted') {
        this.isInstallableSubject.next(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA Service] Install prompt failed:', error);
      return false;
    }
  }

  /**
   * ตรวจสอบสถานะการติดตั้ง
   */
  private checkInstallationStatus(): void {
    // ตรวจสอบจาก display mode
    if (this.isStandalone) {
      this.isInstalledSubject.next(true);
      return;
    }

    // ✅ ตรวจสอบจาก localStorage แบบปลอดภัย
    try {
      const wasInstalled = localStorage.getItem('pwa-installed') === 'true';
      if (wasInstalled) {
        this.isInstalledSubject.next(true);
      }
    } catch (error) {
      console.warn('[PWA Service] localStorage not available:', error);
    }
  }

  /**
   * บันทึกสถานะการติดตั้ง
   */
  markAsInstalled(): void {
    try {
      localStorage.setItem('pwa-installed', 'true'); // ✅ ใน try-catch
      this.isInstalledSubject.next(true);
    } catch (error) {
      console.warn('[PWA Service] Cannot save to localStorage:', error);
      this.isInstalledSubject.next(true);
    }
  }

  /**
   * ตรวจสอบสถานะเครือข่าย
   */
  private monitorNetworkStatus(): void {
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
    
    merge(online$, offline$).subscribe(isOnline => {
      console.log(`[PWA Service] Network status: ${isOnline ? 'online' : 'offline'}`);
      this.isOnlineSubject.next(isOnline);
    });
  }

  /**
   * ขอสิทธิ์สำหรับ Push Notifications
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[PWA Service] This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log(`[PWA Service] Notification permission: ${permission}`);
      return permission;
    }

    return Notification.permission;
  }

  /**
   * แสดง Local Notification
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    const permission = await this.requestNotificationPermission();
    
    if (permission !== 'granted') {
      console.warn('[PWA Service] Notification permission not granted');
      return;
    }

    // ✅ แก้ไข path ของ icons และเพิ่ม type safety
    const defaultOptions: NotificationOptions = {
      icon: '/icons/icon-192x192.png',    // ใช้ path ที่ถูกต้อง
      badge: '/icons/icon-72x72.png',     // ไฟล์อยู่ใน public/icons/
      vibrate: [200, 100, 200] as number[], // ✅ explicit type
      ...options
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // ใช้ Service Worker สำหรับแสดง notification
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, defaultOptions);
    } else {
      // ใช้ browser notification API
      new Notification(title, defaultOptions);
    }
  }

  /**
   * ลงทะเบียน Service Worker
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA Service] Service Worker not supported');
      return null;
    }

    try {
      // ✅ ใช้ ngsw-worker.js แทน sw.js
      const registration = await navigator.serviceWorker.register('/ngsw-worker.js');
      console.log('[PWA Service] Service Worker registered:', registration);

      // ตรวจสอบการอัปเดต
      registration.addEventListener('updatefound', () => {
        console.log('[PWA Service] New service worker available');
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA Service] New content available, please refresh');
              // สามารถแสดง toast หรือ modal เพื่อแจ้งผู้ใช้
              this.showUpdateAvailableNotification();
            }
          });
        }
      });

      return registration;
    } catch (error) {
      console.error('[PWA Service] Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * แจ้งเตือนเมื่อมีการอัปเดตใหม่
   */
  private showUpdateAvailableNotification(): void {
    this.showNotification('แอปมีการอัปเดตใหม่', {
      body: 'กรุณา refresh หน้าเพื่อใช้ฟีเจอร์ใหม่',
      tag: 'app-update',
      requireInteraction: true,
      actions: [ // ✅ จะใช้งานได้เพราะมี interface declaration แล้ว
        {
          action: 'refresh',
          title: 'Refresh'
        },
        {
          action: 'dismiss',
          title: 'ไม่ใช่ตอนนี้'
        }
      ] as NotificationAction[]
    });
  }

  /**
   * บังคับให้ Service Worker ใหม่เข้าสู่การทำงาน
   */
  async skipWaiting(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    
    if (registration.waiting) {
      registration.waiting.postMessage({ action: 'skipWaiting' });
    }
  }

  /**
   * ลบ cache ทั้งหมด (สำหรับการ debug)
   */
  async clearAllCaches(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('[PWA Service] All caches cleared');
    }
  }

  /**
   * รับข้อมูลเกี่ยวกับ cache
   */
  async getCacheInfo(): Promise<any> {
    if (!('caches' in window)) {
      return { supported: false };
    }

    const cacheNames = await caches.keys();
    const cacheInfo: { [key: string]: any } = {}; // ✅ เพิ่ม type

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo[cacheName] = {
        count: keys.length,
        urls: keys.map(request => request.url)
      };
    }

    return {
      supported: true,
      caches: cacheInfo
    };
  }
}