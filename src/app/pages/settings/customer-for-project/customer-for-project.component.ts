import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// ============ UPDATED INTERFACES FOR NEW STRUCTURE ============
export interface AssignedUser {
  name: string;
  user_id: number;
}

export interface CFPProjectData {
  project_id: number;
  project_name: string;
  project_status: boolean;
  customers: CFPCustomerData[];
}

export interface CFPCustomerData {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_users: AssignedUser[]; // ← เปลี่ยนจาก string[] เป็น object[]
  customer_count: number;
  user_count: number;
  open_ticket_count: number;
}

export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
  total_customers?: number;
  total_users?: number;
  total_open_tickets?: number;
}

export interface ProjectCustomerItem {
  id: number;
  project_id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_users?: ProjectUserItem[];
  assigned_user_names?: string[];
  assigned_user_data?: AssignedUser[]; // ← เพิ่มนี้เพื่อเก็บข้อมูลเต็ม
  user_count?: number;
  open_tickets_count?: number;
  created_date: string;
  created_by: number;
}

export interface ProjectUserItem {
  id: number;
  project_id: number;
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

export interface ProjectStats {
  total_customers: number;
  active_customers: number;
  total_users: number;
  open_tickets: number;
}

// Backend API Interfaces
export interface CustomerDDLItem {
  id: number;
  company: string;
  email: string;
  phone?: string;
  tier?: string;
  status?: string;
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
  project_id: number;
  customer_id: number;
  assigned_users: { user_id: number }[];
  project_name?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  create_by?: number;
  update_by?: number;
}

export interface UpdateCustomerForProjectDto {
  project_id?: number;
  customer_id?: number;
  assigned_users?: { user_id: number }[];
  project_name?: string;
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
  isCustomersLoading = false;
  hasError = false;
  errorMessage = '';
  isSubmitting = false;

  // Search and filter
  projectSearchTerm = '';
  customerSearchTerm = '';
  selectedStatusFilter = 'all';
  userSearchTerm = '';

  // Data arrays - UPDATED for new structure
  projects: ProjectItem[] = [];
  filteredProjects: ProjectItem[] = [];
  selectedProject: ProjectItem | null = null;
  projectCustomers: ProjectCustomerItem[] = [];
  filteredCustomers: ProjectCustomerItem[] = [];
  projectUsers: ProjectUserItem[] = [];
  projectStats: ProjectStats | null = null;
  cfpData: CFPProjectData[] = [];

  // Modal states
  isAssignCustomerModalVisible = false;
  isCreateCustomerModalVisible = false;
  isCreateUserModalVisible = false;

  // Manage Users Modal - NEW
  isManageUsersModalVisible = false;
  selectedCustomerForEdit: ProjectCustomerItem | null = null;
  currentCustomerUsers: SystemUser[] = [];
  availableUsersForEdit: SystemUser[] = [];
  filteredAvailableUsers: SystemUser[] = [];
  editUserSearchTerm = '';
  isLoadingCurrentUsers = false;
  isLoadingAvailableUsers = false;
  usersToAdd: SystemUser[] = [];
  usersToRemove: SystemUser[] = [];

  // Assign customer data
  availableCustomers: CustomerDDLItem[] = [];
  systemUsers: SystemUser[] = [];
  selectedCustomer: CustomerDDLItem | null = null;
  selectedUsers: SystemUser[] = [];
  filteredUsers: SystemUser[] = [];
  isLoadingCustomers = false;
  isLoadingUsers = false;

  // Forms
  assignCustomerForm!: FormGroup;
  customerForm!: FormGroup;
  userForm!: FormGroup;

  // Options
  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
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
    this.assignCustomerForm = this.fb.group({
      customer_id: ['', [Validators.required]],
      assigned_users: [[], [Validators.required, Validators.minLength(1)]]
    });

    this.customerForm = this.fb.group({
      company: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
      address: [''],
      tier: ['Standard', [Validators.required]]
    });

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
      if (params['project']) {
        const projectId = parseInt(params['project']);
        setTimeout(() => {
          if (!this.selectedProject || this.selectedProject.id !== projectId) {
            this.selectProjectById(projectId);
          }
        }, 100);
      } else {
        if (this.selectedProject) {
          this.clearProjectSelection();
        }
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
            this.transformCFPDataToProjects();
          }
          this.filterProjects();
        },
        error: () => {
          this.isLoading = false;
          this.filterProjects();
        }
      });
  }

  private transformCFPDataToProjects(): void {
    this.projects = this.cfpData.map(cfpProject => {
      const totalCustomers = cfpProject.customers.length;
      const totalUsers = cfpProject.customers.reduce((sum, c) => sum + c.user_count, 0);
      const totalOpenTickets = cfpProject.customers.reduce((sum, c) => sum + c.open_ticket_count, 0);

      return {
        id: cfpProject.project_id,
        name: cfpProject.project_name,
        description: `Project with ${totalCustomers} customer(s) and ${totalUsers} user(s)`,
        status: cfpProject.project_status ? 'active' as const : 'inactive' as const,
        created_date: new Date().toISOString(),
        created_by: 1,
        total_customers: totalCustomers,
        total_users: totalUsers,
        total_open_tickets: totalOpenTickets
      };
    });
  }

  // ============ PROJECT MANAGEMENT ============
  selectProject(project: ProjectItem): void {
    if (this.selectedProject?.id === project.id) {
      return;
    }

    this.clearProjectState();
    this.selectedProject = project;
    this.updateUrl(project.id);

    setTimeout(() => {
      if (this.selectedProject?.id === project.id) {
        this.loadProjectData(project.id);
      }
    }, 50);
  }

  selectProjectById(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (project && this.selectedProject?.id !== projectId) {
      this.selectProject(project);
    }
  }

  private clearProjectState(): void {
    this.projectCustomers = [];
    this.filteredCustomers = [];
    this.projectUsers = [];
    this.projectStats = null;
    this.isCustomersLoading = false;
  }

  private updateUrl(projectId: number): void {
    const currentProjectId = this.route.snapshot.queryParams['project'];
    if (parseInt(currentProjectId) !== projectId) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { project: projectId },
        queryParamsHandling: 'merge'
      });
    }
  }

  private loadProjectData(projectId: number): void {
    if (!this.selectedProject || this.selectedProject.id !== projectId) {
      return;
    }

    this.isCustomersLoading = true;

    const cfpProject = this.cfpData.find(p => p.project_id === projectId);

    if (cfpProject && this.selectedProject?.id === projectId) {
      this.projectCustomers = cfpProject.customers.map(c => ({
        id: c.customer_id,
        project_id: projectId,
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        customer_email: c.customer_email,
        customer_phone: c.customer_phone,
        assigned_user_names: c.assigned_users.map(u => u.name), // ✅ ดึง name
        assigned_user_data: c.assigned_users, // ✅ เก็บข้อมูลเต็มไว้ใช้ภายหลัง
        user_count: c.user_count,
        open_tickets_count: c.open_ticket_count,
        created_date: new Date().toISOString(),
        created_by: 1,
        assigned_users: []
      }));

      this.projectStats = {
        total_customers: cfpProject.customers.length,
        active_customers: cfpProject.customers.length,
        total_users: cfpProject.customers.reduce((sum, c) => sum + c.user_count, 0),
        open_tickets: cfpProject.customers.reduce((sum, c) => sum + c.open_ticket_count, 0)
      };

      this.projectUsers = this.generateUsersFromCustomers(projectId, cfpProject.customers);
      this.filterCustomers();
    }

    this.isCustomersLoading = false;
  }

  private generateUsersFromCustomers(projectId: number, customers: CFPCustomerData[]): ProjectUserItem[] {
    const users: ProjectUserItem[] = [];

    customers.forEach(customer => {
      customer.assigned_users.forEach((assignedUser, index) => {
        users.push({
          id: assignedUser.user_id, // ✅ ใช้ user_id จริง
          project_id: projectId,
          customer_id: customer.customer_id,
          name: assignedUser.name,
          email: `${assignedUser.name.toLowerCase().replace(/\s+/g, '.')}@${customer.customer_name.toLowerCase().replace(/\s+/g, '')}.com`,
          phone: `+66-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          role: index === 0 ? 'Project Manager' : 'End User',
          department: index === 0 ? 'IT' : 'Operations',
          is_primary_contact: index === 0,
          status: 'active',
          created_date: new Date().toISOString(),
          created_by: 1
        });
      });
    });

    return users;
  }

  clearProjectSelection(): void {
    this.selectedProject = null;
    this.clearProjectState();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { project: null },
      queryParamsHandling: 'merge'
    });
  }

  // ============ MANAGE USERS MODAL - NEW FUNCTIONS ============
  openManageUsersModal(customer: ProjectCustomerItem): void {
    this.selectedCustomerForEdit = customer;
    this.isManageUsersModalVisible = true;
    this.resetManageUsersState();
    this.loadCurrentCustomerUsers();
    this.loadAvailableUsersForEdit();
  }

  closeManageUsersModal(): void {
    if (!this.isSubmitting) {
      this.resetManageUsersState();
      this.isManageUsersModalVisible = false;
    }
  }

  private resetManageUsersState(): void {
    this.currentCustomerUsers = [];
    this.availableUsersForEdit = [];
    this.filteredAvailableUsers = [];
    this.editUserSearchTerm = '';
    this.usersToAdd = [];
    this.usersToRemove = [];
    this.isLoadingCurrentUsers = false;
    this.isLoadingAvailableUsers = false;
  }

  private loadCurrentCustomerUsers(): void {
    if (!this.selectedCustomerForEdit) return;

    this.isLoadingCurrentUsers = true;

    // ✅ ใช้ข้อมูลจาก assigned_user_data ที่มี user_id จริง
    if (this.selectedCustomerForEdit.assigned_user_data && 
        this.selectedCustomerForEdit.assigned_user_data.length > 0) {
      
      this.currentCustomerUsers = this.selectedCustomerForEdit.assigned_user_data.map(assignedUser => {
        // หาข้อมูลเต็มจาก systemUsers ถ้ามี
        const fullUserData = this.systemUsers.find(u => u.id === assignedUser.user_id);
        
        // ถ้าเจอใน systemUsers ให้ใช้ข้อมูลเต็ม ไม่เจอก็สร้างจาก assigned_user_data
        return fullUserData || {
          id: assignedUser.user_id, // ✅ ใช้ ID จริงจาก backend
          name: assignedUser.name,
          email: '', // จะ empty ก่อน จนกว่าจะโหลด systemUsers เสร็จ
          role: 'User',
          is_available: true,
          current_projects_count: 1
        };
      });
    } else {
      this.currentCustomerUsers = [];
    }

    this.isLoadingCurrentUsers = false;
  }

  private loadAvailableUsersForEdit(): void {
    this.isLoadingAvailableUsers = true;

    // ถ้ามี systemUsers แล้วก็ใช้เลย
    if (this.systemUsers.length > 0) {
      this.updateCurrentUsersWithFullData(); // ✅ อัพเดท currentUsers ด้วยข้อมูลเต็ม
      this.filterAvailableUsersForEdit();
      this.isLoadingAvailableUsers = false;
      return;
    }

    // ถ้ายังไม่มีก็โหลด
    this.apiService.get('users/Allusers')
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([]))
      )
      .subscribe({
        next: (response: any) => {
          const userData = Array.isArray(response) ? response :
            response?.data ? response.data :
              response?.status === 1 && response.data ? response.data : [];

          this.systemUsers = this.transformUsersResponse(userData);
          this.updateCurrentUsersWithFullData(); // ✅ อัพเดท currentUsers ด้วยข้อมูลเต็ม
          this.filterAvailableUsersForEdit();
          this.isLoadingAvailableUsers = false;
        },
        error: () => {
          this.isLoadingAvailableUsers = false;
          this.filterAvailableUsersForEdit();
        }
      });
  }

  // ✅ Method ใหม่: อัพเดท currentUsers ด้วยข้อมูลเต็มจาก systemUsers
  private updateCurrentUsersWithFullData(): void {
    this.currentCustomerUsers = this.currentCustomerUsers.map(currentUser => {
      const fullUserData = this.systemUsers.find(u => u.id === currentUser.id);
      return fullUserData || currentUser;
    });
  }

  private filterAvailableUsersForEdit(): void {
    const searchTerm = this.editUserSearchTerm.toLowerCase();
    
    // Get IDs of current users and users to add
    const currentUserIds = this.currentCustomerUsers.map(u => u.id);
    const usersToAddIds = this.usersToAdd.map(u => u.id);
    
    this.filteredAvailableUsers = this.systemUsers.filter(user => {
      const displayName = this.getUserDisplayName(user);
      
      const matchSearch = !searchTerm ||
        displayName.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.role && user.role.toLowerCase().includes(searchTerm));
      
      // Exclude users that are already assigned or marked to be added
      const notCurrentlyAssigned = !currentUserIds.includes(user.id) && !usersToAddIds.includes(user.id);
      
      return matchSearch && notCurrentlyAssigned;
    });
  }

  addUserToCustomer(user: SystemUser): void {
    if (!this.usersToAdd.some(u => u.id === user.id)) {
      this.usersToAdd.push(user);
      this.filterAvailableUsersForEdit();
    }
  }

  removeUserFromCustomer(user: SystemUser): void {
    // If it's a current user, mark for removal
    if (this.currentCustomerUsers.some(u => u.id === user.id)) {
      if (!this.usersToRemove.some(u => u.id === user.id)) {
        this.usersToRemove.push(user);
      }
    }
    
    // If it's a user to add, remove from add list
    const addIndex = this.usersToAdd.findIndex(u => u.id === user.id);
    if (addIndex >= 0) {
      this.usersToAdd.splice(addIndex, 1);
      this.filterAvailableUsersForEdit();
    }
  }

  undoRemoveUser(user: SystemUser): void {
    const removeIndex = this.usersToRemove.findIndex(u => u.id === user.id);
    if (removeIndex >= 0) {
      this.usersToRemove.splice(removeIndex, 1);
    }
  }

  onEditUserSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editUserSearchTerm = input.value;
    this.filterAvailableUsersForEdit();
  }

  hasUserChanges(): boolean {
    return this.usersToAdd.length > 0 || this.usersToRemove.length > 0;
  }

  onSubmitManageUsers(): void {
    if (!this.selectedCustomerForEdit || !this.hasUserChanges() || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    // Calculate final user list
    const currentUserIds = this.currentCustomerUsers.map(u => u.id);
    const usersToAddIds = this.usersToAdd.map(u => u.id);
    const usersToRemoveIds = this.usersToRemove.map(u => u.id);

    // Final user list = current users - removed users + added users
    const finalUserIds = [
      ...currentUserIds.filter(id => !usersToRemoveIds.includes(id)),
      ...usersToAddIds
    ];

    const updateDto: UpdateCustomerForProjectDto = {
      project_id: this.selectedProject?.id,
      customer_id: this.selectedCustomerForEdit.customer_id,
      assigned_users: finalUserIds.map(id => ({ user_id: id }))
    };

    console.log('Updating customer users:', updateDto);

    this.apiService.patch(`customer-for-project/cfp/update/${this.selectedCustomerForEdit.id}`, updateDto)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.status === 1 || response.code === 1)) {
            this.onManageUsersSuccess();
            this.closeManageUsersModal();
            this.showSuccess('Users updated successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to update users');
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Update users error:', error);
          
          if (error?.status === 404) {
            this.showError('Customer assignment not found');
          } else if (error?.status === 403) {
            this.showError('You do not have permission to update users');
          } else if (error?.status === 400) {
            this.showError('Invalid request data');
          } else {
            this.showError('Failed to update users');
          }
        }
      });
  }

  private onManageUsersSuccess(): void {
    if (!this.selectedCustomerForEdit) return;

    const customerIndex = this.projectCustomers.findIndex(c => c.id === this.selectedCustomerForEdit?.id);
    if (customerIndex >= 0) {
      const finalUsers = [
        ...this.currentCustomerUsers.filter(u => !this.usersToRemove.some(ru => ru.id === u.id)),
        ...this.usersToAdd
      ];
      
      this.projectCustomers[customerIndex].assigned_user_names = finalUsers.map(u => this.getUserDisplayName(u));
      this.projectCustomers[customerIndex].user_count = finalUsers.length;
      
      this.filterCustomers();
      
      if (this.projectStats) {
        const userDifference = this.usersToAdd.length - this.usersToRemove.length;
        this.projectStats.total_users += userDifference;
      }
    }
  }

  // ============ CUSTOMER ACTIONS ============
  editCustomer(customerId: number): void {
    this.router.navigate(['/settings/customer-edit', customerId]);
  }

  viewCustomer(customerId: number): void {
    this.router.navigate(['/customers', customerId]);
  }

  deleteCustomer(customerId: number): void {
    const customer = this.projectCustomers.find(c => c.customer_id === customerId);
    if (!customer) return;

    if (confirm(`Remove customer "${customer.customer_name}" from this project?`)) {
      this.isCustomersLoading = true;
      
      this.apiService.delete(`customer-for-project/cfp/delete/${customer.id}`)
        .pipe(
          takeUntil(this.destroy$),
          catchError(this.handleError.bind(this))
        )
        .subscribe({
          next: (response: any) => {
            this.isCustomersLoading = false;
            if (response && (response.status === 1 || response.code === 1 || response === null)) {
              this.projectCustomers = this.projectCustomers.filter(c => c.customer_id !== customerId);
              this.filterCustomers();
              
              if (this.projectStats) {
                this.projectStats.total_customers--;
                if (customer.user_count) {
                  this.projectStats.total_users -= customer.user_count;
                }
                if (customer.open_tickets_count) {
                  this.projectStats.open_tickets -= customer.open_tickets_count;
                }
              }
              
              this.showSuccess('Customer removed from project successfully');
              this.loadCFPData();
            } else {
              this.showError('Failed to remove customer from project');
            }
          },
          error: (error) => {
            this.isCustomersLoading = false;
            console.error('Delete customer error:', error);
            
            if (error?.status === 404) {
              this.showError('Customer assignment not found');
            } else if (error?.status === 403) {
              this.showError('You do not have permission to remove this customer');
            } else if (error?.status === 400) {
              this.showError('Cannot remove customer - there may be dependencies');
            } else {
              this.showError('Failed to remove customer from project');
            }
          }
        });
    }
  }

  // ============ CREATE CUSTOMER & USER MODALS ============
  openCreateCustomerModal(): void {
    if (!this.selectedProject) return;
    this.isCreateCustomerModalVisible = true;
    this.resetCustomerForm();
  }

  closeCreateCustomerModal(): void {
    if (!this.isSubmitting) {
      this.resetCustomerForm();
      this.isCreateCustomerModalVisible = false;
    }
  }

  openCreateUserModal(): void {
    if (!this.selectedProject) return;
    this.isCreateUserModalVisible = true;
    this.resetUserForm();
  }

  closeCreateUserModal(): void {
    if (!this.isSubmitting) {
      this.resetUserForm();
      this.isCreateUserModalVisible = false;
    }
  }

  private resetCustomerForm(): void {
    this.customerForm.reset({
      tier: 'Standard'
    });
  }

  private resetUserForm(): void {
    this.userForm.reset({
      role: 'End User',
      is_primary_contact: false
    });
  }

  onSubmitCustomer(): void {
    if (!this.selectedProject || !this.customerForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData = {
      project_id: this.selectedProject.id,
      company: this.customerForm.get('company')?.value?.trim(),
      email: this.customerForm.get('email')?.value?.trim(),
      phone: this.customerForm.get('phone')?.value?.trim() || undefined,
      address: this.customerForm.get('address')?.value?.trim() || undefined,
      tier: this.customerForm.get('tier')?.value
    };

    this.apiService.post('customers', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.data?.id || response.id)) {
            const createdCustomer = response.data || response;
            this.onCustomerCreated(createdCustomer);
            this.closeCreateCustomerModal();
            this.showSuccess('Customer created successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to create customer');
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError('Failed to create customer');
        }
      });
  }

  onSubmitUser(): void {
    if (!this.selectedProject || !this.userForm.valid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formData = {
      project_id: this.selectedProject.id,
      name: this.userForm.get('name')?.value?.trim(),
      email: this.userForm.get('email')?.value?.trim(),
      phone: this.userForm.get('phone')?.value?.trim() || undefined,
      role: this.userForm.get('role')?.value,
      department: this.userForm.get('department')?.value?.trim() || undefined,
      is_primary_contact: this.userForm.get('is_primary_contact')?.value || false
    };

    this.apiService.post('project-users', formData)
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

  private onCustomerCreated(newCustomer: ProjectCustomerItem): void {
    this.projectCustomers.unshift(newCustomer);
    this.filterCustomers();
    if (this.projectStats) {
      this.projectStats.total_customers++;
    }
  }

  private onUserCreated(newUser: ProjectUserItem): void {
    this.projectUsers.unshift(newUser);
    if (this.projectStats) {
      this.projectStats.total_users++;
    }
  }

  loadProjects(): void {
    this.loadCFPData();
  }

  // ============ ASSIGN CUSTOMER ============
  openAssignCustomerModal(): void {
    if (!this.selectedProject) return;

    this.isAssignCustomerModalVisible = true;
    this.resetAssignCustomerForm();
    this.loadCustomerDDL();
    this.loadAllUsers();
  }

  closeAssignCustomerModal(): void {
    if (!this.isSubmitting) {
      this.resetAssignCustomerForm();
      this.isAssignCustomerModalVisible = false;
    }
  }

  private resetAssignCustomerForm(): void {
    this.assignCustomerForm.reset();
    this.selectedCustomer = null;
    this.selectedUsers = [];
    this.filteredUsers = [];
    this.userSearchTerm = '';
  }

  private loadCustomerDDL(): void {
    this.isLoadingCustomers = true;

    this.apiService.get('get_all_customer')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading customers:', error);
          return of({ code: 0, status: false, message: 'Error loading customers', data: null });
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isLoadingCustomers = false;
          console.log('Customer DDL Response:', response);
          
          if (response && response.code === 1 && response.status === true && Array.isArray(response.data)) {
            this.availableCustomers = response.data.map((customer: any) => ({
              id: customer.id,
              company: customer.name,
              email: customer.email || '',
              phone: customer.phone || '',
              tier: customer.tier || 'Standard',
              status: customer.status || 'active'
            }));
            
            console.log('Transformed customers:', this.availableCustomers);
          } else {
            console.warn('Invalid customer response structure:', response);
            this.availableCustomers = [];
          }
        },
        error: (error) => {
          this.isLoadingCustomers = false;
          console.error('Customer DDL error:', error);
          this.availableCustomers = [];
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

  onCustomerSelect(): void {
    const customerId = this.assignCustomerForm.get('customer_id')?.value;
    this.selectedCustomer = this.availableCustomers.find(c => c.id === parseInt(customerId)) || null;
  }

  toggleUserSelection(user: SystemUser): void {
    if (!this.selectedUsers.some(u => u.id === user.id)) {
      this.selectedUsers.push(user);

      this.assignCustomerForm.patchValue({
        assigned_users: this.selectedUsers.map(u => ({ user_id: u.id }))
      });

      this.filterUsers();
    }
  }

  removeSelectedUser(user: SystemUser): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);

      this.assignCustomerForm.patchValue({
        assigned_users: this.selectedUsers.map(u => ({ user_id: u.id }))
      });

      this.filterUsers();
    }
  }

  onSubmitAssignCustomer(): void {
    if (!this.selectedProject || !this.assignCustomerForm.valid ||
      this.isSubmitting || this.selectedUsers.length === 0) {
      if (this.selectedUsers.length === 0) {
        this.showError('Please select at least one user');
      }
      return;
    }

    this.isSubmitting = true;

    const formData: CreateCustomerForProjectDto = {
      project_id: this.selectedProject.id,
      customer_id: parseInt(this.assignCustomerForm.get('customer_id')?.value),
      assigned_users: this.selectedUsers.map(user => ({
        user_id: user.id
      }))
    };

    console.log('Sending payload:', formData);

    this.apiService.post('customer-for-project', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.status === 1 || response.code === 1)) {
            this.onCustomerAssignedSuccess();
            this.closeAssignCustomerModal();
            this.showSuccess('Customer assigned to project successfully!');
            this.loadCFPData();
          } else {
            this.showError('Failed to assign customer to project');
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Assignment error:', error);
          this.showError('Failed to assign customer to project');
        }
      });
  }

  private onCustomerAssignedSuccess(): void {
    if (this.selectedCustomer && this.selectedProject) {
      const newCustomer: ProjectCustomerItem = {
        id: Math.floor(Math.random() * 1000),
        project_id: this.selectedProject.id,
        customer_id: this.selectedCustomer.id,
        customer_name: this.selectedCustomer.company,
        customer_email: this.selectedCustomer.email,
        customer_phone: this.selectedCustomer.phone || '',
        assigned_user_names: this.selectedUsers.map(u => this.getUserDisplayName(u)),
        user_count: this.selectedUsers.length,
        open_tickets_count: 0,
        created_date: new Date().toISOString(),
        created_by: 1,
        assigned_users: []
      };

      this.projectCustomers.unshift(newCustomer);
      this.filterCustomers();

      if (this.projectStats) {
        this.projectStats.total_customers++;
        this.projectStats.total_users += this.selectedUsers.length;
      }
    }
  }

  // ============ FILTERING ============
  filterProjects(): void {
    const searchTerm = this.projectSearchTerm.toLowerCase();
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = !searchTerm ||
        project.name.toLowerCase().includes(searchTerm) ||
        (project.description && project.description.toLowerCase().includes(searchTerm));

      const matchesStatus = this.selectedStatusFilter === 'all' ||
        project.status === this.selectedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  filterCustomers(): void {
    const searchTerm = this.customerSearchTerm.toLowerCase();
    this.filteredCustomers = this.projectCustomers.filter(customer =>
      !searchTerm ||
      customer.customer_name.toLowerCase().includes(searchTerm) ||
      customer.customer_email.toLowerCase().includes(searchTerm)
    );
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

  onProjectSearchChange(): void { this.filterProjects(); }
  onCustomerSearchChange(): void { this.filterCustomers(); }
  onStatusFilterChange(): void { this.filterProjects(); }

  exportProjectData(): void {
    this.showSuccess('Export feature will be implemented soon');
  }

  refreshProjectData(): void {
    if (this.selectedProject) {
      const selectedId = this.selectedProject.id;

      this.isLoading = true;
      this.loadCFPData();

      setTimeout(() => {
        if (this.selectedProject?.id === selectedId) {
          this.loadProjectData(selectedId);
        }
        this.isLoading = false;
      }, 500);
    } else {
      this.loadCFPData();
    }
  }

  // ============ UTILITY METHODS ============
  isFieldInvalid(formName: 'assign' | 'customer' | 'user', fieldName: string): boolean {
    let form: FormGroup;

    switch (formName) {
      case 'assign':
        form = this.assignCustomerForm;
        break;
      case 'customer':
        form = this.customerForm;
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

  getProjectAvatarLetter(projectName: string): string {
    return projectName ? projectName.charAt(0).toUpperCase() : '?';
  }

  getCustomerAvatarLetter(customerName: string): string {
    return customerName ? customerName.charAt(0).toUpperCase() : '?';
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
      inactive: 'status-inactive'
    };
    return statusMap[status.toLowerCase()] || 'status-default';
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

  // ============ HELPER METHODS FOR TEMPLATES ============
  getUserNamesString(users: SystemUser[]): string {
    return users.map(u => this.getUserDisplayName(u)).join(', ');
  }

  isUserNotInRemoveList(user: SystemUser): boolean {
    return !this.usersToRemove.some(u => u.id === user.id);
  }

  isUserInRemoveList(user: SystemUser): boolean {
    return this.usersToRemove.some(u => u.id === user.id);
  }

  isUserNotSelected(user: SystemUser): boolean {
    return !this.selectedUsers.some(u => u.id === user.id);
  }

  getUserAvatarLetterByName(userName: string): string {
    return userName ? userName.charAt(0).toUpperCase() : '?';
  }

  // ============ PERMISSION METHODS ============
  canManageProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canCreateCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canEditCustomer(customer: ProjectCustomerItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canDeleteCustomer(customer: ProjectCustomerItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canCreateUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  // ============ TRACK BY FUNCTIONS ============
  trackByProjectId(index: number, project: ProjectItem): number {
    return project.id;
  }

  trackByCustomerId(index: number, customer: ProjectCustomerItem): number {
    return customer.customer_id;
  }

  trackByUserId(index: number, user: ProjectUserItem): number {
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
    alert(message);
    console.log('Success:', message);
  }

  private showError(message: string): void {
    alert(message);
    console.error('Error:', message);
  }
}