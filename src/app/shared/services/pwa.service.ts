import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge } from 'rxjs';
import { map, distinctUntilChanged, startWith } from 'rxjs/operators';

// ✅ PWA Notification Types
export interface PWANotification {
  id: string;
  type: 'offline' | 'online' | 'cache-used' | 'update-available' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  persistent?: boolean;
  action?: () => void;
}

// ✅ PWA Cache Info
export interface PWACacheInfo {
  totalSize: number;
  itemCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  categories: {
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  };
  projects: {
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PWAService {
  
  // ✅ Online/Offline Status
  private onlineStatus$ = new BehaviorSubject<boolean>(navigator.onLine);
  private notifications$ = new BehaviorSubject<PWANotification[]>([]);
  
  // ✅ PWA Installation
  private deferredPrompt: any = null;
  private isInstallable$ = new BehaviorSubject<boolean>(false);
  
  // ✅ Service Worker
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateAvailable$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initializeOnlineStatus();
    this.initializePWAEvents();
    this.initializeServiceWorker();
    this.listenToCustomEvents();
  }

  // ✅ Online/Offline Status Management
  
  private initializeOnlineStatus(): void {
    // ✅ Listen to online/offline events
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).pipe(
      startWith(navigator.onLine),
      distinctUntilChanged()
    ).subscribe(isOnline => {
      console.log('📱 PWA: Network status changed:', isOnline ? 'Online' : 'Offline');
      
      this.onlineStatus$.next(isOnline);
      
      // ✅ Show notification when status changes
      this.addNotification({
        type: isOnline ? 'online' : 'offline',
        title: isOnline ? 'เชื่อมต่ออินเทอร์เน็ตแล้ว' : 'ออฟไลน์',
        message: isOnline 
          ? 'กลับมาออนไลน์แล้ว ข้อมูลจะอัปเดตอัตโนมัติ' 
          : 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต จะใช้ข้อมูลที่เก็บไว้',
        persistent: !isOnline
      });
    });
  }

  public isOnline(): Observable<boolean> {
    return this.onlineStatus$.asObservable();
  }

  public getCurrentOnlineStatus(): boolean {
    return this.onlineStatus$.value;
  }

  // ✅ PWA Installation Management
  
  private initializePWAEvents(): void {
    // ✅ Listen for PWA installation prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA: Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable$.next(true);
      
      this.addNotification({
        type: 'update-available',
        title: 'ติดตั้งแอปพลิเคชัน',
        message: 'คลิกเพื่อติดตั้งแอปบนหน้าจอหลัก',
        action: () => this.installPWA()
      });
    });

    // ✅ Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('📱 PWA: App installed successfully');
      this.deferredPrompt = null;
      this.isInstallable$.next(false);
      
      this.addNotification({
        type: 'online',
        title: 'ติดตั้งสำเร็จ',
        message: 'แอปพลิเคชันถูกติดตั้งบนหน้าจอหลักแล้ว'
      });
    });
  }

  public async installPWA(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('📱 PWA: No install prompt available');
      return false;
    }

    try {
      const result = await this.deferredPrompt.prompt();
      console.log('📱 PWA: Install prompt result:', result.outcome);
      
      if (result.outcome === 'accepted') {
        this.deferredPrompt = null;
        this.isInstallable$.next(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('📱 PWA: Install error:', error);
      return false;
    }
  }

  public isInstallable(): Observable<boolean> {
    return this.isInstallable$.asObservable();
  }

  // ✅ Service Worker Management
  
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/ngsw-worker.js');
        this.swRegistration = registration;
        
        console.log('📱 PWA: Service Worker registered:', registration.scope);
        
        // ✅ Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('📱 PWA: Update found');
          this.updateAvailable$.next(true);
          
          this.addNotification({
            type: 'update-available',
            title: 'อัปเดตใหม่',
            message: 'มีเวอร์ชั่นใหม่ของแอป คลิกเพื่ออัปเดต',
            persistent: true,
            action: () => this.updateApp()
          });
        });

      } catch (error) {
        console.error('📱 PWA: Service Worker registration failed:', error);
      }
    }
  }

  public async updateApp(): Promise<void> {
    if (!this.swRegistration) return;

    try {
      await this.swRegistration.update();
      
      // ✅ Force page reload to use new version
      window.location.reload();
      
    } catch (error) {
      console.error('📱 PWA: Update failed:', error);
      
      this.addNotification({
        type: 'error',
        title: 'อัปเดตล้มเหลว',
        message: 'ไม่สามารถอัปเดตแอปได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  public hasUpdateAvailable(): Observable<boolean> {
    return this.updateAvailable$.asObservable();
  }

  // ✅ Custom Events Listener
  
  private listenToCustomEvents(): void {
    // ✅ Listen to dropdown offline events
    window.addEventListener('pwa-offline-data', (event: any) => {
      const { component, message } = event.detail;
      
      this.addNotification({
        type: 'cache-used',
        title: 'ใช้ข้อมูลที่เก็บไว้',
        message: message || `กำลังใช้ข้อมูลที่เก็บไว้สำหรับ ${component}`
      });
    });
  }

  // ✅ Notification Management
  
  private addNotification(notification: Omit<PWANotification, 'id' | 'timestamp'>): void {
    const newNotification: PWANotification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date()
    };
    
    const currentNotifications = this.notifications$.value;
    
    // ✅ Remove duplicate notifications
    const filteredNotifications = currentNotifications.filter(n => 
      !(n.type === newNotification.type && n.title === newNotification.title)
    );
    
    const updatedNotifications = [newNotification, ...filteredNotifications];
    
    // ✅ Keep only last 10 notifications
    if (updatedNotifications.length > 10) {
      updatedNotifications.splice(10);
    }
    
    this.notifications$.next(updatedNotifications);
    
    // ✅ Auto-remove non-persistent notifications
    if (!newNotification.persistent) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, 5000);
    }
  }

  public removeNotification(id: string): void {
    const currentNotifications = this.notifications$.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications$.next(updatedNotifications);
  }

  public getNotifications(): Observable<PWANotification[]> {
    return this.notifications$.asObservable();
  }

  public clearAllNotifications(): void {
    this.notifications$.next([]);
  }

  // ✅ Cache Management
  
  public async getCacheInfo(): Promise<PWACacheInfo> {
    const categoryStats = await this.getCategoryServiceStats();
    const projectStats = await this.getProjectServiceStats();
    
    const totalSize = categoryStats.totalSize + projectStats.totalSize;
    const itemCount = categoryStats.itemCount + projectStats.itemCount;
    
    const allTimestamps = [
      ...categoryStats.timestamps,
      ...projectStats.timestamps
    ].filter(t => t > 0);
    
    const oldestEntry = allTimestamps.length > 0 
      ? new Date(Math.min(...allTimestamps)) 
      : null;
    
    const newestEntry = allTimestamps.length > 0 
      ? new Date(Math.max(...allTimestamps)) 
      : null;

    return {
      totalSize,
      itemCount,
      oldestEntry,
      newestEntry,
      categories: {
        hasCache: categoryStats.hasCache,
        ageInMinutes: categoryStats.ageInMinutes,
        dataCount: categoryStats.dataCount
      },
      projects: {
        hasCache: projectStats.hasCache,
        ageInMinutes: projectStats.ageInMinutes,
        dataCount: projectStats.dataCount
      }
    };
  }

  private async getCategoryServiceStats(): Promise<{
    totalSize: number;
    itemCount: number;
    timestamps: number[];
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  }> {
    // ✅ This would integrate with CategoryService
    // For now, simulate with localStorage inspection
    const keys = Object.keys(localStorage).filter(key => key.startsWith('pwa_categories_cache'));
    let totalSize = 0;
    const timestamps: number[] = [];
    let hasCache = false;
    let ageInMinutes = 0;
    let dataCount = 0;

    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            timestamps.push(parsed.timestamp);
            hasCache = true;
            ageInMinutes = Math.floor((Date.now() - parsed.timestamp) / (1000 * 60));
            dataCount += parsed.data?.length || 0;
          }
        } catch {
          // Ignore invalid cache entries
        }
      }
    });

    return {
      totalSize,
      itemCount: keys.length,
      timestamps,
      hasCache,
      ageInMinutes,
      dataCount
    };
  }

  private async getProjectServiceStats(): Promise<{
    totalSize: number;
    itemCount: number;
    timestamps: number[];
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  }> {
    // ✅ Similar to category stats
    const keys = Object.keys(localStorage).filter(key => key.startsWith('pwa_projects_cache'));
    let totalSize = 0;
    const timestamps: number[] = [];
    let hasCache = false;
    let ageInMinutes = 0;
    let dataCount = 0;

    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            timestamps.push(parsed.timestamp);
            hasCache = true;
            ageInMinutes = Math.floor((Date.now() - parsed.timestamp) / (1000 * 60));
            dataCount += parsed.data?.length || 0;
          }
        } catch {
          // Ignore invalid cache entries
        }
      }
    });

    return {
      totalSize,
      itemCount: keys.length,
      timestamps,
      hasCache,
      ageInMinutes,
      dataCount
    };
  }

  public async clearAllCache(): Promise<void> {
    try {
      // ✅ Clear PWA caches
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('pwa_categories_cache') || 
        key.startsWith('pwa_projects_cache')
      );
      
      keys.forEach(key => localStorage.removeItem(key));
      
      // ✅ Clear Service Worker caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      console.log('📱 PWA: All caches cleared');
      
      this.addNotification({
        type: 'online',
        title: 'ล้างแคชสำเร็จ',
        message: 'ข้อมูลแคชทั้งหมดถูกล้างแล้ว'
      });
      
    } catch (error) {
      console.error('📱 PWA: Clear cache error:', error);
      
      this.addNotification({
        type: 'error',
        title: 'ล้างแคชล้มเหลว',
        message: 'ไม่สามารถล้างแคชได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  // ✅ Utility Methods
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public getAppInfo(): {
    isOnline: boolean;
    isInstallable: boolean;
    hasUpdate: boolean;
    notificationCount: number;
  } {
    return {
      isOnline: this.getCurrentOnlineStatus(),
      isInstallable: this.isInstallable$.value,
      hasUpdate: this.updateAvailable$.value,
      notificationCount: this.notifications$.value.length
    };
  }

  // ✅ Debug Methods
  
  public async getDebugInfo(): Promise<{
    online: boolean;
    userAgent: string;
    serviceWorker: boolean;
    localStorage: boolean;
    caches: boolean;
    notifications: boolean;
    cacheStats: any;
  }> {
    const cacheStats = await this.getCacheInfo();
    
    return {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      serviceWorker: 'serviceWorker' in navigator,
      localStorage: typeof Storage !== 'undefined',
      caches: 'caches' in window,
      notifications: 'Notification' in window,
      cacheStats
    };
  }

  public logDebugInfo(): void {
    this.getDebugInfo().then(info => {
      console.group('📱 PWA Debug Info');
      console.log('Online:', info.online);
      console.log('Service Worker Support:', info.serviceWorker);
      console.log('LocalStorage Support:', info.localStorage);
      console.log('Cache API Support:', info.caches);
      console.log('Notifications Support:', info.notifications);
      console.log('Cache Stats:', info.cacheStats);
      console.log('User Agent:', info.userAgent);
      console.groupEnd();
    });
  }
}