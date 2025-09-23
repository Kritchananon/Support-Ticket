import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// ============ INTERFACES ============
export interface CFPCustomerData {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  projects: CFPProjectData[];
}

export interface CFPProjectData {
  project_id: number;
  project_name: string;
  project_status: boolean;
  assigned_users: string[];
  project_count: number;
  user_count: number;
  open_ticket_count: number;
}

export interface CustomerItem {
  id: number;
  company: string;
  address: string;
  email: string;
  phone: string;
  tier: 'Enterprise' | 'Premium' | 'Standard';
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
  total_projects?: number;
  total_users?: number;
  total_open_tickets?: number;
}

export interface CustomerProjectItem {
  id: number;
  customer_id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'completed';
  priority: 'high' | 'medium' | 'low';
  start_date?: string;
  end_date?: string;
  budget?: number;
  estimated_hours?: number;
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
  project_manager_id?: number;
  open_tickets_count?: number;
  assigned_users?: CustomerUserItem[];
  assigned_user_names?: string[];
  user_count?: number;
}

export interface CustomerUserItem {
  id: number;
  customer_id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  is_primary_contact: boolean;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
}

export interface CustomerStats {
  total_projects: number;
  active_projects: number;
  total_users: number;
  open_tickets: number;
}

// Backend API Interfaces
export interface ProjectDDLItem {
  id: number;
  name: string;
  description?: string;
  status?: string;
  current_users_count?: number;
  estimated_hours?: number;
  budget?: number;
}

export interface SystemUser {
  id: number;
  name?: string;
  username?: string;
  email: string;
  role?: string;
  department?: string;
  is_available?: boolean;
  current_projects_count?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  phone?: string;
}

export interface CreateCustomerForProjectDto {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  project_id: number;
  assigned_user_ids: number[];
  create_by?: number;
  update_by?: number;
}

export interface UpdateCustomerForProjectDto {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  create_by?: number;
  update_by?: number;
}

@Component({
  selector: 'app-customer-for-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customer-for-project.component.html',
  styleUrls: ['./customer-for-project.component.css']
})
export class CustomerForProjectComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ============ COMPONENT STATE ============
  isLoading = false;
  isProjectsLoading = false;
  hasError = false;
  errorMessage = '';
  isSubmitting = false;

  // Search and filter
  customerSearchTerm = '';
  projectSearchTerm = '';
  selectedStatusFilter = 'all';
  userSearchTerm = '';

  // Data arrays
  customers: CustomerItem[] = [];
  filteredCustomers: CustomerItem[] = [];
  selectedCustomer: CustomerItem | null = null;
  customerProjects: CustomerProjectItem[] = [];
  filteredProjects: CustomerProjectItem[] = [];
  customerUsers: CustomerUserItem[] = [];
  customerStats: CustomerStats | null = null;
  cfpData: CFPCustomerData[] = [];

  // Modal states
  isAssignProjectModalVisible = false;
  isEditCustomerModalVisible = false;

  // Assign project data
  availableProjects: ProjectDDLItem[] = [];
  systemUsers: SystemUser[] = [];
  selectedProject: ProjectDDLItem | null = null;
  selectedUsers: SystemUser[] = [];
  filteredUsers: SystemUser[] = [];
  isLoadingProjects = false;
  isLoadingUsers = false;

  // Forms
  assignProjectForm!: FormGroup;
  customerForm!: FormGroup;

  // Options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'completed', label: 'Completed' }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadCFPData();
    this.handleQueryParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ INITIALIZATION ============
  private initForms(): void {
    this.assignProjectForm = this.fb.group({
      project_id: ['', [Validators.required]],
      assigned_user_ids: [[], [Validators.required, Validators.minLength(1)]]
    });

    this.customerForm = this.fb.group({
      customer_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      customer_email: ['', [Validators.required, Validators.email]],
      customer_phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]]
    });

    // Initialize project form
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [''],
      priority: ['medium', [Validators.required]],
      start_date: [''],
      end_date: [''],
      status: ['active', [Validators.required]]
    });

    // Initialize user form
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
      role: ['End User', [Validators.required]],
      department: [''],
      is_primary_contact: [false]
    });
  }

  private handleQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      if (params['customer']) {
        const customerId = parseInt(params['customer']);
        setTimeout(() => this.selectCustomerById(customerId), 500);
      }
    });
  }

  // ============ DATA LOADING ============
  loadCFPData(): void {
    this.isLoading = true;
    this.hasError = false;

    this.apiService.get('customer-for-project/cfp-data')
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response?.status === 1 && response.data) {
            this.cfpData = response.data;
            this.transformCFPDataToCustomers();
          } else {
            // this.customers = this.getMockCustomers();
          }
          this.filterCustomers();
        },
        error: () => {
          this.isLoading = false;
          // this.customers = this.getMockCustomers();
          this.filterCustomers();
        }
      });
  }

  private transformCFPDataToCustomers(): void {
    this.customers = this.cfpData.map(cfpCustomer => {
      const totalProjects = cfpCustomer.projects.length;
      const activeProjects = cfpCustomer.projects.filter(p => p.project_status).length;
      const totalUsers = cfpCustomer.projects.reduce((sum, p) => sum + p.user_count, 0);
      const totalOpenTickets = cfpCustomer.projects.reduce((sum, p) => sum + p.open_ticket_count, 0);

      let tier: 'Enterprise' | 'Premium' | 'Standard' = 'Standard';
      if (totalProjects >= 5) tier = 'Enterprise';
      else if (totalProjects >= 2) tier = 'Premium';

      return {
        id: cfpCustomer.customer_id,
        company: cfpCustomer.customer_name,
        address: '',
        email: cfpCustomer.customer_email,
        phone: cfpCustomer.customer_phone,
        tier,
        status: 'active' as const,
        created_date: new Date().toISOString(),
        created_by: 1,
        total_projects: totalProjects,
        total_users: totalUsers,
        total_open_tickets: totalOpenTickets
      };
    });
  }

  // ============ CUSTOMER MANAGEMENT ============
  selectCustomer(customer: CustomerItem): void {
    this.selectedCustomer = customer;
    this.updateUrl(customer.id);
    this.loadCustomerData(customer.id);
  }

  selectCustomerById(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      this.selectCustomer(customer);
    }
  }

  private updateUrl(customerId: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customer: customerId },
      queryParamsHandling: 'merge'
    });
  }

  private loadCustomerData(customerId: number): void {
    const cfpCustomer = this.cfpData.find(c => c.customer_id === customerId);

    if (cfpCustomer) {
      this.customerProjects = cfpCustomer.projects.map(p => ({
        id: p.project_id,
        customer_id: customerId,
        name: p.project_name,
        description: `Project with ${p.user_count} assigned users`,
        status: p.project_status ? 'active' as const : 'inactive' as const,
        priority: 'medium' as const,
        created_date: new Date().toISOString(),
        created_by: 1,
        open_tickets_count: p.open_ticket_count,
        assigned_user_names: p.assigned_users,
        user_count: p.user_count,
        assigned_users: []
      }));

      this.customerStats = {
        total_projects: cfpCustomer.projects.length,
        active_projects: cfpCustomer.projects.filter(p => p.project_status).length,
        total_users: cfpCustomer.projects.reduce((sum, p) => sum + p.user_count, 0),
        open_tickets: cfpCustomer.projects.reduce((sum, p) => sum + p.open_ticket_count, 0)
      };

      this.customerUsers = this.generateUsersFromNames(customerId, cfpCustomer.projects);
      this.filterProjects();
    }
  }

  private generateUsersFromNames(customerId: number, projects: CFPProjectData[]): CustomerUserItem[] {
    const uniqueUserNames = new Set<string>();
    projects.forEach(project => {
      project.assigned_users.forEach(userName => uniqueUserNames.add(userName));
    });

    return Array.from(uniqueUserNames).map((userName, index) => ({
      id: index + 1,
      customer_id: customerId,
      name: userName,
      email: `${userName.toLowerCase().replace(/\s+/g, '.')}@customer.com`,
      phone: `+66-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      role: index === 0 ? 'Project Manager' : 'End User',
      department: index === 0 ? 'IT' : 'Operations',
      is_primary_contact: index === 0,
      status: 'active',
      created_date: new Date().toISOString(),
      created_by: 1
    }));
  }

  clearCustomerSelection(): void {
    this.selectedCustomer = null;
    this.customerProjects = [];
    this.filteredProjects = [];
    this.customerUsers = [];
    this.customerStats = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customer: null },
      queryParamsHandling: 'merge'
    });
  }

  // ============ EDIT CUSTOMER ============
  openEditCustomerModal(): void {
    if (!this.selectedCustomer) return;

    this.isEditCustomerModalVisible = true;
    this.customerForm.patchValue({
      customer_name: this.selectedCustomer.company,
      customer_email: this.selectedCustomer.email,
      customer_phone: this.selectedCustomer.phone
    });
  }

  closeEditCustomerModal(): void {
    if (!this.isSubmitting) {
      this.customerForm.reset();
      this.isEditCustomerModalVisible = false;
    }
  }

  onSubmitCustomer(): void {
    if (!this.selectedCustomer || !this.customerForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData: UpdateCustomerForProjectDto = {
      customer_name: this.customerForm.get('customer_name')?.value?.trim(),
      customer_email: this.customerForm.get('customer_email')?.value?.trim(),
      customer_phone: this.customerForm.get('customer_phone')?.value?.trim() || undefined
    };

    this.apiService.patch(`customer-for-project/cfp/update/${this.selectedCustomer.id}`, formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response?.status === 1) {
            this.updateCustomerData(formData);
            this.closeEditCustomerModal();
            this.showSuccess('Customer updated successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to update customer');
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to update customer');
        }
      });
  }

  private updateCustomerData(data: UpdateCustomerForProjectDto): void {
    if (this.selectedCustomer && data) {
      this.selectedCustomer.company = data.customer_name || this.selectedCustomer.company;
      this.selectedCustomer.email = data.customer_email || this.selectedCustomer.email;
      this.selectedCustomer.phone = data.customer_phone || this.selectedCustomer.phone;

      const customerIndex = this.customers.findIndex(c => c.id === this.selectedCustomer?.id);
      if (customerIndex >= 0) {
        Object.assign(this.customers[customerIndex], this.selectedCustomer);
      }
      this.filterCustomers();
    }
  }

  deleteCustomer(): void {
    if (!this.selectedCustomer) return;

    const confirmMessage = `Are you sure you want to delete customer "${this.selectedCustomer.company}"?`;
    if (confirm(confirmMessage)) {
      this.performDeleteCustomer();
    }
  }

  private performDeleteCustomer(): void {
    if (!this.selectedCustomer) return;

    this.isLoading = true;
    const customerId = this.selectedCustomer.id;
    const customerName = this.selectedCustomer.company;

    this.apiService.delete(`customer-for-project/cfp/delete/${customerId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response?.status === 1) {
            this.customers = this.customers.filter(c => c.id !== customerId);
            this.cfpData = this.cfpData.filter(c => c.customer_id !== customerId);
            this.filterCustomers();
            this.clearCustomerSelection();
            this.showSuccess(`Customer "${customerName}" deleted successfully`);
          } else {
            this.showError('Failed to delete customer');
          }
        },
        error: () => {
          this.isLoading = false;
          this.showError('Failed to delete customer');
        }
      });
  }

  // ============ CREATE PROJECT & USER MODALS ============
  isCreateProjectModalVisible = false;
  isCreateUserModalVisible = false;
  projectForm!: FormGroup;
  userForm!: FormGroup;

  openCreateProjectModal(): void {
    if (!this.selectedCustomer) return;

    this.isCreateProjectModalVisible = true;
    this.resetProjectForm();
  }

  closeCreateProjectModal(): void {
    if (!this.isSubmitting) {
      this.resetProjectForm();
      this.isCreateProjectModalVisible = false;
    }
  }

  openCreateUserModal(): void {
    if (!this.selectedCustomer) return;

    this.isCreateUserModalVisible = true;
    this.resetUserForm();
  }

  closeCreateUserModal(): void {
    if (!this.isSubmitting) {
      this.resetUserForm();
      this.isCreateUserModalVisible = false;
    }
  }

  private resetProjectForm(): void {
    if (!this.projectForm) {
      this.projectForm = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        description: [''],
        priority: ['medium', [Validators.required]],
        start_date: [''],
        end_date: [''],
        status: ['active', [Validators.required]]
      });
    }
    this.projectForm.reset({
      priority: 'medium',
      status: 'active'
    });
  }

  private resetUserForm(): void {
    if (!this.userForm) {
      this.userForm = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
        role: ['End User', [Validators.required]],
        department: [''],
        is_primary_contact: [false]
      });
    }
    this.userForm.reset({
      role: 'End User',
      is_primary_contact: false
    });
  }

  onSubmitProject(): void {
    if (!this.selectedCustomer || !this.projectForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData = {
      customer_id: this.selectedCustomer.id,
      name: this.projectForm.get('name')?.value?.trim(),
      description: this.projectForm.get('description')?.value?.trim() || undefined,
      priority: this.projectForm.get('priority')?.value,
      start_date: this.projectForm.get('start_date')?.value || undefined,
      end_date: this.projectForm.get('end_date')?.value || undefined,
      status: this.projectForm.get('status')?.value
    };

    this.apiService.post('customer-projects', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.data?.id || response.id)) {
            const createdProject = response.data || response;
            this.onProjectCreated(createdProject);
            this.closeCreateProjectModal();
            this.showSuccess('Project created successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to create project');
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to create project');
        }
      });
  }

  onSubmitUser(): void {
    if (!this.selectedCustomer || !this.userForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData = {
      customer_id: this.selectedCustomer.id,
      name: this.userForm.get('name')?.value?.trim(),
      email: this.userForm.get('email')?.value?.trim(),
      phone: this.userForm.get('phone')?.value?.trim() || undefined,
      role: this.userForm.get('role')?.value,
      department: this.userForm.get('department')?.value?.trim() || undefined,
      is_primary_contact: this.userForm.get('is_primary_contact')?.value || false
    };

    this.apiService.post('customer-users', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.data?.id || response.id)) {
            const createdUser = response.data || response;
            this.onUserCreated(createdUser);
            this.closeCreateUserModal();
            this.showSuccess('User created successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to create user');
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to create user');
        }
      });
  }

  private onProjectCreated(newProject: CustomerProjectItem): void {
    this.customerProjects.unshift(newProject);
    this.filterProjects();
    if (this.customerStats) {
      this.customerStats.total_projects++;
      if (newProject.status === 'active') {
        this.customerStats.active_projects++;
      }
    }
  }

  private onUserCreated(newUser: CustomerUserItem): void {
    this.customerUsers.unshift(newUser);
    if (this.customerStats) {
      this.customerStats.total_users++;
    }
  }

  getProjectDescriptionLength(): number {
    return this.projectForm?.get('description')?.value?.length || 0;
  }

  // Add loadCustomers method for template compatibility
  loadCustomers(): void {
    this.loadCFPData();
  }

  // ============ ASSIGN PROJECT ============
  openAssignProjectModal(): void {
    if (!this.selectedCustomer) return;

    this.isAssignProjectModalVisible = true;
    this.resetAssignProjectForm();
    this.loadProjectDDL();
    this.loadAllUsers();
  }

  closeAssignProjectModal(): void {
    if (!this.isSubmitting) {
      this.resetAssignProjectForm();
      this.isAssignProjectModalVisible = false;
    }
  }

  private resetAssignProjectForm(): void {
    this.assignProjectForm.reset();
    this.selectedProject = null;
    this.selectedUsers = [];
    this.filteredUsers = [];
    this.userSearchTerm = '';
  }

  private loadProjectDDL(): void {
    this.isLoadingProjects = true;

    this.apiService.get('projects/all')
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of({ code: 0, data: null }))
      )
      .subscribe({
        next: (response: any) => {
          this.isLoadingProjects = false;
          if (response?.code === 1 && response.data) {
            this.availableProjects = response.data;
          } else {
            // this.availableProjects = this.getMockProjects();
          }
        },
        error: () => {
          this.isLoadingProjects = false;
          // this.availableProjects = this.getMockProjects();
        }
      });
  }

  private loadAllUsers(): void {
    this.isLoadingUsers = true;

    this.apiService.get('users/Allusers')
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([]))
      )
      .subscribe({
        next: (response: any) => {
          this.isLoadingUsers = false;
          const userData = Array.isArray(response) ? response :
            response?.data ? response.data :
              response?.status === 1 && response.data ? response.data : [];

          this.systemUsers = this.transformUsersResponse(userData);
          this.filteredUsers = [...this.systemUsers];
        },
        error: () => {
          this.isLoadingUsers = false;
          // this.systemUsers = this.getMockUsers();
          this.filteredUsers = [...this.systemUsers];
        }
      });
  }

  private transformUsersResponse(users: any[]): SystemUser[] {
    if (!Array.isArray(users)) return [];

    return users.map(user => ({
      id: user.id,
      name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      username: user.username,
      email: user.email,
      role: user.role || user.position || 'User',
      department: user.department,
      first_name: user.first_name,
      last_name: user.last_name,
      position: user.position,
      phone: user.phone,
      is_available: true,
      current_projects_count: 0
    }));
  }

  onProjectSelect(): void {
    const projectId = this.assignProjectForm.get('project_id')?.value;
    this.selectedProject = this.availableProjects.find(p => p.id === parseInt(projectId)) || null;
  }

  toggleUserSelection(user: SystemUser): void {
    // ✅ เพิ่ม user เท่านั้น ถ้ายังไม่ได้เลือก
    if (!this.selectedUsers.some(u => u.id === user.id)) {
      this.selectedUsers.push(user);

      this.assignProjectForm.patchValue({
        assigned_user_ids: this.selectedUsers.map(u => u.id)
      });

      // ✅ ซ่อน user ที่เลือกไปแล้วออกจากรายการ
      this.filterUsers();
    }
  }

  removeSelectedUser(user: SystemUser): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);

      this.assignProjectForm.patchValue({
        assigned_user_ids: this.selectedUsers.map(u => u.id)
      });

      // ✅ แสดง user กลับในรายการ
      this.filterUsers();
    }
  }

  onSubmitAssignProject(): void {
    if (!this.selectedCustomer || !this.assignProjectForm.valid ||
      this.isSubmitting || this.selectedUsers.length === 0) {
      if (this.selectedUsers.length === 0) {
        this.showError('Please select at least one user');
      }
      return;
    }

    this.isSubmitting = true;
    const formData: CreateCustomerForProjectDto = {
      customer_name: this.selectedCustomer.company,
      customer_email: this.selectedCustomer.email,
      customer_phone: this.selectedCustomer.phone || '',
      project_id: parseInt(this.assignProjectForm.get('project_id')?.value),
      assigned_user_ids: this.selectedUsers.map(user => user.id)
    };

    this.apiService.post('customer-for-project', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.status === 1 || response.code === 1)) {
            this.onProjectAssignedSuccess();
            this.closeAssignProjectModal();
            this.showSuccess('Project assigned successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to assign project');
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to assign project');
        }
      });
  }

  private onProjectAssignedSuccess(): void {
    if (this.selectedProject && this.selectedCustomer) {
      const newProject: CustomerProjectItem = {
        id: Math.floor(Math.random() * 1000),
        customer_id: this.selectedCustomer.id,
        name: this.selectedProject.name,
        description: `Project assigned with ${this.selectedUsers.length} users`,
        status: 'active',
        priority: 'medium',
        created_date: new Date().toISOString(),
        created_by: 1,
        open_tickets_count: 0,
        assigned_user_names: this.selectedUsers.map(u => this.getUserDisplayName(u)),
        user_count: this.selectedUsers.length,
        assigned_users: []
      };

      this.customerProjects.unshift(newProject);
      this.filterProjects();

      if (this.customerStats) {
        this.customerStats.total_projects++;
        this.customerStats.active_projects++;
        this.customerStats.total_users += this.selectedUsers.length;
      }
    }
  }

  // ============ FILTERING ============
  filterCustomers(): void {
    const searchTerm = this.customerSearchTerm.toLowerCase();
    this.filteredCustomers = this.customers.filter(customer =>
      !searchTerm ||
      customer.company.toLowerCase().includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm)
    );
  }

  filterProjects(): void {
    const searchTerm = this.projectSearchTerm.toLowerCase();
    this.filteredProjects = this.customerProjects.filter(project => {
      const matchesSearch = !searchTerm ||
        project.name.toLowerCase().includes(searchTerm) ||
        (project.description && project.description.toLowerCase().includes(searchTerm));

      const matchesStatus = this.selectedStatusFilter === 'all' ||
        project.status === this.selectedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  onUserSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.userSearchTerm = input.value;
    this.filterUsers();
  }

  filterUsers(): void {
    const searchTerm = this.userSearchTerm.toLowerCase();

    this.filteredUsers = this.systemUsers.filter(user => {
      const displayName = this.getUserDisplayName(user);

      const matchSearch =
        !searchTerm ||
        displayName.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.role && user.role.toLowerCase().includes(searchTerm));

      const notSelected = !this.selectedUsers.some(u => u.id === user.id);

      return matchSearch && notSelected;
    });
  }


  // Event handlers
  onCustomerSearchChange(): void { this.filterCustomers(); }
  onProjectSearchChange(): void { this.filterProjects(); }
  onStatusFilterChange(): void { this.filterProjects(); }

  // ============ PROJECT ACTIONS ============
  editProject(projectId: number): void {
    this.router.navigate(['/settings/project-edit', projectId]);
  }

  viewProject(projectId: number): void {
    this.router.navigate(['/projects', projectId]);
  }

  deleteProject(projectId: number): void {
    const project = this.customerProjects.find(p => p.id === projectId);
    if (!project) return;

    if (confirm(`Delete project "${project.name}"?`)) {
      this.isProjectsLoading = true;
      this.apiService.delete(`customer-projects/${projectId}`)
        .subscribe({
          next: () => {
            this.customerProjects = this.customerProjects.filter(p => p.id !== projectId);
            this.filterProjects();
            if (this.customerStats) this.customerStats.total_projects--;
            this.showSuccess('Project deleted successfully');
            this.isProjectsLoading = false;
            this.loadCFPData();
          },
          error: () => {
            this.isProjectsLoading = false;
            this.showError('Failed to delete project');
          }
        });
    }
  }

  exportCustomerData(): void {
    this.showSuccess('Export feature will be implemented soon');
  }

  refreshCustomerData(): void {
    if (this.selectedCustomer) {
      const selectedId = this.selectedCustomer.id;
      this.loadCFPData();
      setTimeout(() => this.loadCustomerData(selectedId), 100);
    } else {
      this.loadCFPData();
    }
  }

  // ============ UTILITY METHODS ============
  isFieldInvalid(formName: 'customer' | 'assign' | 'project' | 'user', fieldName: string): boolean {
    let form: FormGroup;

    switch (formName) {
      case 'customer':
        form = this.customerForm;
        break;
      case 'assign':
        form = this.assignProjectForm;
        break;
      case 'project':
        form = this.projectForm;
        break;
      case 'user':
        form = this.userForm;
        break;
      default:
        return false;
    }

    const field = form?.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getCustomerAvatarLetter(companyName: string): string {
    return companyName ? companyName.charAt(0).toUpperCase() : '?';
  }

  getProjectAvatarLetter(projectName: string): string {
    return projectName ? projectName.charAt(0).toUpperCase() : '?';
  }

  getUserAvatarLetter(user: string | SystemUser | undefined): string {
    if (!user) return '?';
    if (typeof user === 'string') {
      return user ? user.charAt(0).toUpperCase() : '?';
    }
    const displayName = this.getUserDisplayName(user);
    return displayName ? displayName.charAt(0).toUpperCase() : '?';
  }

  getUserDisplayName(user: SystemUser): string {
    return user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  }

  getTierBadgeClass(tier: string): string {
    const tierMap: { [key: string]: string } = {
      enterprise: 'tier-enterprise',
      premium: 'tier-premium',
      standard: 'tier-standard'
    };
    return tierMap[tier.toLowerCase()] || 'tier-default';
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      active: 'status-active',
      inactive: 'status-inactive',
      completed: 'status-completed'
    };
    return statusMap[status.toLowerCase()] || 'status-default';
  }

  getPriorityBadgeClass(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      high: 'priority-high',
      medium: 'priority-medium',
      low: 'priority-low'
    };
    return priorityMap[priority.toLowerCase()] || 'priority-default';
  }

  getTicketsCountClass(count: number): string {
    if (count === 0) return 'tickets-zero';
    if (count > 5) return 'tickets-high';
    return 'tickets-medium';
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }

  // ============ PERMISSION METHODS ============
  canManageCustomerProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canCreateProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canEditCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER) || this.authService.isAdmin();
  }

  canDeleteCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER) || this.authService.isAdmin();
  }

  canEditProject(project: CustomerProjectItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canDeleteProject(project: CustomerProjectItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canCreateUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  // ============ TRACK BY FUNCTIONS ============
  trackByCustomerId(index: number, customer: CustomerItem): number {
    return customer.id;
  }

  trackByProjectId(index: number, project: CustomerProjectItem): number {
    return project.id;
  }

  trackByUserId(index: number, user: CustomerUserItem): number {
    return user.id;
  }

  // ============ ERROR HANDLING ============
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);

    if (error.status === 401) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }

    return of(null);
  }

  private showSuccess(message: string): void {
    // Replace with your toast notification service
    alert(message);
    console.log('Success:', message);
  }

  private showError(message: string): void {
    // Replace with your toast notification service
    alert(message);
    console.error('Error:', message);
  }

  // ============ MOCK DATA (for development) ============
  // private getMockCustomers(): CustomerItem[] {
  //   return [
  //     {
  //       id: 1,
  //       company: 'ABC Technology Co., Ltd.',
  //       address: '123 Technology Drive, Bangkok 10110',
  //       email: 'contact@abctech.com',
  //       phone: '+66-2-123-4567',
  //       tier: 'Enterprise',
  //       status: 'active',
  //       created_date: '2024-01-10T00:00:00Z',
  //       created_by: 1,
  //       total_projects: 8,
  //       total_users: 12,
  //       total_open_tickets: 24
  //     },
  //     {
  //       id: 2,
  //       company: 'XYZ Solutions Ltd.',
  //       address: '456 Business Avenue, Chiang Mai 50000',
  //       email: 'info@xyzsolutions.co.th',
  //       phone: '+66-53-987-6543',
  //       tier: 'Premium',
  //       status: 'active',
  //       created_date: '2024-01-15T00:00:00Z',
  //       created_by: 1,
  //       total_projects: 3,
  //       total_users: 8,
  //       total_open_tickets: 12
  //     }
  //   ];
  // }

  // private getMockProjects(): ProjectDDLItem[] {
  //   return [
  //     { 
  //       id: 101, 
  //       name: 'Mobile App Development',
  //       description: 'Cross-platform mobile application for e-commerce',
  //       status: 'active',
  //       current_users_count: 3,
  //       estimated_hours: 800,
  //       budget: 150000
  //     },
  //     { 
  //       id: 102, 
  //       name: 'Data Analytics Dashboard',
  //       description: 'Business intelligence dashboard for sales analytics',
  //       status: 'active',
  //       current_users_count: 2,
  //       estimated_hours: 400,
  //       budget: 80000
  //     },
  //     { 
  //       id: 103, 
  //       name: 'Cloud Migration Project',
  //       description: 'Migration of legacy systems to cloud infrastructure',
  //       status: 'active',
  //       current_users_count: 4,
  //       estimated_hours: 1200,
  //       budget: 200000
  //     },
  //     { 
  //       id: 104, 
  //       name: 'Security Audit System',
  //       description: 'Comprehensive security audit and compliance system',
  //       status: 'active',
  //       current_users_count: 2,
  //       estimated_hours: 600,
  //       budget: 120000
  //     }
  //   ];
  // }

  // private getMockUsers(): SystemUser[] {
  //   return [
  //     {
  //       id: 201,
  //       name: 'Alice Johnson',
  //       email: 'alice.johnson@company.com',
  //       role: 'Project Manager',
  //       department: 'IT',
  //       is_available: true,
  //       current_projects_count: 2
  //     },
  //     {
  //       id: 202,
  //       name: 'Bob Smith',
  //       email: 'bob.smith@company.com',
  //       role: 'Senior Developer',
  //       department: 'Development',
  //       is_available: true,
  //       current_projects_count: 1
  //     },
  //     {
  //       id: 203,
  //       name: 'Carol Davis',
  //       email: 'carol.davis@company.com',
  //       role: 'Business Analyst',
  //       department: 'Business',
  //       is_available: true,
  //       current_projects_count: 3
  //     }
  //   ];
  // }
}