import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Updated interfaces to match backend response
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

// Transformed interfaces for UI consistency
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
  // New fields from backend
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
  // New fields from backend
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

export interface CreateCustomerProjectDto {
  customer_id: number;
  name: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  start_date?: string;
  end_date?: string;
  status: 'active' | 'inactive';
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

  // Loading and error states
  isLoading = false;
  isProjectsLoading = false;
  hasError = false;
  errorMessage = '';

  // Search and filter properties
  customerSearchTerm: string = '';
  projectSearchTerm: string = '';
  selectedStatusFilter: string = 'all';
  selectedPriorityFilter: string = 'all';

  // Data arrays
  customers: CustomerItem[] = [];
  filteredCustomers: CustomerItem[] = [];
  selectedCustomer: CustomerItem | null = null;
  customerProjects: CustomerProjectItem[] = [];
  filteredProjects: CustomerProjectItem[] = [];
  customerUsers: CustomerUserItem[] = [];
  customerStats: CustomerStats | null = null;

  // Backend data
  cfpData: CFPCustomerData[] = [];

  // Modal properties
  isCreateProjectModalVisible = false;
  isCreateUserModalVisible = false;
  isSubmitting = false;
  projectForm!: FormGroup;
  userForm!: FormGroup;

  // Status and priority options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'completed', label: 'Completed' }
  ];

  priorityOptions = [
    { value: 'all', label: 'All Priority' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
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
    
    // Check if customer is specified in query params
    this.route.queryParams.subscribe(params => {
      if (params['customer']) {
        const customerId = parseInt(params['customer']);
        setTimeout(() => {
          this.selectCustomerById(customerId);
        }, 500);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize forms
   */
  private initForms(): void {
    // Project form
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [''],
      priority: ['medium', [Validators.required]],
      start_date: [''],
      end_date: [''],
      status: ['active', [Validators.required]]
    });

    // User form
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
      role: ['End User', [Validators.required]],
      department: [''],
      is_primary_contact: [false]
    });

    console.log('Forms initialized');
  }

  /**
   * Load CFP data from backend
   */
  loadCFPData(): void {
    this.isLoading = true;
    this.hasError = false;

    console.log('Loading CFP data from backend...');

    // เรียก API endpoint /customer-for-project/cfp-data
    this.apiService.get('customer-for-project/cfp-data')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading CFP data:', error);
          this.handleApiError(error);
          return of({ status: 0, message: 'Error', data: [] });
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          
          if (response && response.status === 1 && response.data) {
            this.cfpData = response.data as CFPCustomerData[];
            this.transformCFPDataToCustomers();
          } else {
            console.warn('Invalid response format, using mock data');
            this.customers = this.getMockCustomers();
          }

          this.filterCustomers();
          console.log('CFP data loaded:', this.cfpData);
          console.log('Transformed customers:', this.customers);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isLoading = false;
          this.customers = this.getMockCustomers();
          this.filterCustomers();
        }
      });
  }

  /**
   * Transform CFP data to customer format
   */
  private transformCFPDataToCustomers(): void {
    this.customers = this.cfpData.map(cfpCustomer => {
      // Calculate totals from projects
      const totalProjects = cfpCustomer.projects.length;
      const activeProjects = cfpCustomer.projects.filter(p => p.project_status).length;
      const totalUsers = cfpCustomer.projects.reduce((sum, p) => sum + p.user_count, 0);
      const totalOpenTickets = cfpCustomer.projects.reduce((sum, p) => sum + p.open_ticket_count, 0);

      // Assign tier based on project count or other criteria
      let tier: 'Enterprise' | 'Premium' | 'Standard' = 'Standard';
      if (totalProjects >= 5) tier = 'Enterprise';
      else if (totalProjects >= 2) tier = 'Premium';

      return {
        id: cfpCustomer.customer_id,
        company: cfpCustomer.customer_name,
        address: '', // Not provided by backend
        email: cfpCustomer.customer_email,
        phone: cfpCustomer.customer_phone,
        tier: tier,
        status: 'active' as 'active' | 'inactive',
        created_date: new Date().toISOString(),
        created_by: 1,
        total_projects: totalProjects,
        total_users: totalUsers,
        total_open_tickets: totalOpenTickets
      } as CustomerItem;
    });
  }

  /**
   * Load customers list (keeping for compatibility)
   */
  loadCustomers(): void {
    this.loadCFPData();
  }

  /**
   * Get mock customers for development
   */
  private getMockCustomers(): CustomerItem[] {
    return [
      {
        id: 1,
        company: 'ABC Technology Co., Ltd.',
        address: '123 Technology Drive, Bangkok 10110',
        email: 'contact@abctech.com',
        phone: '+66-2-123-4567',
        tier: 'Enterprise',
        status: 'active',
        created_date: '2024-01-10T00:00:00Z',
        created_by: 1,
        total_projects: 8,
        total_users: 12,
        total_open_tickets: 24
      },
      {
        id: 2,
        company: 'XYZ Solutions Ltd.',
        address: '456 Business Avenue, Chiang Mai 50000',
        email: 'info@xyzsolutions.co.th',
        phone: '+66-53-987-6543',
        tier: 'Premium',
        status: 'active',
        created_date: '2024-01-15T00:00:00Z',
        created_by: 1,
        total_projects: 3,
        total_users: 8,
        total_open_tickets: 12
      }
    ];
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: HttpErrorResponse): void {
    this.hasError = true;
    this.isLoading = false;

    if (error.status === 401) {
      this.errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      this.errorMessage = 'You do not have permission to view customers.';
    } else if (error.status === 0) {
      this.errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.status >= 500) {
      this.errorMessage = 'Server error occurred. Please try again later.';
    } else {
      this.errorMessage = error.error?.message || error.message || 'Failed to load data. Please try again.';
    }
  }

  /**
   * Filter customers based on search term
   */
  filterCustomers(): void {
    this.filteredCustomers = this.customers.filter(customer => {
      const searchTerm = this.customerSearchTerm.toLowerCase();
      return searchTerm === '' || 
        customer.company.toLowerCase().includes(searchTerm) ||
        customer.email.toLowerCase().includes(searchTerm);
    });

    console.log('Filtered customers:', this.filteredCustomers.length);
  }

  /**
   * Filter projects based on search and filters
   */
  filterProjects(): void {
    this.filteredProjects = this.customerProjects.filter(project => {
      const matchesSearch = this.projectSearchTerm === '' ||
        project.name.toLowerCase().includes(this.projectSearchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(this.projectSearchTerm.toLowerCase()));

      const matchesStatus = this.selectedStatusFilter === 'all' ||
        project.status === this.selectedStatusFilter;

      const matchesPriority = this.selectedPriorityFilter === 'all' ||
        project.priority === this.selectedPriorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    console.log('Filtered projects:', this.filteredProjects.length);
  }

  /**
   * Handle customer search
   */
  onCustomerSearchChange(): void {
    this.filterCustomers();
  }

  /**
   * Handle project search
   */
  onProjectSearchChange(): void {
    this.filterProjects();
  }

  /**
   * Handle filter changes
   */
  onStatusFilterChange(): void {
    this.filterProjects();
  }

  onPriorityFilterChange(): void {
    this.filterProjects();
  }

  /**
   * Select customer by ID
   */
  selectCustomerById(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      this.selectCustomer(customer);
    }
  }

  /**
   * Select customer and load related data
   */
  selectCustomer(customer: CustomerItem): void {
    console.log('Selecting customer:', customer);
    this.selectedCustomer = customer;
    
    // Update URL with customer parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customer: customer.id },
      queryParamsHandling: 'merge'
    });

    // Load customer data from CFP data
    this.loadCustomerDataFromCFP(customer.id);
  }

  /**
   * Load customer data from CFP data
   */
  private loadCustomerDataFromCFP(customerId: number): void {
    const cfpCustomer = this.cfpData.find(c => c.customer_id === customerId);
    
    if (cfpCustomer) {
      // Transform projects
      this.customerProjects = cfpCustomer.projects.map(cfpProject => ({
        id: cfpProject.project_id,
        customer_id: customerId,
        name: cfpProject.project_name,
        description: `Project with ${cfpProject.user_count} assigned users`,
        status: cfpProject.project_status ? 'active' : 'inactive',
        priority: 'medium', // Default priority as backend doesn't provide this
        created_date: new Date().toISOString(),
        created_by: 1,
        open_tickets_count: cfpProject.open_ticket_count,
        assigned_user_names: cfpProject.assigned_users,
        user_count: cfpProject.user_count,
        assigned_users: [] // Will be populated separately if needed
      }));

      // Create stats
      this.customerStats = {
        total_projects: cfpCustomer.projects.length,
        active_projects: cfpCustomer.projects.filter(p => p.project_status).length,
        total_users: cfpCustomer.projects.reduce((sum, p) => sum + p.user_count, 0),
        open_tickets: cfpCustomer.projects.reduce((sum, p) => sum + p.open_ticket_count, 0)
      };

      // Generate mock users based on assigned users
      this.customerUsers = this.generateUsersFromAssignedNames(customerId, cfpCustomer.projects);

      this.filterProjects();
    } else {
      // Fallback to existing mock data method
      this.loadCustomerProjects(customerId);
      this.loadCustomerUsers(customerId);
      this.loadCustomerStats(customerId);
    }
  }

  /**
   * Generate user items from assigned user names
   */
  private generateUsersFromAssignedNames(customerId: number, projects: CFPProjectData[]): CustomerUserItem[] {
    const uniqueUserNames = new Set<string>();
    
    projects.forEach(project => {
      project.assigned_users.forEach(userName => {
        uniqueUserNames.add(userName);
      });
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

  /**
   * Clear customer selection
   */
  clearCustomerSelection(): void {
    this.selectedCustomer = null;
    this.customerProjects = [];
    this.filteredProjects = [];
    this.customerUsers = [];
    this.customerStats = null;

    // Clear URL parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { customer: null },
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Load customer projects (fallback method)
   */
  loadCustomerProjects(customerId: number): void {
    this.isProjectsLoading = true;

    console.log('Loading projects for customer (fallback):', customerId);

    // Try API first, fallback to mock data
    this.apiService.get(`customers/${customerId}/projects`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading customer projects:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isProjectsLoading = false;
          
          if (Array.isArray(response)) {
            this.customerProjects = response as CustomerProjectItem[];
          } else if (response && response.data && Array.isArray(response.data)) {
            this.customerProjects = response.data as CustomerProjectItem[];
          } else {
            this.customerProjects = this.getMockProjects(customerId);
          }

          this.filterProjects();
          console.log('Customer projects loaded:', this.customerProjects);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isProjectsLoading = false;
          this.customerProjects = this.getMockProjects(customerId);
          this.filterProjects();
        }
      });
  }

  /**
   * Load customer users (fallback method)
   */
  loadCustomerUsers(customerId: number): void {
    console.log('Loading users for customer (fallback):', customerId);

    this.apiService.get(`customers/${customerId}/users`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading customer users:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (Array.isArray(response)) {
            this.customerUsers = response as CustomerUserItem[];
          } else if (response && response.data && Array.isArray(response.data)) {
            this.customerUsers = response.data as CustomerUserItem[];
          } else {
            this.customerUsers = this.getMockUsers(customerId);
          }

          console.log('Customer users loaded:', this.customerUsers);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.customerUsers = this.getMockUsers(customerId);
        }
      });
  }

  /**
   * Load customer stats (fallback method)
   */
  loadCustomerStats(customerId: number): void {
    console.log('Loading stats for customer (fallback):', customerId);

    this.apiService.get(`customers/${customerId}/stats`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading customer stats:', error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response && response.data) {
            this.customerStats = response.data as CustomerStats;
          } else {
            this.customerStats = this.getMockStats(customerId);
          }

          console.log('Customer stats loaded:', this.customerStats);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.customerStats = this.getMockStats(customerId);
        }
      });
  }

  /**
   * Get mock projects for development
   */
  private getMockProjects(customerId: number): CustomerProjectItem[] {
    const mockProjects: { [key: number]: CustomerProjectItem[] } = {
      1: [
        {
          id: 1,
          customer_id: 1,
          name: 'ERP System Implementation',
          description: 'Complete ERP system setup and integration',
          status: 'active',
          priority: 'high',
          start_date: '2024-01-15',
          end_date: '2024-12-31',
          created_date: '2024-01-10T00:00:00Z',
          created_by: 1,
          open_tickets_count: 8
        }
      ],
      2: [
        {
          id: 4,
          customer_id: 2,
          name: 'CRM Integration',
          description: 'Customer relationship management system',
          status: 'active',
          priority: 'high',
          start_date: '2024-02-01',
          end_date: '2024-10-30',
          created_date: '2024-01-20T00:00:00Z',
          created_by: 1,
          open_tickets_count: 5
        }
      ]
    };

    return mockProjects[customerId] || [];
  }

  /**
   * Get mock users for development
   */
  private getMockUsers(customerId: number): CustomerUserItem[] {
    const mockUsers: { [key: number]: CustomerUserItem[] } = {
      1: [
        {
          id: 1,
          customer_id: 1,
          name: 'John Smith',
          email: 'john.smith@abctech.com',
          phone: '+66-2-123-4567',
          role: 'Project Manager',
          department: 'IT',
          is_primary_contact: true,
          status: 'active',
          created_date: '2024-01-10T00:00:00Z',
          created_by: 1
        }
      ]
    };

    return mockUsers[customerId] || [];
  }

  /**
   * Get mock stats for development
   */
  private getMockStats(customerId: number): CustomerStats {
    const mockStats: { [key: number]: CustomerStats } = {
      1: {
        total_projects: 8,
        active_projects: 5,
        total_users: 12,
        open_tickets: 24
      },
      2: {
        total_projects: 3,
        active_projects: 2,
        total_users: 8,
        open_tickets: 12
      }
    };

    return mockStats[customerId] || {
      total_projects: 0,
      active_projects: 0,
      total_users: 0,
      open_tickets: 0
    };
  }

  // ============ MODAL METHODS ============

  /**
   * Open create project modal
   */
  openCreateProjectModal(): void {
    if (!this.selectedCustomer) return;
    
    console.log('Opening create project modal');
    this.isCreateProjectModalVisible = true;
    this.resetProjectForm();
  }

  /**
   * Close create project modal
   */
  closeCreateProjectModal(): void {
    console.log('Closing create project modal');
    if (!this.isSubmitting) {
      this.resetProjectForm();
      this.isCreateProjectModalVisible = false;
    }
  }

  /**
   * Open create user modal
   */
  openCreateUserModal(): void {
    if (!this.selectedCustomer) return;
    
    console.log('Opening create user modal');
    this.isCreateUserModalVisible = true;
    this.resetUserForm();
  }

  /**
   * Close create user modal
   */
  closeCreateUserModal(): void {
    console.log('Closing create user modal');
    if (!this.isSubmitting) {
      this.resetUserForm();
      this.isCreateUserModalVisible = false;
    }
  }

  /**
   * Reset project form
   */
  private resetProjectForm(): void {
    this.projectForm.reset({
      priority: 'medium',
      status: 'active'
    });
    this.isSubmitting = false;
  }

  /**
   * Reset user form
   */
  private resetUserForm(): void {
    this.userForm.reset({
      role: 'End User',
      is_primary_contact: false
    });
    this.isSubmitting = false;
  }

  /**
   * Submit project form
   */
  onSubmitProject(): void {
    if (!this.selectedCustomer) return;

    console.log('Project form submitted');
    console.log('Form valid:', this.projectForm.valid);
    console.log('Form value:', this.projectForm.value);

    if (this.projectForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formData: CreateCustomerProjectDto = {
        customer_id: this.selectedCustomer.id,
        name: this.projectForm.get('name')?.value.trim(),
        description: this.projectForm.get('description')?.value?.trim() || undefined,
        priority: this.projectForm.get('priority')?.value,
        start_date: this.projectForm.get('start_date')?.value || undefined,
        end_date: this.projectForm.get('end_date')?.value || undefined,
        status: this.projectForm.get('status')?.value
      };

      // เรียก API endpoint /api/customer-projects
      this.apiService.post('customer-projects', formData)
        .pipe(
          takeUntil(this.destroy$),
          catchError((error: HttpErrorResponse) => {
            console.error('Error creating project:', error);
            this.handleCreateProjectError(error);
            return of(null);
          })
        )
        .subscribe({
          next: (response: any) => {
            this.isSubmitting = false;
            
            if (response === null) {
              return;
            }

            let createdProject: CustomerProjectItem | null = null;

            if (response && response.data && typeof response.data === 'object' && response.data.id) {
              createdProject = response.data as CustomerProjectItem;
            } else if (response && typeof response === 'object' && response.id) {
              createdProject = response as CustomerProjectItem;
            }

            if (createdProject) {
              this.onProjectCreated(createdProject);
            } else {
              this.showErrorMessage('Failed to create project. Please try again.');
            }
          },
          error: (error) => {
            console.error('Subscription error:', error);
            this.isSubmitting = false;
            this.handleCreateProjectError(error);
          }
        });
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.projectForm.controls).forEach(key => {
        const control = this.projectForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * Submit user form
   */
  onSubmitUser(): void {
    if (!this.selectedCustomer) return;

    console.log('User form submitted');
    console.log('Form valid:', this.userForm.valid);
    console.log('Form value:', this.userForm.value);

    if (this.userForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formData = {
        customer_id: this.selectedCustomer.id,
        name: this.userForm.get('name')?.value.trim(),
        email: this.userForm.get('email')?.value.trim(),
        phone: this.userForm.get('phone')?.value?.trim() || undefined,
        role: this.userForm.get('role')?.value,
        department: this.userForm.get('department')?.value?.trim() || undefined,
        is_primary_contact: this.userForm.get('is_primary_contact')?.value || false
      };

      // เรียก API endpoint /api/customer-users
      this.apiService.post('customer-users', formData)
        .pipe(
          takeUntil(this.destroy$),
          catchError((error: HttpErrorResponse) => {
            console.error('Error creating user:', error);
            this.handleCreateUserError(error);
            return of(null);
          })
        )
        .subscribe({
          next: (response: any) => {
            this.isSubmitting = false;
            
            if (response === null) {
              return;
            }

            let createdUser: CustomerUserItem | null = null;

            if (response && response.data && typeof response.data === 'object' && response.data.id) {
              createdUser = response.data as CustomerUserItem;
            } else if (response && typeof response === 'object' && response.id) {
              createdUser = response as CustomerUserItem;
            }

            if (createdUser) {
              this.onUserCreated(createdUser);
            } else {
              this.showErrorMessage('Failed to create user. Please try again.');
            }
          },
          error: (error) => {
            console.error('Subscription error:', error);
            this.isSubmitting = false;
            this.handleCreateUserError(error);
          }
        });
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.userForm.controls).forEach(key => {
        const control = this.userForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * Handle project creation success
   */
  onProjectCreated(newProject: CustomerProjectItem): void {
    console.log('New project created:', newProject);
    
    // เพิ่มเข้า projects array
    this.customerProjects.unshift(newProject);
    this.filterProjects();

    // อัพเดท stats
    if (this.customerStats) {
      this.customerStats.total_projects++;
      if (newProject.status === 'active') {
        this.customerStats.active_projects++;
      }
    }

    // ปิด modal
    this.isCreateProjectModalVisible = false;

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`Project "${newProject.name}" has been created successfully!`);
    
    // Refresh CFP data to get updated information
    this.loadCFPData();
  }

  /**
   * Handle user creation success
   */
  onUserCreated(newUser: CustomerUserItem): void {
    console.log('New user created:', newUser);
    
    // เพิ่มเข้า users array
    this.customerUsers.unshift(newUser);

    // อัพเดท stats
    if (this.customerStats) {
      this.customerStats.total_users++;
    }

    // ปิด modal
    this.isCreateUserModalVisible = false;

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`User "${newUser.name}" has been created successfully!`);
    
    // Refresh CFP data to get updated information
    this.loadCFPData();
  }

  /**
   * Handle project creation error
   */
  private handleCreateProjectError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    
    let errorMessage = 'Failed to create project. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to create projects.';
    } else if (error.status === 400) {
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors) {
        const errors = error.error.errors;
        errorMessage = Array.isArray(errors) ? errors.join(', ') : errors;
      }
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.showErrorMessage(errorMessage);
  }

  /**
   * Handle user creation error
   */
  private handleCreateUserError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    
    let errorMessage = 'Failed to create user. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to create users.';
    } else if (error.status === 400) {
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors) {
        const errors = error.error.errors;
        errorMessage = Array.isArray(errors) ? errors.join(', ') : errors;
      }
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.showErrorMessage(errorMessage);
  }

  /**
   * Edit project
   */
  editProject(projectId: number): void {
    console.log('Navigating to edit project:', projectId);
    this.router.navigate(['/settings/project-edit', projectId]);
  }

  /**
   * Delete project with confirmation
   */
  deleteProject(projectId: number): void {
    const project = this.customerProjects.find(p => p.id === projectId);
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
   * Perform project deletion
   */
  private performDeleteProject(projectId: number, projectName: string): void {
    console.log('Deleting project via API:', { projectId, projectName });

    this.isProjectsLoading = true;

    // เรียก API endpoint DELETE /api/customer-projects/{id}
    this.apiService.delete(`customer-projects/${projectId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error deleting project:', error);
          this.showErrorMessage(`Failed to delete project "${projectName}". Please try again.`);
          this.isProjectsLoading = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          // ลบออกจาก local array
          this.customerProjects = this.customerProjects.filter(p => p.id !== projectId);
          this.filterProjects();

          // อัพเดท stats
          if (this.customerStats) {
            this.customerStats.total_projects--;
            const deletedProject = this.customerProjects.find(p => p.id === projectId);
            if (deletedProject && deletedProject.status === 'active') {
              this.customerStats.active_projects--;
            }
          }

          // แสดงข้อความสำเร็จ
          this.showSuccessMessage(`Project "${projectName}" has been deleted successfully.`);
          this.isProjectsLoading = false;
          
          // Refresh CFP data to get updated information
          this.loadCFPData();
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.showErrorMessage(`Failed to delete project "${projectName}". Please try again.`);
          this.isProjectsLoading = false;
        }
      });
  }

  /**
   * View project details
   */
  viewProject(projectId: number): void {
    console.log('Navigating to view project:', projectId);
    this.router.navigate(['/projects', projectId]);
  }

  /**
   * Export customer data
   */
  exportCustomerData(): void {
    if (!this.selectedCustomer) return;

    console.log('Exporting customer data');
    // TODO: Implement export functionality
    this.showSuccessMessage('Export feature will be implemented soon.');
  }

  /**
   * Refresh customer data
   */
  refreshCustomerData(): void {
    if (!this.selectedCustomer) {
      this.loadCFPData();
      return;
    }

    console.log('Refreshing customer data');
    const selectedCustomerId = this.selectedCustomer.id;
    
    // Refresh from CFP data
    this.loadCFPData();
    
    // Wait a moment for data to load, then refresh customer-specific data
    setTimeout(() => {
      this.loadCustomerDataFromCFP(selectedCustomerId);
    }, 100);
  }

  // ============ UTILITY METHODS ============

  /**
   * Check if field is invalid
   */
  isFieldInvalid(formName: 'project' | 'user', fieldName: string): boolean {
    const form = formName === 'project' ? this.projectForm : this.userForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get description length for project form
   */
  getProjectDescriptionLength(): number {
    const descValue = this.projectForm.get('description')?.value;
    return descValue ? descValue.length : 0;
  }

  /**
   * Get customer avatar letter
   */
  getCustomerAvatarLetter(companyName: string): string {
    return companyName ? companyName.charAt(0).toUpperCase() : '?';
  }

  /**
   * Get project avatar letter
   */
  getProjectAvatarLetter(projectName: string): string {
    return projectName ? projectName.charAt(0).toUpperCase() : '?';
  }

  /**
   * Get user avatar letter
   */
  getUserAvatarLetter(userName: string): string {
    return userName ? userName.charAt(0).toUpperCase() : '?';
  }

  /**
   * Get tier badge class
   */
  getTierBadgeClass(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'enterprise':
        return 'tier-enterprise';
      case 'premium':
        return 'tier-premium';
      case 'standard':
        return 'tier-standard';
      default:
        return 'tier-default';
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-default';
    }
  }

  /**
   * Get priority badge class
   */
  getPriorityBadgeClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return 'priority-default';
    }
  }

  /**
   * Get tickets count class
   */
  getTicketsCountClass(count: number): string {
    if (count === 0) return 'tickets-zero';
    if (count > 5) return 'tickets-high';
    return 'tickets-medium';
  }

  /**
   * Format date for display
   */
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

  /**
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    // คุณสามารถแทนที่ด้วย toast notification service
    alert(message);
    console.log('Success:', message);
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string): void {
    // คุณสามารถแทนที่ด้วย toast notification service
    alert(message);
    console.error('Error:', message);
  }

  // ============ PERMISSION METHODS ============

  /**
   * Check if user can manage customer projects
   */
  canManageCustomerProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * Check if user can create projects
   */
  canCreateProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * Check if user can edit project
   */
  canEditProject(project: CustomerProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * Check if user can delete project
   */
  canDeleteProject(project: CustomerProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * Check if user can create users
   */
  canCreateUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByCustomerId(index: number, customer: CustomerItem): number {
    return customer.id;
  }

  trackByProjectId(index: number, project: CustomerProjectItem): number {
    return project.id;
  }

  trackByUserId(index: number, user: CustomerUserItem): number {
    return user.id;
  }
}