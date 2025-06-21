import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser: any = null;
  currentLanguage = 'th';
  pageTitle = 'Dashboard';

  // ✅ Token Warning Properties
  showTokenWarning = false;
  isRefreshing = false;
  private warningSubscription?: Subscription;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.updatePageTitle();
    
    // Load saved language preference
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      this.currentLanguage = savedLanguage;
    }

    // ✅ Subscribe to token warning status
    this.warningSubscription = this.authService.getWarningStatus().subscribe(
      (warning) => {
        this.showTokenWarning = warning;
      }
    );
  }

  ngOnDestroy(): void {
    if (this.warningSubscription) {
      this.warningSubscription.unsubscribe();
    }
  }

  switchLanguage(lang: string): void {
    this.currentLanguage = lang;
    localStorage.setItem('language', lang);
    this.updatePageTitle();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (this.currentLanguage === 'th') {
      if (hour < 12) return 'สวัสดีตอนเช้า';
      if (hour < 17) return 'สวัสดีตอนบ่าย';
      return 'สวัสดีตอนเย็น';
    } else {
      if (hour < 12) return 'Good morning';
      if (hour < 17) return 'Good afternoon';
      return 'Good evening';
    }
  }

  getText(en: string, th: string): string {
    return this.currentLanguage === 'th' ? th : en;
  }

  goToProfile(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/profile']);
  }

  goToSettings(event: Event): void {
    event.preventDefault();
    this.router.navigate(['/settings/general']);
  }

  logout(event: Event): void {
    event.preventDefault();
    
    const confirmLogout = confirm(
      this.getText(
        'Are you sure you want to logout?', 
        'คุณต้องการออกจากระบบหรือไม่?'
      )
    );
    
    if (confirmLogout) {
      this.authService.logout();
    }
  }

  toggleMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar) {
      sidebar.classList.toggle('show');
    }
    
    if (overlay) {
      overlay.classList.toggle('show');
    }
  }

  // ✅ Token Warning Methods
  refreshSession(): void {
    this.isRefreshing = true;
    
    this.authService.manualRefresh().subscribe({
      next: () => {
        console.log('Manual token refresh successful');
        this.showTokenWarning = false;
        this.isRefreshing = false;
      },
      error: (error) => {
        console.error('Manual token refresh failed:', error);
        this.isRefreshing = false;
        // Auto logout จะถูกจัดการโดย AuthService
      }
    });
  }

  dismissWarning(): void {
    this.showTokenWarning = false;
  }

  private updatePageTitle(): void {
    const path = this.router.url;
    
    if (path.includes('dashboard')) {
      this.pageTitle = this.getText('Dashboard', 'แดชบอร์ด');
    } else if (path.includes('tickets/new')) {
      this.pageTitle = this.getText('New Ticket', 'ตั๋วใหม่');
    } else if (path.includes('tickets')) {
      this.pageTitle = this.getText('All Tickets', 'ตั๋วทั้งหมด');
    } else {
      this.pageTitle = this.getText('Support Ticket', 'ระบบตั๋วสนับสนุน');
    }
  }
}
