// ticket-create.component.ts
import { Component, OnInit, OnDestroy, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TicketService } from '../../../shared/services/ticket.service';
// เพิ่ม imports สำหรับ dropdown components
import { ProjectDropdownComponent } from '../../../shared/components/project-dropdown/project-dropdown.component';
import { CategoryDropdownComponent } from '../../../shared/components/category-dropdown/category-dropdown.component';
import { timeout } from 'rxjs';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    ProjectDropdownComponent,  // เพิ่มตรงนี้
    CategoryDropdownComponent  // เพิ่มตรงนี้
  ],
  templateUrl: './ticket-create.component.html',
  styleUrls: ['./ticket-create.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class TicketCreateComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ticketService = inject(TicketService);

  ticketForm: FormGroup;
  
  isLoading = false;
  isSubmitting = false;
  selectedFiles: File[] = [];
  filePreviewUrls: { [key: string]: string } = {};
  fileErrors: string[] = [];
  
  currentUser: any;
  
  // เพิ่ม properties สำหรับ dropdown data
  selectedProject: any = null;
  selectedCategory: any = null;

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
    console.log('Current user:', this.currentUser);
  }

  ngOnDestroy(): void {
    // Clean up all preview URLs to prevent memory leaks
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  // เพิ่ม event handlers สำหรับ dropdowns
  onProjectChange(event: { project: any, projectId: string | number }): void {
    this.selectedProject = event.project;
    this.ticketForm.patchValue({ projectId: event.projectId });
    console.log('Project selected:', event);
  }

  onCategoryChange(event: { category: any, categoryId: string | number }): void {
    this.selectedCategory = event.category;
    this.ticketForm.patchValue({ categoryId: event.categoryId });
    console.log('Category selected:', event);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      
      // Clear previous errors
      this.fileErrors = [];
      
      // ตรวจสอบไฟล์ก่อนเพิ่ม (รวมไฟล์เดิมที่เลือกไว้แล้ว)
      const allFiles = [...this.selectedFiles, ...newFiles];
      const validation = this.ticketService.validateFiles(allFiles);
      
      if (!validation.isValid) {
        this.fileErrors = validation.errors;
        input.value = ''; // Clear input
        return;
      }
      
      // Create preview URLs for image files
      const imagePromises = newFiles
        .filter(file => this.isImageFile(file))
        .map(file => 
          this.ticketService.createImagePreview(file)
            .then(url => this.filePreviewUrls[file.name] = url)
            .catch(err => console.warn('Failed to create preview for', file.name, err))
        );
      
      // Wait for all image previews to load
      Promise.all(imagePromises).then(() => {
        this.selectedFiles = [...this.selectedFiles, ...newFiles];
        this.ticketForm.patchValue({ attachments: this.selectedFiles });
        console.log('Files selected:', this.selectedFiles.length);
      });
      
      // Clear the input to allow selecting the same files again if needed
      input.value = '';
    }
  }

  removeFile(index: number): void {
    const file = this.selectedFiles[index];
    
    // Clean up preview URL
    if (this.filePreviewUrls[file.name]) {
      // For blob URLs, revoke them to prevent memory leaks
      if (this.filePreviewUrls[file.name].startsWith('blob:')) {
        URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      }
      delete this.filePreviewUrls[file.name];
    }
    
    this.selectedFiles.splice(index, 1);
    this.ticketForm.patchValue({ attachments: this.selectedFiles });
    
    // Clear file errors if files are now valid
    if (this.selectedFiles.length === 0) {
      this.fileErrors = [];
    } else {
      const validation = this.ticketService.validateFiles(this.selectedFiles);
      this.fileErrors = validation.errors;
    }
    
    console.log('File removed. Remaining files:', this.selectedFiles.length);
  }

  onSubmit(): void {
    if (this.ticketForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData = this.ticketForm.value;
      console.log('Submitting ticket with files:', { 
        formData, 
        filesCount: this.selectedFiles.length 
      });

      // ตรวจสอบไฟล์ก่อนส่ง
      if (this.selectedFiles.length > 0) {
        const validation = this.ticketService.validateFiles(this.selectedFiles);
        
        if (!validation.isValid) {
          this.onSubmitError(validation.errors.join('\n'));
          return;
        }

        // สร้างตั๋วพร้อมไฟล์แนบ
        this.ticketService.createTicketWithAttachments(
          validation.validFiles,
          parseInt(formData.projectId),
          parseInt(formData.categoryId),
          formData.issueDescription,
          'reporter'
        ).pipe(timeout(5000)
        ).subscribe({
          next: (response) => {
            console.log('Full API response:', response);
            console.log('Response type:', typeof response);
            console.log('Response keys:', Object.keys(response || {}));
            
            if (response.code === '2' || response.code === 2 || response.status === true || response.status === 1) {
              this.onTicketCreatedWithAttachments(response.data || response);
            } else {
              this.onSubmitError('Failed to create ticket: ' + (response.message || 'Unknown error'));
            }
          },
          error: (error) => {
            console.error('Error creating ticket with attachments:', error);
            console.error('Error type:', typeof error);
            console.error('Error details:', error);
            this.onSubmitError(typeof error === 'string' ? error : 'เกิดข้อผิดพลาดในการสร้างตั๋ว');
          }
        });
      } else {
        // สร้างตั๋วโดยไม่มีไฟล์แนบ (ใช้ API เดิม)
        const ticketData = {
          project_id: parseInt(formData.projectId),
          categories_id: parseInt(formData.categoryId),
          issue_description: formData.issueDescription,
          status_id: 1, // Default to "New" status
          create_by: this.currentUser?.id
        };

        console.log('Creating ticket without attachments:', ticketData);

        this.apiService.createTicket(ticketData).subscribe({
          next: (response) => {
            console.log('Ticket created:', response);
            if (response.code === '2' || response.status === 1) {
              this.onTicketCreated();
            } else {
              this.onSubmitError('Failed to create ticket: ' + response.message);
            }
          },
          error: (error) => {
            console.error('Error creating ticket:', error);
            this.onSubmitError('เกิดข้อผิดพลาดในการสร้างตั๋ว');
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private onTicketCreatedWithAttachments(data: any): void {
    this.isSubmitting = false;
    
    console.log('Full response data:', data);
    
    // ตรวจสอบ structure ของ response
    let ticketInfo = null;
    let attachments = [];
    let ticketNo = '';
    
    // ลองหา ticket info ในรูปแบบต่างๆ
    if (data && data.ticket) {
      ticketInfo = data.ticket;
      attachments = data.attachments || [];
    } else if (data && data.data && data.data.ticket) {
      ticketInfo = data.data.ticket;
      attachments = data.data.attachments || [];
    } else if (data) {
      // ถ้า data เป็น ticket object โดยตรง
      ticketInfo = data;
      attachments = [];
    }
    
    // ลองหา ticket_no ในรูปแบบต่างๆ
    if (ticketInfo) {
      ticketNo = ticketInfo.ticket_no || 
                ticketInfo.ticketNo || 
                ticketInfo.ticket_number || 
                ticketInfo.id || 
                'ไม่ระบุ';
    }
    
    console.log('Ticket created successfully:', ticketInfo);
    console.log('Attachments uploaded:', attachments);
    
    // แสดงข้อความสำเร็จพร้อมรายละเอียด
    let message = 'สร้างตั๋วสำเร็จ!';
    
    if (ticketNo && ticketNo !== 'ไม่ระบุ') {
      message += `\nเลขที่ตั๋ว: ${ticketNo}`;
    }
    
    if (attachments && attachments.length > 0) {
      message += `\nไฟล์แนบ: ${attachments.length} ไฟล์`;
    }
    
    alert(message);
    this.router.navigate(['/dashboard']);
  }

  private onTicketCreated(): void {
    this.isSubmitting = false;
    alert('สร้างตั๋วเรียบร้อยแล้ว');
    this.router.navigate(['/dashboard']);
  }

  private onSubmitError(error: any): void {
    this.isSubmitting = false;
    
    let message = 'เกิดข้อผิดพลาดในการสร้างตั๋ว';
    
    // จัดการ error ในรูปแบบต่างๆ
    if (typeof error === 'string') {
      message = error;
    } else if (error && error.message) {
      message = error.message;
    } else if (error && error.error && error.error.message) {
      message = error.error.message;
    }
    
    console.error('Submit error details:', error);
    alert(message);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.ticketForm.controls).forEach(key => {
      const control = this.ticketForm.get(key);
      control?.markAsTouched();
    });
  }

  // Helper methods for file handling
  getFileIconClass(file: File): string {
    return this.ticketService.getFileIcon(file.name);
  }

  formatFileSize(bytes: number): string {
    return this.ticketService.formatFileSize(bytes);
  }

  isImageFile(file: File): boolean {
    return this.ticketService.isImageFile(file);
  }

  getFilePreview(file: File): string {
    return this.filePreviewUrls[file.name] || '';
  }

  getFileTypeClass(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'file-icon-pdf';
      case 'doc':
      case 'docx':
        return 'file-icon-doc';
      case 'txt':
        return 'file-icon-txt';
      case 'xls':
      case 'xlsx':
        return 'file-icon-excel';
      default:
        return 'file-icon-default';
    }
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

  insertImage(): void {
    const url = prompt('Enter image URL:');
    if (url) {
      document.execCommand('insertImage', false, url);
    }
  }

  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLElement;
    const content = target.innerHTML;
    this.ticketForm.patchValue({ issueDescription: content });
  }

  // Form validation helper methods
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
