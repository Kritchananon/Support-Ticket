import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PWAService, PWANotification } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pwa-indicator.component.html',
  styleUrls: ['./pwa-indicator.component.css']
})
export class PWAIndicatorComponent implements OnInit, OnDestroy {
  private pwaService = inject(PWAService);
  private destroy$ = new Subject<void>();

  // ✅ Component State
  isOnline = true;
  isInstallable = false;
  hasUpdate = false;
  notifications: PWANotification[] = [];
  cacheInfo: any = null;
  showInfoPanel = false;
  showQuickActions = false; // ✅ เพิ่มสำหรับ Quick Actions

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadCacheInfo();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSubscriptions(): void {
    // ✅ Online/Offline Status
    this.pwaService.isOnline()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isOnline => {
        this.isOnline = isOnline;
        if (isOnline) {
          this.loadCacheInfo(); // Refresh cache info when back online
        }
      });

    // ✅ Installation Status
    this.pwaService.isInstallable()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isInstallable => {
        this.isInstallable = isInstallable;
      });

    // ✅ Update Status
    this.pwaService.hasUpdateAvailable()
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasUpdate => {
        this.hasUpdate = hasUpdate;
      });

    // ✅ Notifications
    this.pwaService.getNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications;
      });
  }

  private async loadCacheInfo(): Promise<void> {
    try {
      this.cacheInfo = await this.pwaService.getCacheInfo();
    } catch (error) {
      console.error('Error loading cache info:', error);
    }
  }

  // ✅ Actions
  async installApp(): Promise<void> {
    const success = await this.pwaService.installPWA();
    if (!success) {
      console.warn('PWA installation failed or cancelled');
    }
  }

  async updateApp(): Promise<void> {
    await this.pwaService.updateApp();
  }

  dismissNotification(id: string): void {
    this.pwaService.removeNotification(id);
  }

  toggleInfoPanel(): void {
    this.showInfoPanel = !this.showInfoPanel;
    if (this.showInfoPanel) {
      this.loadCacheInfo();
    }
  }

  async clearAllCache(): Promise<void> {
    if (confirm('คุณต้องการล้างแคชทั้งหมดหรือไม่? การดำเนินการนี้จะทำให้ต้องโหลดข้อมูลใหม่')) {
      await this.pwaService.clearAllCache();
      await this.loadCacheInfo();
    }
  }

  async refreshCacheInfo(): Promise<void> {
    await this.loadCacheInfo();
  }

  // ✅ Utility Methods
  trackNotification(index: number, notification: PWANotification): string {
    return notification.id;
  }

  formatTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes === 1) return '1 นาทีที่แล้ว';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 ชั่วโมงที่แล้ว';
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  }

  formatBytes(bytes: number): string {
    return this.pwaService.formatBytes(bytes);
  }
}