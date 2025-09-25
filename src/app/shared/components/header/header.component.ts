import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

// ✅ Import Permission Models
import { permissionEnum, UserRole, ROLES } from '../../models/permission.model';
import { User, AuthState, UserWithPermissions } from '../../models/user.model';

// ✅ Import Permission Directives
import { HasPermissionDirective, HasRoleDirective } from '../../directives/permission.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HasPermissionDirective,  // ✅ Import permission directives
    HasRoleDirective
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);  // ✅ เปลี่ยนเป็น public
  private router = inject(Router);

  // ✅ User and Auth State with enhanced types
  currentUser: UserWithPermissions | null = null;
  authState: AuthState | null = null;
  userPermissions: number[] = [];  // ✅ เปลี่ยนเป็น number[]
  userRoles: UserRole[] = [];
  
  // ✅ UI State
  currentLanguage = 'th';
  isLoading = false;

  // ✅ Token Warning Properties
  showTokenWarning = false;
  isRefreshing = false;
  tokenInfo: any = null;

  // ✅ Permission Enums (for template usage)
  readonly permissionEnum = permissionEnum;
  readonly ROLES = ROLES;

  // ✅ Subscription Management
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    console.log('🔧 Header component initialized');
    this.initializeComponent();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    console.log('🧹 Header component cleanup');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== INITIALIZATION ===== ✅

  private initializeComponent(): void {
    this.loadUserData();
    this.loadLanguagePreference();
    this.loadTokenInfo();
    
    console.log('📋 Header initialized with:', {
      hasUser: !!this.currentUser,
      language: this.currentLanguage,
      permissionCount: this.userPermissions.length,
      roleCount: this.userRoles.length,
      primaryRole: this.getPrimaryRole()
    });
  }

  private setupSubscriptions(): void {
    // ✅ Subscribe to user changes
    const userSub = this.authService.currentUser$.subscribe(user => {
      console.log('👤 User data updated in header:', user?.username);
      this.updateUserData();
    });

    // ✅ Subscribe to auth state changes
    const authSub = this.authService.authState$.subscribe(state => {
      console.log('🔐 Auth state updated in header:', {
        isAuthenticated: state.isAuthenticated,
        hasUser: !!state.user,
        roleCount: state.roles.length,
        permissionCount: state.permissions.length
      });
      this.authState = state;
      this.userPermissions = state.permissions || [];
      this.userRoles = state.roles || [];
    });

    // ✅ Subscribe to token warning
    const warningSub = this.authService.getWarningStatus().subscribe(warning => {
      console.log('⚠️ Token warning status:', warning);
      this.showTokenWarning = warning;
      if (warning) {
        this.updateTokenInfo();
      }
    });

    this.subscriptions.push(userSub, authSub, warningSub);
  }

  // ===== DATA LOADING ===== ✅

  private loadUserData(): void {
    this.updateUserData();
    
    if (this.currentUser) {
      console.log('✅ User data loaded:', {
        id: this.currentUser.id,
        username: this.currentUser.username,
        fullName: this.getUserFullName(),
        primaryRole: this.getPrimaryRole()
      });
    }
  }

  private updateUserData(): void {
    this.currentUser = this.authService.getCurrentUserWithPermissions();
    this.userPermissions = this.authService.getUserPermissions();
    this.userRoles = this.authService.getUserRoles();
    
    if (this.currentUser) {
      this.updateTokenInfo();
    }
  }

  private loadLanguagePreference(): void {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && ['th', 'en'].includes(savedLanguage)) {
      this.currentLanguage = savedLanguage;
      console.log('🌍 Language preference loaded:', this.currentLanguage);
    }
  }

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

  private updateTokenInfo(): void {
    this.tokenInfo = this.authService.getTokenInfo();
  }

  // ===== USER INFO METHODS ===== ✅

  getUserFullName(): string {
    if (!this.currentUser) return '';
    
    const firstName = this.currentUser.firstname || '';
    const lastName = this.currentUser.lastname || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return this.currentUser.username || 'User';
  }

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

  getUserContact(): string {
    if (!this.currentUser) return '';
    return this.currentUser.email || this.currentUser.phone || '';
  }

  // ===== PERMISSION & ROLE METHODS ===== ✅

  hasPermission(permission: number): boolean {
    return this.authService.hasPermission(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  getPrimaryRole(): UserRole | null {
    return this.authService.getPrimaryRole();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isSupporter(): boolean {
    return this.authService.isSupporter();
  }

  isUser(): boolean {
    return this.authService.isUser();
  }

  getPermissionCount(): number {
    return this.userPermissions.length;
  }

  getRoleDisplay(): string {
    const primaryRole = this.getPrimaryRole();
    if (!primaryRole) return 'User';
    
    switch (primaryRole) {
      case ROLES.ADMIN: return this.currentLanguage === 'th' ? 'ผู้ดูแลระบบ' : 'Administrator';
      case ROLES.SUPPORTER: return this.currentLanguage === 'th' ? 'ผู้สนับสนุน' : 'Support Team';
      case ROLES.USER: return this.currentLanguage === 'th' ? 'ผู้ใช้งาน' : 'User';
      default: return primaryRole;
    }
  }

  // ===== GREETING METHODS ===== ✅

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

  getText(en: string, th: string): string {
    return this.currentLanguage === 'th' ? th : en;
  }

  // ===== LANGUAGE MANAGEMENT ===== ✅

  switchLanguage(lang: string): void {
    if (['th', 'en'].includes(lang) && lang !== this.currentLanguage) {
      console.log('🌍 Switching language from', this.currentLanguage, 'to', lang);
      
      this.currentLanguage = lang;
      localStorage.setItem('language', lang);
      
      this.broadcastLanguageChange(lang);
    }
  }

  private broadcastLanguageChange(language: string): void {
    const event = new CustomEvent('language-changed', {
      detail: { language }
    });
    window.dispatchEvent(event);
  }

  // ===== NAVIGATION METHODS ===== ✅

  goToProfile(event: Event): void {
    event.preventDefault();
    console.log('👤 Navigating to profile');
    this.router.navigate(['/profile']);
  }

  goToSettings(event: Event): void {
    event.preventDefault();
    console.log('⚙️ Navigating to settings');
    this.router.navigate(['/settings/general']);
  }

  goToDashboard(): void {
    console.log('🏠 Navigating to dashboard');
    this.router.navigate(['/dashboard']);
  }

  // ===== LOGOUT FUNCTIONALITY ===== ✅

  logout(event: Event): void {
    event.preventDefault();
    
    console.log('🚪 Logout requested');
    
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

  private performLogout(): void {
    this.isLoading = true;
    
    try {
      this.authService.logout();
      console.log('✅ Logout completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
      this.authService.clearAuthData();
    } finally {
      this.isLoading = false;
    }
  }

  // ===== TOKEN WARNING METHODS ===== ✅

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
      }
    });
  }

  dismissWarning(): void {
    console.log('❌ Token warning dismissed');
    this.showTokenWarning = false;
  }

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

  // ===== NOTIFICATION METHODS ===== ✅

  getNotificationCount(): number {
    // TODO: Implement notification system
    return 0;
  }

  hasUnreadNotifications(): boolean {
    return this.getNotificationCount() > 0;
  }

  markNotificationsAsRead(): void {
    // TODO: Implement notification system
    console.log('📬 Marking notifications as read');
  }

  // ===== UTILITY METHODS ===== ✅

  isOnline(): boolean {
    return navigator.onLine;
  }

  getBrowserInfo(): string {
    return navigator.userAgent;
  }

  // ===== DEBUG METHODS ===== ✅

  debugHeaderState(): void {
    console.group('🔍 Header Component Debug');
    
    console.log('👤 User Info:', {
      hasUser: !!this.currentUser,
      username: this.currentUser?.username,
      fullName: this.getUserFullName(),
      initials: this.getUserInitials(),
      contact: this.getUserContact(),
      primaryRole: this.getPrimaryRole(),
      roleDisplay: this.getRoleDisplay()
    });
    
    console.log('🔐 Auth Info:', {
      isAuthenticated: this.authService.isAuthenticated(),
      permissionCount: this.userPermissions.length,
      roleCount: this.userRoles.length,
      permissions: this.userPermissions,
      roles: this.userRoles,
      isAdmin: this.isAdmin(),
      isSupporter: this.isSupporter(),
      isUser: this.isUser()
    });
    
    console.log('🎛️ Component State:', {
      currentLanguage: this.currentLanguage,
      showTokenWarning: this.showTokenWarning,
      isRefreshing: this.isRefreshing,
      isLoading: this.isLoading
    });
    
    if (this.tokenInfo) {
      console.log('🔑 Token Info:', this.tokenInfo);
    }
    
    console.groupEnd();
  }

  forceRefresh(): void {
    console.log('🔄 Force refreshing header component');
    this.loadUserData();
    this.updateTokenInfo();
  }

  testAuthStatus(): void {
    console.log('🧪 Testing authentication status');
    this.authService.debugAuthStatus();
    this.authService.checkCurrentPermissionStatus();
  }

  // ✅ NEW: Method สำหรับ debug permission issue
  debugPermissionIssue(): void {
    console.group('🔍 Permission Issue Debug');
    
    // ✅ เรียก debug method ใน auth service
    this.authService.debugPermissionsInStorage();
    
    console.log('Header Component State:', {
      currentUser: this.currentUser,
      userPermissions: this.userPermissions,
      userRoles: this.userRoles,
      primaryRole: this.getPrimaryRole()
    });
    
    console.log('Auth Service Checks:', {
      isAuthenticated: this.authService.isAuthenticated(),
      isAdmin: this.authService.isAdmin(),
      isSupporter: this.authService.isSupporter(),
      isUser: this.authService.isUser(),
      canManageTickets: this.authService.canManageTickets(),
      canViewAllTickets: this.authService.canViewAllTickets(),
      rawPermissions: this.authService.getUserPermissions(),
      rawRoles: this.authService.getUserRoles()
    });
    
    // ✅ ตรวจสอบ permission เฉพาะๆ
    const supporterPermissions = [5, 6, 7, 8, 9, 10, 13];
    console.log('Supporter Permission Checks:', {
      hasChangeStatus: this.authService.hasPermission(5), // CHANGE_STATUS
      hasReplyTicket: this.authService.hasPermission(6), // REPLY_TICKET
      hasCloseTicket: this.authService.hasPermission(7), // CLOSE_TICKET
      hasSolveProblem: this.authService.hasPermission(8), // SOLVE_PROBLEM
      hasAssignee: this.authService.hasPermission(9), // ASSIGNEE
      hasOpenTicket: this.authService.hasPermission(10), // OPEN_TICKET
      hasViewAllTickets: this.authService.hasPermission(13) // VIEW_ALL_TICKETS
    });
    
    console.groupEnd();
    
    // ✅ แสดงใน alert เพื่อให้ user เห็น
    alert(`Current Role: ${this.getPrimaryRole()}\nPermissions: ${this.userPermissions.length}\nRoles: ${this.userRoles.join(', ')}\n\nSupporter Check: ${this.isSupporter()}\nCan Manage Tickets: ${this.canManageTickets()}`);
  }

  // ===== PERMISSION HELPERS FOR TEMPLATE ===== ✅

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  canCreateTickets(): boolean {
    return this.hasPermission(1); // CREATE_TICKET
  }

  canViewAllTickets(): boolean {
    return this.hasPermission(13); // VIEW_ALL_TICKETS
  }

  canManageUsers(): boolean {
    return this.authService.canManageUsers();
  }

  canManageTickets(): boolean {
    return this.authService.canManageTickets();
  }

  canAccessReports(): boolean {
    return this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canAccessSettings(): boolean {
    return true; // All authenticated users can access general settings
  }

  canAccessAdminPanel(): boolean {
    return this.isAdmin();
  }

  canAccessSupportPanel(): boolean {
    return this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }
}