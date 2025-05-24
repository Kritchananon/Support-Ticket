import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ProjectDropdownComponent } from '../../../shared/components/project-dropdown/project-dropdown.component';
import { ProjectDDL } from '../../../shared/models/project.model';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ProjectDropdownComponent],
  templateUrl: './ticket-create.component.html',
  styleUrls: ['./ticket-create.component.css']
})
export class TicketCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);

  ticketForm: FormGroup;
  categories: Category[] = [];
  
  isLoading = false;
  isSubmitting = false;
  selectedFiles: File[] = [];
  
  currentUser: any;
  showCategoryDropdown = false;
  selectedProject: ProjectDDL | null = null;

  constructor() {
    this.ticketForm = this.fb.group({
      projectId: ['', Validators.required],
      categoryId: ['', Validators.required],
      issueDescription: ['', [Validators.required, Validators.minLength(10)]],
      attachments: [[]]
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadCategories();
  }

  loadCategories(): void {
    this.apiService.getTicketCategories().subscribe({
      next: (response) => {
        if (response.code === '2' || response.status === 1) {
          this.categories = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        // Mock data for demonstration
        this.categories = [
          { id: 1, name: 'ระบบล่ม/ใช้งานไม่ได้' },
          { id: 2, name: 'ปัญหาการใช้งาน' },
          { id: 3, name: 'ขอเพิ่มฟีเจอร์ใหม่' },
          { id: 4, name: 'ขอแก้ไขข้อมูล' },
          { id: 5, name: 'อื่นๆ' }
        ];
      }
    });
  }

  onProjectSelected(event: {project: ProjectDDL | null, projectId: number | string}): void {
    this.selectedProject = event.project;
    this.ticketForm.patchValue({ projectId: event.projectId });
    console.log('Selected Project:', event);
  }

  onCategorySelect(category: Category): void {
    this.ticketForm.patchValue({ categoryId: category.id });
    this.showCategoryDropdown = false;
  }

  getSelectedCategoryName(): string {
    const categoryId = this.ticketForm.get('categoryId')?.value;
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'เลือกหมวดหมู่';
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedFiles = [...this.selectedFiles, ...newFiles];
      this.ticketForm.patchValue({ attachments: this.selectedFiles });
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.ticketForm.patchValue({ attachments: this.selectedFiles });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onSubmit(): void {
    if (this.ticketForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData = this.ticketForm.value;
      const ticketData = {
        project_id: formData.projectId,
        categories_id: formData.categoryId,
        issue_description: formData.issueDescription,
        status_id: 1, // Default to "New" status
        create_by: this.currentUser?.id
      };

      console.log('Submitting ticket:', ticketData);
      console.log('Selected project info:', this.selectedProject);

      this.apiService.createTicket(ticketData).subscribe({
        next: (response) => {
          if (response.code === '2' || response.status === 1) {
            const ticketId = response.data?.id;
            
            if (ticketId && this.selectedFiles.length > 0) {
              this.uploadFiles(ticketId);
            } else if (ticketId) {
              this.onTicketCreated();
            } else {
              console.warn('Ticket created but no ID returned');
              this.onTicketCreated();
            }
          } else {
            this.onSubmitError('Failed to create ticket: ' + response.message);
          }
        },
        error: (error) => {
          console.error('Error creating ticket:', error);
          this.onSubmitError('เกิดข้อผิดพลาดในการสร้างตั๋ว');
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private uploadFiles(ticketId: number): void {
    const uploadPromises = this.selectedFiles.map(file => 
      this.apiService.uploadFile(file, ticketId).toPromise()
    );

    Promise.all(uploadPromises)
      .then(() => {
        this.onTicketCreated();
      })
      .catch((error) => {
        console.error('Error uploading files:', error);
        this.onTicketCreated();
      });
  }

  private onTicketCreated(): void {
    this.isSubmitting = false;
    alert(`สร้างตั๋วเรียบร้อยแล้ว${this.selectedProject ? ' สำหรับโปรเจค: ' + this.selectedProject.projectName : ''}`);
    this.router.navigate(['/dashboard']);
  }

  private onSubmitError(message: string): void {
    this.isSubmitting = false;
    alert(message);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.ticketForm.controls).forEach(key => {
      const control = this.ticketForm.get(key);
      control?.markAsTouched();
    });
  }

  // Text editor methods (for rich text functionality)
  formatText(command: string): void {
    document.execCommand(command, false);
  }

  insertList(ordered: boolean): void {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
  }

  insertLink(): void {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }

  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLElement;
    const content = target.innerHTML;
    this.ticketForm.patchValue({ issueDescription: content });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.ticketForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.ticketForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'กรุณากรอกข้อมูลนี้';
      }
      if (field.errors['minlength']) {
        return 'ต้องมีอย่างน้อย 10 ตัวอักษร';
      }
    }
    return '';
  }
}
