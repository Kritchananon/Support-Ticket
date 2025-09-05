import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// ✅ เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import {
  UserAccountItem,
  getUserFullName,
  getUserInitials,
  generateAvatarColor
} from '../../../shared/models/user.model';

import { permissionEnum } from '../../../shared/models/permission.model';

@Component({
  selector: 'app-user-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-account.component.html',
  styleUrls: ['./user-account.component.css']
})
export class UserAccountComponent implements OnInit, OnDestroy {

  // ✅ เปลี่ยนจาก mock data เป็นใช้ API
  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search and filter properties
  searchTerm: string = '';
  selectedCompany: string = 'all';

  // Company options for filter (เก็บไว้สำหรับ filter)
  companies = [
    { value: 'all', label: 'All Companies' },
    { value: 'tech-solutions', label: 'Tech Solutions Co., Ltd.' },
    { value: 'digital-marketing', label: 'Digital Marketing Inc.' },
    { value: 'innovation-hub', label: 'Innovation Hub Ltd.' },
    { value: 'creative-agency', label: 'Creative Agency Co.' },
    { value: 'startup-ventures', label: 'Startup Ventures Co.' }
  ];

  // ✅ เปลี่ยนเป็น UserAccountItem แทน User interface เดิม
  users: UserAccountItem[] = [];
  filteredUsers: UserAccountItem[] = [];

  // ✅ User stats (เพิ่มใหม่)
  userStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadUserAccountData();
    this.loadUserStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * ✅ NEW: โหลดข้อมูล User Account จาก API
   */
  loadUserAccountData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading user account data...');

    this.apiService.getUserAccountWithCache(forceRefresh)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          console.log('User account data loaded:', users);
          this.users = users;
          this.filterUsers();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading user account data:', error);
          this.hasError = true;
          this.errorMessage = 'Failed to load user data. Please try again.';
          this.isLoading = false;
          // แสดง fallback data
          this.loadFallbackData();
        }
      });
  }

  /**
   * ✅ NEW: โหลดสถิติผู้ใช้งาน
   */
  loadUserStats(): void {
    this.apiService.getUserStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.userStats = {
            total: stats.total_users,
            active: stats.active_users,
            inactive: stats.inactive_users,
            newThisMonth: stats.new_users_this_month
          };
          console.log('User stats loaded:', this.userStats);
        },
        error: (error) => {
          console.warn('Error loading user stats:', error);
        }
      });
  }

  /**
   * ✅ NEW: โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    // ใช้ข้อมูล mock เดิมเป็น fallback
    this.users = [
      {
        id: 1,
        username: 'wasan',
        firstname: 'Wasan',
        lastname: 'Rungsavang',
        email: 'wasan@company.com',
        phone: '02-123-4567',
        start_date: '2024-01-15',
        create_date: '2024-01-15T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-27T14:30:00Z',
        update_by: 1,
        isenabled: true,
        last_login: '2025-08-27T14:30:00Z',
        full_name: 'Wasan Rungsavang',
        avatar: 'W',
        avatarColor: '#5873F8',
        company: 'Tech Solutions Co., Ltd.'
      },
      {
        id: 2,
        username: 'somchai',
        firstname: 'Somchai',
        lastname: 'Jaidee',
        email: 'somchai@company.com',
        phone: '02-234-5678',
        start_date: '2024-03-10',
        create_date: '2024-03-10T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-27T09:15:00Z',
        update_by: 1,
        isenabled: true,
        last_login: '2025-08-27T09:15:00Z',
        full_name: 'Somchai Jaidee',
        avatar: 'S',
        avatarColor: '#28A745',
        company: 'Digital Marketing Inc.'
      }
    ];
    this.filterUsers();
  }

  /**
   * ✅ UPDATED: Filter users based on search term and company
   */
  filterUsers(): void {
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(user, this.searchTerm.toLowerCase());

      const matchesCompany = this.selectedCompany === 'all' ||
        this.matchesCompanyFilter(user, this.selectedCompany);

      return matchesSearch && matchesCompany;
    });

    console.log('Filtered users:', this.filteredUsers.length, 'of', this.users.length);
  }

  /**
   * ✅ NEW: ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(user: UserAccountItem, searchTerm: string): boolean {
    const searchableFields = [
      user.firstname || '',
      user.lastname || '',
      user.username || '',
      user.email || '',
      user.full_name || '',
      user.company || '',
      user.company_address || '',
      user.phone || ''
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * ✅ NEW: ตรวจสอบว่าตรงกับ filter บริษัทหรือไม่
   */
  private matchesCompanyFilter(user: UserAccountItem, companyValue: string): boolean {
    if (!user.company) return true;

    const companyName = this.getCompanyName(companyValue);
    return user.company.toLowerCase().includes(companyName.toLowerCase());
  }

  /**
   * Get company name from value
   */
  getCompanyName(value: string): string {
    const company = this.companies.find(c => c.value === value);
    return company ? company.label : '';
  }

  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.filterUsers();
  }

  /**
   * Handle company filter change
   */
  onCompanyChange(): void {
    this.filterUsers();
  }

  /**
   * ✅ UPDATED: Navigate to create new user page
   */
  createNewUser(): void {
    console.log('Navigating to create new user page');
    this.router.navigate(['/settings/user-create']);
  }

  /**
   * ✅ UPDATED: Edit user - Navigate to edit page
   */
  editUser(userId: number): void {
    console.log('Navigating to edit user:', userId);
    this.router.navigate(['/settings/user-edit', userId]);
  }

  /**
   * ✅ UPDATED: Delete user with API call
   */
  deleteUser(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      console.error('User not found:', userId);
      return;
    }

    const userName = getUserFullName(user);
    const confirmMessage = `Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteUser(userId, userName);
    }
  }

  /**
   * ✅ NEW: ลบ user จริงผ่าน API
   */
  private performDeleteUser(userId: number, userName: string): void {
    console.log('Deleting user:', { userId, userName });

    // แสดง loading state
    this.isLoading = true;

    this.apiService.deleteUser(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('User deleted successfully:', response);

          // ลบออกจาก local array
          this.users = this.users.filter(u => u.id !== userId);
          this.filterUsers();

          // แสดงข้อความสำเร็จ
          alert(`User "${userName}" has been deleted successfully.`);

          this.isLoading = false;

          // รีเฟรชสถิติ
          this.loadUserStats();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          alert(`Failed to delete user "${userName}". Please try again.`);
          this.isLoading = false;
        }
      });
  }

  /**
   * ✅ NEW: รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing user data...');
    this.apiService.clearUserAccountCache();
    this.loadUserAccountData(true);
  }

  /**
   * ✅ NEW: ตรวจสอบสิทธิ์ในการจัดการผู้ใช้
   */
  canManageUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.ADD_USER) ||
      this.authService.hasPermission(permissionEnum.DEL_USER) ||
      this.authService.isAdmin();
  }

  /**
   * ✅ NEW: ตรวจสอบสิทธิ์ในการแก้ไข
   */
  canEditUser(user: UserAccountItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      return false;
    }

    return this.authService.hasPermission(permissionEnum.ADD_USER);
  }

  /**
   * ✅ NEW: ตรวจสอบสิทธิ์ในการลบ
   */
  canDeleteUser(user: UserAccountItem): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id === user.id) {
      return false;
    }

    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.DEL_USER);
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByUserId(index: number, user: UserAccountItem): number {
    return user.id;
  }

  /**
   * ✅ UPDATED: Format date for display
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }

  /**
   * ✅ UPDATED: Format datetime for display
   */
  formatDateTime(dateTimeString: string | undefined): string {
    if (!dateTimeString) return 'N/A';

    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting datetime:', dateTimeString, error);
      return 'N/A';
    }
  }

  /**
   * ✅ NEW: ดึงชื่อเต็มของผู้ใช้
   */
  getUserDisplayName(user: UserAccountItem): string {
    // ลองหาชื่อจาก fields ต่างๆ
    if (user.full_name) {
      return user.full_name;
    }

    if (user.firstname || user.lastname) {
      return `${user.firstname || ''} ${user.lastname || ''}`.trim();
    }

    if (user.username) {
      return user.username;
    }

    return 'Unknown User';
  }

  /**
   * ✅ NEW: ดึงอักษรย่อสำหรับ avatar
   */
  getUserAvatar(user: UserAccountItem): string {
    return user.avatar || getUserInitials(user);
  }

  /**
   * ✅ NEW: ดึงสี avatar
   */
  getUserAvatarColor(user: UserAccountItem): string {
    return user.avatarColor || generateAvatarColor(user.id);
  }

  /**
   * ✅ NEW: ตรวจสอบสถานะ user
   */
  getUserStatus(user: UserAccountItem): string {
    if (!user.isenabled) {
      return 'Disabled';
    }

    if (user.end_date) {
      const endDate = new Date(user.end_date);
      const now = new Date();
      if (endDate < now) {
        return 'Expired';
      }
    }

    return 'Active';
  }

  /**
   * ✅ NEW: ตรวจสอบว่าควรแสดงสถานะเป็น warning หรือไม่
   */
  isUserStatusWarning(user: UserAccountItem): boolean {
    return !user.isenabled || this.getUserStatus(user) === 'Expired';
  }

  /**
   * ✅ NEW: แสดงข้อมูลสถิติ
   */
  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.userStats.total.toLocaleString(),
      active: this.userStats.active.toLocaleString(),
      inactive: this.userStats.inactive.toLocaleString(),
      newThisMonth: this.userStats.newThisMonth.toLocaleString()
    };
  }
}