import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Project interface
export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  company: string;
  company_id?: number;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
  start_date?: string;
  end_date?: string;
}

@Component({
  selector: 'app-project-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css']
})
export class ProjectComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search and filter properties
  searchTerm: string = '';
  selectedCompany: string = 'all';

  // Company options for filter
  companies = [
    { value: 'all', label: 'All Companies' },
    { value: 'tech-solutions', label: 'Tech Solutions Co., Ltd.' },
    { value: 'digital-marketing', label: 'Digital Marketing Inc.' },
    { value: 'innovation-hub', label: 'Innovation Hub Ltd.' },
    { value: 'creative-agency', label: 'Creative Agency Co.' },
    { value: 'startup-ventures', label: 'Startup Ventures Co.' }
  ];

  // Project data
  projects: ProjectItem[] = [];
  filteredProjects: ProjectItem[] = [];

  // Project stats
  projectStats = {
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
    this.loadProjectData();
    this.loadProjectStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * โหลดข้อมูล Project จาก API
   */
  loadProjectData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading project data...');

    // จำลอง API call (ปรับตามจริง)
    // this.apiService.getProjectsWithCache(forceRefresh)
    setTimeout(() => {
      try {
        // Mock data - ใช้แทน API response
        this.projects = this.getMockProjectData();
        this.filterProjects();
        this.isLoading = false;
        console.log('Project data loaded:', this.projects);
      } catch (error) {
        console.error('Error loading project data:', error);
        this.hasError = true;
        this.errorMessage = 'Failed to load project data. Please try again.';
        this.isLoading = false;
        this.loadFallbackData();
      }
    }, 1000);
  }

  /**
   * โหลดสถิติโปรเจค
   */
  loadProjectStats(): void {
    // จำลอง API call
    setTimeout(() => {
      this.projectStats = {
        total: this.projects.length,
        active: this.projects.filter(p => p.status === 'active').length,
        inactive: this.projects.filter(p => p.status === 'inactive').length,
        newThisMonth: 3
      };
      console.log('Project stats loaded:', this.projectStats);
    }, 500);
  }

  /**
   * Mock data สำหรับทดสอบ
   */
  private getMockProjectData(): ProjectItem[] {
    return [
      {
        id: 1,
        name: 'Support Ticket System',
        description: 'Customer support ticketing system',
        company: 'Tech Solutions Co., Ltd.',
        company_id: 1,
        status: 'active',
        created_date: '2024-01-15T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-27T14:30:00Z',
        updated_by: 1,
        start_date: '2024-01-15',
        end_date: '2025-12-31'
      },
      {
        id: 2,
        name: 'Digital Marketing Platform',
        description: 'Comprehensive marketing automation platform',
        company: 'Digital Marketing Inc.',
        company_id: 2,
        status: 'active',
        created_date: '2024-03-10T00:00:00Z',
        created_by: 1,
        updated_date: '2025-08-27T09:15:00Z',
        updated_by: 1,
        start_date: '2024-03-10',
        end_date: '2025-06-30'
      },
      {
        id: 3,
        name: 'Innovation Lab Portal',
        description: 'Internal innovation management system',
        company: 'Innovation Hub Ltd.',
        company_id: 3,
        status: 'active',
        created_date: '2024-05-20T00:00:00Z',
        created_by: 2,
        updated_date: '2025-08-25T16:45:00Z',
        updated_by: 2,
        start_date: '2024-05-20'
      },
      {
        id: 4,
        name: 'Creative Assets Manager',
        description: 'Digital asset management system',
        company: 'Creative Agency Co.',
        company_id: 4,
        status: 'inactive',
        created_date: '2024-02-01T00:00:00Z',
        created_by: 1,
        updated_date: '2025-07-15T10:30:00Z',
        updated_by: 3,
        start_date: '2024-02-01',
        end_date: '2024-12-31'
      },
      {
        id: 5,
        name: 'Startup Venture Tracker',
        description: 'Investment and startup tracking platform',
        company: 'Startup Ventures Co.',
        company_id: 5,
        status: 'active',
        created_date: '2024-07-01T00:00:00Z',
        created_by: 2,
        updated_date: '2025-08-20T12:00:00Z',
        updated_by: 1,
        start_date: '2024-07-01'
      }
    ];
  }

  /**
   * โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    this.projects = this.getMockProjectData();
    this.filterProjects();
  }

  /**
   * Filter projects based on search term and company
   */
  filterProjects(): void {
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(project, this.searchTerm.toLowerCase());

      const matchesCompany = this.selectedCompany === 'all' ||
        this.matchesCompanyFilter(project, this.selectedCompany);

      return matchesSearch && matchesCompany;
    });

    console.log('Filtered projects:', this.filteredProjects.length, 'of', this.projects.length);
  }

  /**
   * ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(project: ProjectItem, searchTerm: string): boolean {
    const searchableFields = [
      project.name || '',
      project.description || '',
      project.company || '',
      project.status || ''
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * ตรวจสอบว่าตรงกับ filter บริษัทหรือไม่
   */
  private matchesCompanyFilter(project: ProjectItem, companyValue: string): boolean {
    if (!project.company) return true;

    const companyName = this.getCompanyName(companyValue);
    return project.company.toLowerCase().includes(companyName.toLowerCase());
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
    this.filterProjects();
  }

  /**
   * Handle company filter change
   */
  onCompanyChange(): void {
    this.filterProjects();
  }

  /**
   * Navigate to create new project page
   */
  createNewProject(): void {
    console.log('Navigating to create new project page');
    this.router.navigate(['/settings/project-create']);
  }

  /**
   * Edit project - Navigate to edit page
   */
  editProject(projectId: number): void {
    console.log('Navigating to edit project:', projectId);
    this.router.navigate(['/settings/project-edit', projectId]);
  }

  /**
   * Delete project with confirmation
   */
  deleteProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }

    const confirmMessage = `Are you sure you want to delete project "${project.name}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteProject(projectId, project.name);
    }
  }

  /**
   * ลบ project จริงผ่าน API
   */
  private performDeleteProject(projectId: number, projectName: string): void {
    console.log('Deleting project:', { projectId, projectName });

    this.isLoading = true;

    // จำลอง API call
    setTimeout(() => {
      try {
        // ลบออกจาก local array
        this.projects = this.projects.filter(p => p.id !== projectId);
        this.filterProjects();

        // แสดงข้อความสำเร็จ
        alert(`Project "${projectName}" has been deleted successfully.`);

        this.isLoading = false;
        this.loadProjectStats();
      } catch (error) {
        console.error('Error deleting project:', error);
        alert(`Failed to delete project "${projectName}". Please try again.`);
        this.isLoading = false;
      }
    }, 1000);
  }

  /**
   * รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing project data...');
    this.loadProjectData(true);
  }

  /**
   * ✅ แก้ไข: ตรวจสอบสิทธิ์ในการจัดการโปรเจค (ใช้ permissions ใหม่)
   */
  canManageProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * ✅ แก้ไข: ตรวจสอบสิทธิ์ในการแก้ไข
   */
  canEditProject(project: ProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * ✅ แก้ไข: ตรวจสอบสิทธิ์ในการลบ (ใช้ permission เดียวกับการจัดการ)
   */
  canDeleteProject(project: ProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    // ใช้ MANAGE_PROJECT สำหรับการลบด้วย หรือใช้ DELETE_USER สำหรับ admin features
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * ✅ เพิ่มใหม่: ตรวจสอบสิทธิ์ในการสร้าง project ใหม่
   */
  canCreateProject(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * ✅ เพิ่มใหม่: ตรวจสอบสิทธิ์ในการดู project ทั้งหมด
   */
  canViewAllProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  /**
   * ✅ เพิ่มใหม่: ตรวจสอบว่าเป็น project owner หรือไม่
   */
  isProjectOwner(project: ProjectItem): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser !== null && project.created_by === currentUser.id;
  }

  /**
   * ✅ เพิ่มใหม่: ตรวจสอบสิทธิ์แบบละเอียด
   */
  canPerformAction(action: 'create' | 'edit' | 'delete' | 'view', project?: ProjectItem): boolean {
    switch (action) {
      case 'create':
        return this.canCreateProject();
      
      case 'view':
        return this.canViewAllProjects();
      
      case 'edit':
        if (!project) return false;
        return this.canEditProject(project);
      
      case 'delete':
        if (!project) return false;
        return this.canDeleteProject(project);
      
      default:
        return false;
    }
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByProjectId(index: number, project: ProjectItem): number {
    return project.id;
  }

  /**
   * Format date for display
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
   * Format datetime for display
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
   * Get project status display
   */
  getProjectStatus(project: ProjectItem): string {
    if (project.end_date) {
      const endDate = new Date(project.end_date);
      const now = new Date();
      if (endDate < now) {
        return 'Completed';
      }
    }

    return project.status === 'active' ? 'Active' : 'Inactive';
  }

  /**
   * ตรวจสอบว่าควรแสดงสถานะเป็น warning หรือไม่
   */
  isProjectStatusWarning(project: ProjectItem): boolean {
    return project.status === 'inactive' || this.getProjectStatus(project) === 'Completed';
  }

  /**
   * แสดงข้อมูลสถิติ
   */
  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.projectStats.total.toLocaleString(),
      active: this.projectStats.active.toLocaleString(),
      inactive: this.projectStats.inactive.toLocaleString(),
      newThisMonth: this.projectStats.newThisMonth.toLocaleString()
    };
  }

  /**
   * ✅ เพิ่มใหม่: ได้รับ permission description สำหรับแสดงผล
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการ project" เพื่อดำเนินการนี้';
  }

  /**
   * ✅ เพิ่มใหม่: แสดงข้อความเมื่อไม่มีสิทธิ์
   */
  showPermissionDeniedMessage(action: string): void {
    alert(`คุณไม่มีสิทธิ์ในการ${action}\n\n${this.getPermissionRequiredMessage()}`);
  }

  /**
   * ✅ เพิ่มใหม่: Wrapper methods ที่มีการตรวจสอบสิทธิ์
   */
  onCreateNewProject(): void {
    if (!this.canCreateProject()) {
      this.showPermissionDeniedMessage('สร้าง project ใหม่');
      return;
    }
    this.createNewProject();
  }

  onEditProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!this.canEditProject(project)) {
      this.showPermissionDeniedMessage('แก้ไข project');
      return;
    }
    this.editProject(projectId);
  }

  onDeleteProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!this.canDeleteProject(project)) {
      this.showPermissionDeniedMessage('ลบ project');
      return;
    }
    this.deleteProject(projectId);
  }
}