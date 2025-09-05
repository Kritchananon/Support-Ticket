import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

// ✅ Imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { 
  CreateUserDto, 
  User,
  createEmptyCreateUserDto,
  validateCreateUserDto,
  getUserFullName
} from '../../../shared/models/user.model';

import { UserRole, ROLES } from '../../../shared/models/permission.model';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.css']
})
export class UserCreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Form และ State Management
  userForm: FormGroup;
  isEditMode = false;
  isLoading = false;
  isSaving = false;
  hasError = false;
  errorMessage = '';
  successMessage = '';
  
  // User data
  editingUserId: number | null = null;
  originalUserData: User | null = null;
  
  // Validation states
  usernameValidation = {
    isChecking: false,
    isValid: false,
    message: ''
  };
  
  // Options for dropdowns
  availableRoles: UserRole[] = [];
  
  companiesOptions = [
    { value: '', label: 'Select Company' },
    { value: 'tech-solutions', label: 'Tech Solutions Co., Ltd.' },
    { value: 'digital-marketing', label: 'Digital Marketing Inc.' },
    { value: 'innovation-hub', label: 'Innovation Hub Ltd.' },
    { value: 'creative-agency', label: 'Creative Agency Co.' },
    { value: 'startup-ventures', label: 'Startup Ventures Co.' }
  ];

  projectsOptions = [
    { value: '', label: 'Select Project' },
    { value: 'web-development', label: 'Web Development Project' },
    { value: 'mobile-app', label: 'Mobile Application' },
    { value: 'e-commerce', label: 'E-commerce Platform' },
    { value: 'cms-system', label: 'Content Management System' },
    { value: 'api-integration', label: 'API Integration' },
    { value: 'data-analytics', label: 'Data Analytics Dashboard' },
    { value: 'cloud-migration', label: 'Cloud Migration' },
    { value: 'security-audit', label: 'Security Audit & Implementation' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService
  ) {
    this.userForm = this.createUserForm();
  }

  ngOnInit(): void {
    this.determineMode();
    this.loadAvailableRoles();
    this.setupUsernameValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * ✅ กำหนดโหมดการทำงาน (Create หรือ Edit)
   */
  private determineMode(): void {
    // ตรวจสอบจาก route data
    const routeData = this.route.snapshot.data;
    if (routeData['mode'] === 'edit') {
      this.isEditMode = true;
    }

    // ตรวจสอบจาก route parameter
    const userId = this.route.snapshot.params['id'];
    if (userId) {
      this.isEditMode = true;
      this.editingUserId = parseInt(userId);
      this.loadUserDataForEdit(this.editingUserId);
    }

    console.log('User Create Component Mode:', {
      isEditMode: this.isEditMode,
      editingUserId: this.editingUserId
    });
  }

  /**
   * ✅ สร้างฟอร์ม
   */
  private createUserForm(): FormGroup {
    return this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9_.-]+$/)
      ]],
      firstname: ['', [
        Validators.required,  // เพิ่ม required
        Validators.maxLength(100)
      ]],
      lastname: ['', [
        Validators.required,  // เพิ่ม required
        Validators.maxLength(100)
      ]],
      email: ['', [
        Validators.required,  // เพิ่ม required
        Validators.email,
        Validators.maxLength(255)
      ]],
      phone: ['', [
        Validators.pattern(/^[0-9\-\s\+\(\)]+$/)
      ]],
      company: ['', [
        Validators.required  // เพิ่ม required
      ]],
      companyAddress: ['', [
        Validators.maxLength(500)
      ]],
      project: ['', [
        Validators.required  // เพิ่ม required
      ]],
      password: ['', [
        Validators.required,  // เพิ่ม required
        Validators.minLength(8),
        Validators.maxLength(255)
      ]],
      confirmPassword: ['', [
        Validators.required  // เพิ่ม required
      ]],
      roles: [[], [
        Validators.required,  // เพิ่ม required
        Validators.minLength(1)  // ต้องเลือกอย่างน้อย 1 role
      ]],
      isenabled: [true]
    });
  }

  /**
   * ✅ โหลดข้อมูลผู้ใช้สำหรับการแก้ไข
   */
  private loadUserDataForEdit(userId: number): void {
    this.isLoading = true;
    this.hasError = false;

    console.log('Loading user data for edit:', userId);

    this.apiService.getUserById(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          if (user) {
            this.originalUserData = user;
            this.populateFormWithUserData(user);
            console.log('User data loaded for edit:', user);
          } else {
            this.showError('User not found');
            this.navigateBack();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading user data:', error);
          this.showError('Failed to load user data');
          this.isLoading = false;
        }
      });
  }

  /**
   * ✅ เติมข้อมูลลงฟอร์มสำหรับการแก้ไข
   */
  private populateFormWithUserData(user: User): void {
    this.userForm.patchValue({
      username: user.username,
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      email: user.email || '',
      phone: user.phone || '',
      company: '',
      companyAddress: user.companyAddress || '',
      project: user.project || '',
      roles: user.roles || [],
      isenabled: user.isenabled !== false
    });

    // ในโหมดแก้ไข ไม่ต้องใส่รหัสผ่าน
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('confirmPassword')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();
  }

  /**
   * ✅ โหลดรายการ roles ที่มี
   */
  private loadAvailableRoles(): void {
    this.apiService.getUserRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.availableRoles = roles;
          console.log('Available roles loaded:', roles);
        },
        error: (error) => {
          console.warn('Error loading roles, using defaults:', error);
          this.availableRoles = [ROLES.USER, ROLES.SUPPORTER, ROLES.ADMIN];
        }
      });
  }

  /**
   * ✅ ตั้งค่าการตรวจสอบ username แบบ real-time
   */
  private setupUsernameValidation(): void {
    const usernameControl = this.userForm.get('username');
    if (!usernameControl) return;

    usernameControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(username => {
      if (username && username.length >= 3 && usernameControl.valid) {
        this.checkUsernameAvailability(username);
      } else {
        this.usernameValidation = {
          isChecking: false,
          isValid: false,
          message: ''
        };
      }
    });
  }

  /**
   * ✅ ตรวจสอบว่า username ซ้ำหรือไม่
   */
  private checkUsernameAvailability(username: string): void {
    this.usernameValidation.isChecking = true;

    const excludeUserId = this.isEditMode ? this.editingUserId : undefined;

    this.apiService.checkUsernameExists(username, excludeUserId || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exists) => {
          this.usernameValidation = {
            isChecking: false,
            isValid: !exists,
            message: exists ? 'This username is already taken' : 'Username is available'
          };
        },
        error: (error) => {
          console.warn('Username check failed:', error);
          this.usernameValidation = {
            isChecking: false,
            isValid: true, // ถ้าตรวจสอบไม่ได้ ให้ถือว่าใช้ได้
            message: ''
          };
        }
      });
  }

  /**
   * ✅ ส่งฟอร์ม
   */
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.markAllFieldsAsTouched();
      this.showError('Please correct the errors in the form');
      return;
    }

    if (!this.usernameValidation.isValid && !this.isEditMode) {
      this.showError('Please choose a different username');
      return;
    }

    const formData = this.prepareFormData();
    
    if (this.isEditMode) {
      this.updateUser(formData);
    } else {
      this.createUser(formData);
    }
  }

  /**
   * ✅ เตรียมข้อมูลสำหรับส่ง API
   */
  private prepareFormData(): CreateUserDto {
    const formValue = this.userForm.value;
    
    const userData: CreateUserDto = {
      username: formValue.username?.trim(),
      firstname: formValue.firstname?.trim() || undefined,
      lastname: formValue.lastname?.trim() || undefined,
      email: formValue.email?.trim() || undefined,
      phone: formValue.phone?.trim() || undefined,
      isenabled: formValue.isenabled !== false,
      roles: formValue.roles || []
    };

    // เพิ่ม fields ใหม่ที่อาจไม่มีใน interface ปัจจุบัน
    if (formValue.companyAddress?.trim()) {
      (userData as any).companyAddress = formValue.companyAddress.trim();
    }
    
    if (formValue.project) {
      (userData as any).project = formValue.project;
    }

    // เพิ่มรหัสผ่านเฉพาะการสร้างใหม่
    if (!this.isEditMode && formValue.password) {
      userData.password = formValue.password;
    }

    console.log('Prepared form data:', userData);
    return userData;
  }

  /**
   * ✅ สร้าง user ใหม่
   */
  private createUser(createData: any): void {
    this.isSaving = true;
    this.hasError = false;
    
    console.log('Creating new user:', createData);

    this.apiService.createUser(createData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('User created successfully:', response);
          
          // ตรวจสอบ response ตาม format ของ backend โดยแปลง code เป็น string
          if (response && String(response.code) === '1' && response.data) {
            const userName = this.getUserDisplayName(response.data);
            this.showSuccess(`User "${userName}" has been created successfully`);
            
            // ส่งอีเมลต้อนรับ (ถ้ามีอีเมล)
            if (response.data.email) {
              this.sendWelcomeEmail(response.data.email);
            }
            
            // นำทางกลับหลังจาก 2 วินาที
            setTimeout(() => {
              this.navigateBack();
            }, 2000);
          } else {
            this.showError(response?.message || 'User created but response was unexpected');
          }
          
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error creating user:', error);
          
          // แสดงข้อความ error ที่เหมาะสม
          let errorMessage = 'Failed to create user. Please try again.';
          
          if (error.message) {
            errorMessage = error.message;
          }
          
          this.showError(errorMessage);
          this.isSaving = false;
        }
      });
  }

  /**
   * ✅ ดึงชื่อที่แสดงของผู้ใช้
   */
  private getUserDisplayName(user: any): string {
    if (user.firstname && user.lastname) {
      return `${user.firstname} ${user.lastname}`;
    } else if (user.firstname) {
      return user.firstname;
    } else if (user.lastname) {
      return user.lastname;
    } else {
      return user.username || 'Unknown User';
    }
  }

  /**
   * ✅ อัปเดต user
   */
  private updateUser(userData: CreateUserDto): void {
    if (!this.editingUserId) {
      this.showError('User ID not found');
      return;
    }

    this.isSaving = true;
    this.hasError = false;
    
    console.log('Updating user:', this.editingUserId, userData);

    this.apiService.updateUser(this.editingUserId, userData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('User updated successfully:', response);
          
          if (response.status && response.data) {
            const userName = getUserFullName(response.data);
            this.showSuccess(`User "${userName}" has been updated successfully`);
            
            // นำทางกลับหลังจาก 2 วินาที
            setTimeout(() => {
              this.navigateBack();
            }, 2000);
          } else {
            this.showError('User updated but response was unexpected');
          }
          
          this.isSaving = false;
        },
        error: (error) => {
          console.error('Error updating user:', error);
          this.showError('Failed to update user. Please try again.');
          this.isSaving = false;
        }
      });
  }

  /**
   * ✅ ส่งอีเมลต้อนรับ
   */
  private sendWelcomeEmail(email: string): void {
    this.apiService.sendUserEmail(email, 'welcome')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            console.log('Welcome email sent successfully');
          }
        },
        error: (error) => {
          console.warn('Failed to send welcome email:', error);
        }
      });
  }

  /**
   * ✅ ยกเลิกและกลับไป
   */
  onCancel(): void {
    if (this.userForm.dirty) {
      const confirmMessage = this.isEditMode 
        ? 'You have unsaved changes. Are you sure you want to leave?' 
        : 'Are you sure you want to cancel creating this user?';
      
      if (confirm(confirmMessage)) {
        this.navigateBack();
      }
    } else {
      this.navigateBack();
    }
  }

  /**
   * ✅ นำทางกลับไปหน้า User Account
   */
  private navigateBack(): void {
    this.router.navigate(['/settings/user-account']);
  }

  /**
   * ✅ แสดงข้อความผิดพลาด
   */
  private showError(message: string): void {
    this.hasError = true;
    this.errorMessage = message;
    this.successMessage = '';
    
    // เลื่อนขึ้นไปด้านบน
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * ✅ แสดงข้อความสำเร็จ
   */
  private showSuccess(message: string): void {
    this.hasError = false;
    this.errorMessage = '';
    this.successMessage = message;
    
    // เลื่อนขึ้นไปด้านบน
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * ✅ Mark all fields as touched สำหรับแสดง validation errors
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }

  // ===== Template Helper Methods ===== ✅

  /**
   * ✅ ตรวจสอบว่า field มี error หรือไม่
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * ✅ ดึงข้อความ error ของ field
   */
  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;

    if (errors['required']) return `${this.getFieldDisplayName(fieldName)} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['minlength']) return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters`;
    if (errors['maxlength']) return `${this.getFieldDisplayName(fieldName)} cannot exceed ${errors['maxlength'].requiredLength} characters`;
    if (errors['pattern']) {
      if (fieldName === 'username') return 'Username can only contain letters, numbers, dots, hyphens, and underscores';
      if (fieldName === 'phone') return 'Please enter a valid phone number';
    }

    return 'Invalid value';
  }

  /**
   * ✅ ดึงชื่อที่แสดงของ field
   */
  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      'username': 'Username',
      'firstname': 'First Name',
      'lastname': 'Last Name',
      'email': 'Email',
      'phone': 'Phone',
      'companyAddress': 'Company Address',
      'project': 'Project',
      'password': 'Password',
      'confirmPassword': 'Confirm Password'
    };
    
    return displayNames[fieldName] || fieldName;
  }

  /**
   * ✅ ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
   */
  get passwordMismatch(): boolean {
    if (this.isEditMode) return false;
    
    const password = this.userForm.get('password')?.value;
    const confirmPassword = this.userForm.get('confirmPassword')?.value;
    
    return password && confirmPassword && password !== confirmPassword;
  }

  /**
   * ✅ ดึงชื่อหน้า
   */
  get pageTitle(): string {
    return this.isEditMode ? 'Edit User' : 'Create New User';
  }

  /**
   * ✅ ดึงชื่อปุ่ม submit
   */
  get submitButtonText(): string {
    if (this.isSaving) {
      return this.isEditMode ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode ? 'Update User' : 'Create User';
  }

  /**
   * ✅ ตรวจสอบว่าควรแสดง password fields หรือไม่
   */
  get shouldShowPasswordFields(): boolean {
    return !this.isEditMode;
  }

  /**
   * ✅ ตรวจสอบสิทธิ์ในการเลือก roles
   */
  canAssignRoles(): boolean {
    return true;
  }

  /**
   * ✅ แปลง role เป็นชื่อที่แสดง
   */
  getRoleDisplayName(role: any): string {
    // ถ้า role เป็น object ที่มี role_name
    if (role && typeof role === 'object' && role.role_name) {
      return role.role_name;
    }
    
    // ถ้า role เป็น string (fallback สำหรับ roles เก่า)
    if (typeof role === 'string') {
      const roleNames: { [key: string]: string } = {
        'ADMIN': 'Administrator',
        'SUPPORTER': 'Support Team',
        'USER': 'User'
      };
      return roleNames[role] || role;
    }
    
    return 'Unknown Role';
  }

  /**
   * ✅ ตรวจสอบว่า role ถูกเลือกหรือไม่
   */
  isRoleSelected(role: any): boolean {
    const selectedRoles = this.userForm.get('roles')?.value || [];
    
    // ถ้า role เป็น object ให้เปรียบเทียบ id
    if (role && typeof role === 'object' && role.id) {
      return selectedRoles.some((selected: any) => {
        if (typeof selected === 'object' && selected.id) {
          // เปรียบเทียบ id โดยแปลงเป็น string เพื่อหลีกเลี่ยงปัญหา type
          return String(selected.id) === String(role.id);
        }
        return false;
      });
    }
    
    // ถ้า role เป็น string (fallback)
    if (typeof role === 'string') {
      return selectedRoles.includes(role);
    }
    
    return false;
  }

  /**
   * ✅ เปลี่ยนการเลือก role
   */
  onRoleChange(role: any, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const currentRoles = this.userForm.get('roles')?.value || [];
    
    console.log('Role change:', { role, checked: checkbox.checked, currentRoles });
    
    if (checkbox.checked) {
      // เพิ่ม role
      if (role && typeof role === 'object' && role.id) {
        // ตรวจสอบว่ามี role นี้อยู่แล้วหรือไม่
        const exists = currentRoles.some((selected: any) => 
          typeof selected === 'object' && String(selected.id) === String(role.id)
        );
        
        if (!exists) {
          this.userForm.patchValue({ roles: [...currentRoles, role] });
          console.log('Added role:', role);
        }
      } else if (typeof role === 'string' && !currentRoles.includes(role)) {
        this.userForm.patchValue({ roles: [...currentRoles, role] });
        console.log('Added string role:', role);
      }
    } else {
      // ลบ role
      if (role && typeof role === 'object' && role.id) {
        const updatedRoles = currentRoles.filter((selected: any) => {
          if (typeof selected === 'object' && selected.id) {
            return String(selected.id) !== String(role.id);
          }
          return true;
        });
        this.userForm.patchValue({ roles: updatedRoles });
        console.log('Removed role:', role);
      } else if (typeof role === 'string') {
        const updatedRoles = currentRoles.filter((r: any) => r !== role);
        this.userForm.patchValue({ roles: updatedRoles });
        console.log('Removed string role:', role);
      }
    }
    
    console.log('Updated roles:', this.userForm.get('roles')?.value);
  }

  /**
   * ✅ TrackBy function สำหรับ *ngFor performance
   */
  trackByRoleId(index: number, role: any): any {
    return role && role.id ? role.id : index;
  }
}