import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser: any = null;
  currentLanguage = 'th';
  pageTitle = 'Dashboard';

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.updatePageTitle();
    
    // Load saved language preference
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage) {
      this.currentLanguage = savedLanguage;
    }
  }

  switchLanguage(lang: string): void {
    this.currentLanguage = lang;
    localStorage.setItem('language', lang);
    this.updatePageTitle(); // Update page title when language changes
    // TODO: Implement language service for global language switching
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
    
    // Show confirmation dialog
    const confirmLogout = confirm(
      this.getText(
        'Are you sure you want to logout?', 
        'คุณต้องการออกจากระบบหรือไม่?'
      )
    );
    
    if (confirmLogout) {
      this.authService.logout();
      this.router.navigate(['/login']);
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

  private updatePageTitle(): void {
    // Update page title based on current route
    const path = this.router.url;
    
    if (path.includes('dashboard')) {
      this.pageTitle = this.getText('Dashboard', 'แดชบอร์ด');
    } else if (path.includes('tickets/new')) {
      this.pageTitle = this.getText('New Ticket', 'ตั๋วใหม่');
    } else if (path.includes('tickets')) {
      this.pageTitle = this.getText('All Tickets', 'ตั๋วทั้งหมด');
    } else if (path.includes('reports/weekly')) {
      this.pageTitle = this.getText('Weekly Report', 'รายงานรายสัปดาห์');
    } else if (path.includes('reports/monthly')) {
      this.pageTitle = this.getText('Monthly Report', 'รายงานรายเดือน');
    } else if (path.includes('reports/export')) {
      this.pageTitle = this.getText('Export Ticket', 'ส่งออกตั๋ว');
    } else if (path.includes('settings/general')) {
      this.pageTitle = this.getText('General Settings', 'การตั้งค่าทั่วไป');
    } else if (path.includes('settings/account')) {
      this.pageTitle = this.getText('User Account', 'บัญชีผู้ใช้');
    } else if (path.includes('settings/projects')) {
      this.pageTitle = this.getText('Project Settings', 'การตั้งค่าโปรเจกต์');
    } else if (path.includes('settings/categories')) {
      this.pageTitle = this.getText('Ticket Categories', 'หมวดหมู่ตั๋ว');
    } else if (path.includes('profile')) {
      this.pageTitle = this.getText('My Profile', 'โปรไฟล์ของฉัน');
    } else {
      this.pageTitle = this.getText('Support Ticket', 'ระบบตั๋วสนับสนุน');
    }
  }
}
