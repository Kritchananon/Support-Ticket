import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

// ✅ Import interfaces จาก user.model.ts ใหม่
import { User, AuthState } from '../../models/user.model';

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

  // ✅ User and Auth State
  currentUser: User | null = null;
  authState: AuthState | null = null;
  userPermissions: string[] = [];
  
  // ✅ UI State
  currentLanguage = 'th';
  pageTitle = 'Dashboard';
  isLoading = false;

  // ✅ Token Warning Properties
  showTokenWarning = false;
  isRefreshing = false;
  tokenInfo: any = null;

  // ✅ Subscription Management
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    console.log('🔧 Header component initialized');
    this.initializeComponent();
    this.setupSubscriptions();
    this.updatePageTitle();
  }

  ngOnDestroy(): void {
    console.log('🧹 Header component cleanup');
    // ✅ ป้องกัน memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== INITIALIZATION ===== ✅

  /**
   * ✅ ตั้งค่าเริ่มต้น component
   */
  private initializeComponent(): void {
    // ✅ โหลดข้อมูล user และ auth state
    this.loadUserData();
    this.loadLanguagePreference();
    this.loadTokenInfo();
    
    console.log('📋 Header initialized with:', {
      hasUser: !!this.currentUser,
      language: this.currentLanguage,
      permissionCount: this.userPermissions.length
    });
  }

  /**
   * ✅ ตั้งค่า subscriptions
   */
  private setupSubscriptions(): void {
    // ✅ Subscribe to user changes
    const userSub = this.authService.currentUser$.subscribe(user => {
      console.log('👤 User data updated in header:', user?.username);
      this.currentUser = user;
      this.updateUserRelatedData();
    });

    // ✅ Subscribe to auth state changes
    const authSub = this.authService.authState$.subscribe(state => {
      console.log('🔐 Auth state updated in header:', {
        isAuthenticated: state.isAuthenticated,
        hasUser: !!state.user
      });
      this.authState = state;
      this.userPermissions = state.permissions || [];
    });

    // ✅ Subscribe to token warning
    const warningSub = this.authService.getWarningStatus().subscribe(warning => {
      console.log('⚠️ Token warning status:', warning);
      this.showTokenWarning = warning;
      if (warning) {
        this.updateTokenInfo();
      }
    });

    // ✅ Subscribe to route changes for page title
    const routeSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        console.log('🛣️ Route changed:', event.url);
        this.updatePageTitle();
      });

    // ✅ เก็บ subscriptions เพื่อ cleanup
    this.subscriptions.push(userSub, authSub, warningSub, routeSub);
  }

  // ===== DATA LOADING ===== ✅

  /**
   * ✅ โหลดข้อมูล user
   */
  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.userPermissions = this.authService.getUserPermissions();
    
    if (this.currentUser) {
      console.log('✅ User data loaded:', {
        id: this.currentUser.id,
        username: this.currentUser.username,
        fullName: this.getUserFullName()
      });
    }
  }

  /**
   * ✅ โหลดการตั้งค่าภาษา
   */
  private loadLanguagePreference(): void {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && ['th', 'en'].includes(savedLanguage)) {
      this.currentLanguage = savedLanguage;
      console.log('🌍 Language preference loaded:', this.currentLanguage);
    }
  }

  /**
   * ✅ โหลดข้อมูล token
   */
  private loadTokenInfo(): void {
    this.tokenInfo = this.authService.getTokenInfo();
    if (this.tokenInfo) {
      console.log('🔑 Token info loaded:', {
        username: this.tokenInfo.username,
        expiresAt: this.tokenInfo.expires_at,
        timeLeftMinutes: this.tokenInfo.time_left_minutes
      });
    }
  }

  /**
   * ✅ อัปเดตข้อมูลที่เกี่ยวข้องกับ user
   */
  private updateUserRelatedData(): void {
    if (this.currentUser) {
      this.userPermissions = this.authService.getUserPermissions();
      this.updateTokenInfo();
    }
  }

  /**
   * ✅ อัปเดตข้อมูล token
   */
  private updateTokenInfo(): void {
    this.tokenInfo = this.authService.getTokenInfo();
  }

  // ===== USER INFO METHODS ===== ✅

  /**
   * ✅ ดึงชื่อเต็มของ user
   */
  getUserFullName(): string {
    if (!this.currentUser) return '';
    
    const firstName = this.currentUser.firstname || '';
    const lastName = this.currentUser.lastname || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return this.currentUser.username || 'User';
  }

  /**
   * ✅ ดึงชื่อย่อของ user
   */
  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const firstName = this.currentUser.firstname || '';
    const lastName = this.currentUser.lastname || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    
    const username = this.currentUser.username || 'User';
    return username.charAt(0).toUpperCase();
  }

  /**
   * ✅ ดึงข้อมูล contact
   */
  getUserContact(): string {
    if (!this.currentUser) return '';
    return this.currentUser.email || this.currentUser.phone || '';
  }

  /**
   * ✅ ตรวจสอบสิทธิ์
   */
  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  /**
   * ✅ ดึงจำนวน permissions
   */
  getPermissionCount(): number {
    return this.userPermissions.length;
  }

  // ===== GREETING METHODS ===== ✅

  /**
   * ✅ ดึงคำทักทายตามเวลา
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    
    if (this.currentLanguage === 'th') {
      if (hour < 6) return 'ราตรีสวัสดิ์';
      if (hour < 12) return 'สวัสดีตอนเช้า';
      if (hour < 17) return 'สวัสดีตอนบ่าย';
      if (hour < 20) return 'สวัสดีตอนเย็น';
      return 'สวัสดีตอนค่ำ';
    } else {
      if (hour < 6) return 'Good night';
      if (hour < 12) return 'Good morning';
      if (hour < 17) return 'Good afternoon';
      if (hour < 20) return 'Good evening';
      return 'Good night';
    }
  }

  /**
   * ✅ ดึงข้อความตามภาษา
   */
  getText(en: string, th: string): string {
    return this.currentLanguage === 'th' ? th : en;
  }

  // ===== LANGUAGE MANAGEMENT ===== ✅

  /**
   * ✅ เปลี่ยนภาษา
   */
  switchLanguage(lang: string): void {
    if (['th', 'en'].includes(lang) && lang !== this.currentLanguage) {
      console.log('🌍 Switching language from', this.currentLanguage, 'to', lang);
      
      this.currentLanguage = lang;
      localStorage.setItem('language', lang);
      this.updatePageTitle();
      
      // ✅ สามารถ emit event เพื่อแจ้ง component อื่นได้
      this.broadcastLanguageChange(lang);
    }
  }

  /**
   * ✅ แจ้งการเปลี่ยนภาษาไปยัง component อื่น
   */
  private broadcastLanguageChange(language: string): void {
    const event = new CustomEvent('language-changed', {
      detail: { language }
    });
    window.dispatchEvent(event);
  }

  // ===== PAGE TITLE MANAGEMENT ===== ✅

  /**
   * ✅ อัปเดต page title ตาม route
   */
  private updatePageTitle(): void {
    const path = this.router.url;
    
    console.log('📄 Updating page title for path:', path);
    
    if (path.includes('/dashboard')) {
      this.pageTitle = this.getText('Dashboard', 'แดชบอร์ด');
    } else if (path.includes('/tickets/new') || path.includes('/tickets/create')) {
      this.pageTitle = this.getText('Create New Ticket', 'สร้างตั๋วใหม่');
    } else if (path.includes('/tickets/') && path.includes('/edit')) {
      this.pageTitle = this.getText('Edit Ticket', 'แก้ไขตั๋ว');
    } else if (path.includes('/tickets/') && !path.includes('/edit')) {
      this.pageTitle = this.getText('Ticket Details', 'รายละเอียดตั๋ว');
    } else if (path.includes('/tickets')) {
      this.pageTitle = this.getText('All Tickets', 'ตั๋วทั้งหมด');
    } else if (path.includes('/settings')) {
      this.pageTitle = this.getText('Settings', 'การตั้งค่า');
    } else if (path.includes('/reports')) {
      this.pageTitle = this.getText('Reports', 'รายงาน');
    } else {
      this.pageTitle = this.getText('Support Ticket System', 'ระบบตั๋วสนับสนุน');
    }
  }

  // ===== NAVIGATION METHODS ===== ✅

  /**
   * ✅ ไปหน้า profile
   */
  goToProfile(event: Event): void {
    event.preventDefault();
    console.log('👤 Navigating to profile');
    this.router.navigate(['/profile']);
  }

  /**
   * ✅ ไปหน้า settings
   */
  goToSettings(event: Event): void {
    event.preventDefault();
    console.log('⚙️ Navigating to settings');
    this.router.navigate(['/settings/general']);
  }

  /**
   * ✅ ไปหน้า dashboard
   */
  goToDashboard(): void {
    console.log('🏠 Navigating to dashboard');
    this.router.navigate(['/dashboard']);
  }

  // ===== LOGOUT FUNCTIONALITY ===== ✅

  /**
   * ✅ ออกจากระบบ
   */
  logout(event: Event): void {
    event.preventDefault();
    
    console.log('🚪 Logout requested');
    
    // ✅ แสดง confirmation dialog
    const confirmLogout = confirm(
      this.getText(
        'Are you sure you want to logout?', 
        'คุณต้องการออกจากระบบหรือไม่?'
      )
    );
    
    if (confirmLogout) {
      console.log('✅ Logout confirmed, proceeding...');
      this.performLogout();
    } else {
      console.log('❌ Logout cancelled by user');
    }
  }

  /**
   * ✅ ดำเนินการ logout
   */
  private performLogout(): void {
    this.isLoading = true;
    
    try {
      // ✅ เรียก AuthService logout
      this.authService.logout();
      console.log('✅ Logout completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // ✅ แม้จะ error ก็ force logout
      this.authService.clearAuthData();
    } finally {
      this.isLoading = false;
    }
  }

  // ===== TOKEN WARNING METHODS ===== ✅

  /**
   * ✅ รีเฟรช session ด้วยตนเอง
   */
  refreshSession(): void {
    console.log('🔄 Manual session refresh requested');
    
    this.isRefreshing = true;
    
    this.authService.manualRefresh().subscribe({
      next: (tokenData) => {
        console.log('✅ Manual token refresh successful:', tokenData);
        this.showTokenWarning = false;
        this.isRefreshing = false;
        this.updateTokenInfo();
      },
      error: (error) => {
        console.error('❌ Manual token refresh failed:', error);
        this.isRefreshing = false;
        // AuthService จะจัดการ auto logout
      }
    });
  }

  /**
   * ✅ ปิด token warning
   */
  dismissWarning(): void {
    console.log('❌ Token warning dismissed');
    this.showTokenWarning = false;
  }

  /**
   * ✅ ดึงข้อความเวลาที่เหลือ
   */
  getTimeLeftText(): string {
    if (!this.tokenInfo) return '';
    
    const minutes = this.tokenInfo.time_left_minutes;
    if (minutes <= 0) {
      return this.getText('Session expired', 'เซสชันหมดอายุแล้ว');
    }
    
    const timeText = minutes === 1 ? 
      this.getText('1 minute', '1 นาที') : 
      this.getText(`${minutes} minutes`, `${minutes} นาที`);
    
    return this.getText(
      `Session expires in ${timeText}`,
      `เซสชันจะหมดอายุใน ${timeText}`
    );
  }

  // ===== MOBILE MENU ===== ✅

  /**
   * ✅ เปิด/ปิด mobile menu
   */
  toggleMobileMenu(): void {
    console.log('📱 Mobile menu toggled');
    
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;
    
    if (sidebar && overlay) {
      const isOpen = sidebar.classList.contains('show');
      
      if (isOpen) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        body.classList.remove('mobile-menu-open');
      } else {
        sidebar.classList.add('show');
        overlay.classList.add('show');
        body.classList.add('mobile-menu-open');
      }
    }
  }

  // ===== UTILITY METHODS ===== ✅

  /**
   * ✅ ตรวจสอบว่าเป็น mobile หรือไม่
   */
  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  /**
   * ✅ ดึงสถานะ online/offline
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * ✅ ดึงข้อมูล browser info
   */
  getBrowserInfo(): string {
    return navigator.userAgent;
  }

  // ===== DEBUG METHODS ===== ✅

  /**
   * ✅ Debug header component state
   */
  debugHeaderState(): void {
    console.group('🔍 Header Component Debug');
    
    console.log('👤 User Info:', {
      hasUser: !!this.currentUser,
      username: this.currentUser?.username,
      fullName: this.getUserFullName(),
      initials: this.getUserInitials(),
      contact: this.getUserContact()
    });
    
    console.log('🔐 Auth Info:', {
      isAuthenticated: this.authService.isAuthenticated(),
      permissionCount: this.userPermissions.length,
      permissions: this.userPermissions
    });
    
    console.log('🎛️ Component State:', {
      currentLanguage: this.currentLanguage,
      pageTitle: this.pageTitle,
      showTokenWarning: this.showTokenWarning,
      isRefreshing: this.isRefreshing,
      isLoading: this.isLoading
    });
    
    if (this.tokenInfo) {
      console.log('🔑 Token Info:', this.tokenInfo);
    }
    
    console.groupEnd();
  }

  /**
   * ✅ Force refresh component data
   */
  forceRefresh(): void {
    console.log('🔄 Force refreshing header component');
    this.loadUserData();
    this.updateTokenInfo();
    this.updatePageTitle();
  }

  /**
   * ✅ Test authentication status
   */
  testAuthStatus(): void {
    console.log('🧪 Testing authentication status');
    this.authService.debugAuthStatus();
  }
}