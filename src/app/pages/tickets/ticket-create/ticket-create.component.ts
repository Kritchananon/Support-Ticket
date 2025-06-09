import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TicketService } from '../../../shared/services/ticket.service';
import { ProjectDropdownComponent } from '../../../shared/components/project-dropdown/project-dropdown.component';
import { CategoryDropdownComponent } from '../../../shared/components/category-dropdown/category-dropdown.component';
import { debounceTime } from 'rxjs';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    ProjectDropdownComponent,
    CategoryDropdownComponent
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

  // เพิ่ม properties สำหรับจัดการ validation errors
  showValidationErrors = false;
  validationErrors: { [key: string]: boolean } = {};
  
  // เพิ่ม properties สำหรับ custom alert
  showCustomAlert = false;
  alertMessage = '';
  alertType: 'error' | 'success' = 'error';

  // ✅ เพิ่ม properties สำหรับ hidden fields และ state management
  ticketId: number | null = null;
  ticketNo: string = '';
  isTicketCreated = false;

  // ✅ เพิ่ม properties สำหรับ file upload states
  uploadedFileNames: string[] = [];
  uploadingFileNames: string[] = [];
  errorFileNames: string[] = [];

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
    
    // ✅ ติดตาม description changes สำหรับ auto-save
    this.ticketForm.get('issueDescription')?.valueChanges
      .pipe(debounceTime(1000)) // รอ 1 วินาที หลังหยุดพิมพ์
      .subscribe(value => {
        console.log('Issue Description changed:', value);
        this.onFormCompleted();
      });
  }

  ngOnDestroy(): void {
    // Clean up all preview URLs to prevent memory leaks
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }

  // ✅ event handlers สำหรับ dropdowns พร้อม auto-check
  onProjectChange(event: { project: any, projectId: string | number }): void {
    this.selectedProject = event.project;
    this.ticketForm.patchValue({ projectId: event.projectId });
    
    // ล้าง validation error เมื่อมีการเลือก project
    if (event.projectId && this.validationErrors['projectId']) {
      this.validationErrors['projectId'] = false;
    }
    
    console.log('Project selected:', event);
    // ✅ ตรวจสอบ form completion ทันที
    this.onFormCompleted();
  }

  onCategoryChange(event: { category: any, categoryId: string | number }): void {
    this.selectedCategory = event.category;
    this.ticketForm.patchValue({ categoryId: event.categoryId });
    
    // ล้าง validation error เมื่อมีการเลือก category
    if (event.categoryId && this.validationErrors['categoryId']) {
      this.validationErrors['categoryId'] = false;
    }
    
    console.log('Category selected:', event);
    // ✅ ตรวจสอบ form completion ทันที
    this.onFormCompleted();
  }

  // ✅ METHOD ใหม่: ตรวจสอบความครบถ้วนของ form และสร้าง ticket อัตโนมัติ
  onFormCompleted(): void {
    // ตรวจสอบว่าครบทั้ง 3 ช่องและยังไม่ได้สร้าง ticket
    const validation = this.validateFormForAutoSave();
    
    if (validation.isValid && !this.isTicketCreated && !this.isSubmitting) {
      console.log('Form completed! Auto-creating ticket...');
      this.createTicketAutomatically();
    }
  }

  // ✅ METHOD ใหม่: validate form สำหรับ auto-save
  private validateFormForAutoSave(): { isValid: boolean; errors?: string[] } {
    const projectId = this.ticketForm.get('projectId')?.value;
    const categoryId = this.ticketForm.get('categoryId')?.value;
    const issueDescription = this.ticketForm.get('issueDescription')?.value;

    const errors: string[] = [];

    if (!projectId || projectId === '') {
      errors.push('กรุณาเลือก Project');
    }

    if (!categoryId || categoryId === '') {
      errors.push('กรุณาเลือก Category');
    }

    if (!issueDescription || issueDescription.trim().length < 10) {
      errors.push('กรุณากรอกรายละเอียด Issue อย่างน้อย 10 ตัวอักษร');
    }

    const isValid = errors.length === 0;
    return { isValid, errors };
  }

  // ✅ METHOD ใหม่: สร้าง ticket อัตโนมัติด้วย saveTicket API
  private createTicketAutomatically(): void {
    this.isSubmitting = true;
    
    const formData = this.ticketForm.value;
    
    // เตรียมข้อมูลสำหรับ saveTicket API
    const ticketData = {
      project_id: parseInt(formData.projectId),
      categories_id: parseInt(formData.categoryId),
      issue_description: formData.issueDescription
      // ไม่ส่ง ticket_id เพื่อให้ API สร้างใหม่
    };

    console.log('Auto-creating ticket with data:', ticketData);

    // ✅ ใช้ saveTicket API แทน createTicket
    this.apiService.saveTicket(ticketData).subscribe({
      next: (response) => {
        console.log('saveTicket response:', response);
        
        if (response.code === 1) {
          // ✅ บันทึก ticket_id และ ticket_no จาก response
          this.ticketId = response.ticket_id;
          this.ticketNo = response.ticket_no;
          this.isTicketCreated = true;
          
          console.log('Ticket created successfully:', {
            ticketId: this.ticketId,
            ticketNo: this.ticketNo
          });
          
          // แสดง success message และ update UI
          this.showSuccessMessage(`✅ Ticket ${this.ticketNo} created successfully!`);
          this.addSuccessState();
          
        } else {
          this.onAutoCreateError('Failed to create ticket: ' + response.message);
        }
        
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error auto-creating ticket:', error);
        this.onAutoCreateError('เกิดข้อผิดพลาดในการสร้างตั๋ว');
        this.isSubmitting = false;
      }
    });
  }

  // ✅ METHOD ใหม่: จัดการ error จาก auto-create
  private onAutoCreateError(error: any): void {
    let message = 'เกิดข้อผิดพลาดในการสร้างตั๋ว';
    
    if (typeof error === 'string') {
      message = error;
    } else if (error && error.message) {
      message = error.message;
    }
    
    console.error('Auto-create error:', error);
    
    // แสดง error alert
    this.alertMessage = message;
    this.alertType = 'error';
    this.showCustomAlert = true;
    
    // Reset state
    this.isTicketCreated = false;
    this.ticketId = null;
    this.ticketNo = '';
  }

  // ✅ METHOD ใหม่: แสดง success message และ update UI
  private showSuccessMessage(message: string): void {
    console.log('Success:', message);
    // สามารถแสดง toast notification ได้ที่นี่
  }

  // ✅ METHOD ใหม่: เพิ่ม success state ให้ UI
  private addSuccessState(): void {
    // เพิ่ม success class ให้ form elements
    setTimeout(() => {
      const form = document.querySelector('.ticket-form');
      const richEditor = document.querySelector('.rich-text-editor-container');
      
      if (form) form.classList.add('success');
      if (richEditor) richEditor.classList.add('success');
      
      // เพิ่ม class ให้ file upload area ถ้ามีไฟล์
      if (this.selectedFiles.length > 0) {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (fileUploadArea) fileUploadArea.classList.add('has-files');
      }
    }, 100);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      
      // Clear previous errors
      this.fileErrors = [];
      
      // ตรวจสอบไฟล์ก่อนเพิ่ม
      const allFiles = [...this.selectedFiles, ...newFiles];
      const validation = this.ticketService.validateFiles(allFiles);
      
      if (!validation.isValid) {
        // แสดง error สำหรับไฟล์
        this.fileErrors = validation.errors;
        input.value = '';
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
        
        // ✅ อัปโหลดไฟล์ทันทีหาก ticket ถูกสร้างแล้ว
        if (this.isTicketCreated && this.ticketId) {
          this.uploadFilesToExistingTicket(newFiles);
        }
      });
      
      input.value = '';
    }
  }

  // ✅ METHOD ใหม่: อัปโหลดไฟล์ไป ticket ที่สร้างแล้ว (แก้ไขแล้ว)
  private uploadFilesToExistingTicket(files: File[]): void {
    if (!this.ticketId || files.length === 0) {
      return;
    }

    console.log('Uploading files to existing ticket:', this.ticketId);

    // เพิ่มไฟล์เข้า uploading state
    files.forEach(file => {
      this.uploadingFileNames.push(file.name);
    });

    // ✅ แก้ไข: เตรียมข้อมูลให้ตรงกับ Backend ที่คาดหวัง
    const attachmentData = {
      ticket_id: this.ticketId,
      files: files,
      // ✅ เพิ่มข้อมูลที่ Backend ต้องการ (แม้ว่าจะมี ticket แล้ว แต่ Backend อาจต้องการ)
      project_id: parseInt(this.ticketForm.get('projectId')?.value),
      categories_id: parseInt(this.ticketForm.get('categoryId')?.value),
      issue_description: this.ticketForm.get('issueDescription')?.value,
      type: 'reporter'  // เพิ่ม type parameter
    };

    console.log('Attachment data being sent:', attachmentData);

    this.apiService.updateAttachment(attachmentData).subscribe({
      next: (response) => {
        console.log('updateAttachment response:', response);
        
        if (response.code === 1) {
          console.log('Files uploaded successfully:', response.data);
          
          // อัปเดต UI เพื่อแสดงสถานะการอัปโหลด
          files.forEach((file, index) => {
            this.markFileAsUploaded(file.name);
          });
          
          // ✅ แสดงข้อความสำเร็จ
          this.showSuccessMessage(`อัปโหลดไฟล์ ${files.length} ไฟล์สำเร็จ`);
          
        } else {
          console.error('File upload failed:', response.message);
          this.showFileUploadError(response.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
          files.forEach(file => {
            this.markFileAsError(file.name);
          });
        }
      },
      error: (error) => {
        console.error('File upload error:', error);
        
        // ✅ แสดง error ที่เหมาะสม
        let errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์';
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        this.showFileUploadError(errorMessage);
        files.forEach(file => {
          this.markFileAsError(file.name);
        });
      }
    });
  }

  // ✅ METHOD ใหม่: mark ไฟล์ว่าอัปโหลดแล้ว
  private markFileAsUploaded(fileName: string): void {
    // ลบออกจาก uploading และ error lists
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== fileName);
    this.errorFileNames = this.errorFileNames.filter(name => name !== fileName);
    
    // เพิ่มเข้า uploaded list
    if (!this.uploadedFileNames.includes(fileName)) {
      this.uploadedFileNames.push(fileName);
    }
  }

  // ✅ METHOD ใหม่: mark ไฟล์ว่ามี error
  private markFileAsError(fileName: string): void {
    // ลบออกจาก uploading list
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== fileName);
    
    // เพิ่มเข้า error list
    if (!this.errorFileNames.includes(fileName)) {
      this.errorFileNames.push(fileName);
    }
  }

  // ✅ METHOD ใหม่: แสดง error ของการอัปโหลดไฟล์
  private showFileUploadError(message: string): void {
    this.fileErrors.push(message);
  }

  removeFile(index: number): void {
    const file = this.selectedFiles[index];
    
    // Clean up preview URL
    if (this.filePreviewUrls[file.name]) {
      if (this.filePreviewUrls[file.name].startsWith('blob:')) {
        URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      }
      delete this.filePreviewUrls[file.name];
    }
    
    // ลบออกจาก state arrays
    this.uploadedFileNames = this.uploadedFileNames.filter(name => name !== file.name);
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== file.name);
    this.errorFileNames = this.errorFileNames.filter(name => name !== file.name);
    
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

  // ✅ ปรับปรุง onSubmit method
  onSubmit(): void {
    console.log('Submit button clicked');
    
    // ถ้ายังไม่ได้สร้าง ticket ให้สร้างก่อน
    if (!this.isTicketCreated) {
      const validation = this.validateFormForAutoSave();
      
      if (!validation.isValid) {
        this.alertMessage = validation.errors?.join(', ') || 'กรุณากรอกข้อมูลให้ครบก่อน';
        this.alertType = 'error';
        this.showCustomAlert = true;
        return;
      }
      
      this.createTicketAutomatically();
      return;
    }
    
    // ถ้าสร้าง ticket แล้ว และมีไฟล์ที่ยังไม่ได้อัปโหลด
    if (this.selectedFiles.length > 0 && this.uploadingFileNames.length > 0) {
      // รอให้อัปโหลดเสร็จก่อน
      this.waitForUploadsAndFinish();
      return;
    }
    
    // ถ้าทุกอย่างเสร็จแล้ว ให้ redirect ไป dashboard
    this.completedTicketCreation();
  }

  // ✅ METHOD ใหม่: รอให้อัปโหลดเสร็จแล้วไป dashboard
  private waitForUploadsAndFinish(): void {
    this.isSubmitting = true;
    
    // รอ 2 วินาทีให้การอัปโหลดเสร็จ
    setTimeout(() => {
      this.isSubmitting = false;
      this.completedTicketCreation();
    }, 2000);
  }

  // ✅ METHOD ใหม่: จบกระบวนการสร้าง ticket
  private completedTicketCreation(): void {
    console.log('Ticket creation completed');
    
    // แสดง success alert
    this.alertMessage = `Ticket created successfully\nTicket ID: ${this.ticketNo}`;
    this.alertType = 'success';
    this.showCustomAlert = true;
  }

  // ✅ METHOD ใหม่: reset form เพื่อสร้าง ticket ใหม่
  resetForm(): void {
    this.ticketForm.reset();
    this.selectedFiles = [];
    this.fileErrors = [];
    this.isTicketCreated = false;
    this.ticketId = null;
    this.ticketNo = '';
    this.isSubmitting = false;
    this.showValidationErrors = false;
    this.validationErrors = {};
    
    // ล้าง file states
    this.uploadedFileNames = [];
    this.uploadingFileNames = [];
    this.errorFileNames = [];
    
    // ล้าง preview URLs
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.filePreviewUrls = {};
    
    // ลบ success classes
    this.removeSuccessState();
    
    console.log('Form reset completed');
  }

  // ✅ METHOD ใหม่: ลบ success state จาก UI
  private removeSuccessState(): void {
    const form = document.querySelector('.ticket-form');
    const richEditor = document.querySelector('.rich-text-editor-container');
    const fileUploadArea = document.querySelector('.file-upload-area');
    
    if (form) form.classList.remove('success');
    if (richEditor) richEditor.classList.remove('success');
    if (fileUploadArea) fileUploadArea.classList.remove('has-files');
  }

  // ✅ เพิ่ม getter methods สำหรับ template
  get canUploadFiles(): boolean {
    return this.isTicketCreated && this.ticketId !== null;
  }

  get isFormCompleted(): boolean {
    const validation = this.validateFormForAutoSave();
    return validation.isValid;
  }

  get hasUnsavedChanges(): boolean {
    return this.isFormCompleted && !this.isTicketCreated;
  }

  // ✅ เพิ่ม methods สำหรับ file status checking
  isFileUploaded(fileName: string): boolean {
    return this.uploadedFileNames.includes(fileName);
  }

  isFileUploading(fileName: string): boolean {
    return this.uploadingFileNames.includes(fileName);
  }

  isFileError(fileName: string): boolean {
    return this.errorFileNames.includes(fileName);
  }

  // Helper methods for file handling (เหมือนเดิม)
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

  // Text editor methods (เหมือนเดิม)
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
    
    // ล้าง validation error เมื่อมีการพิมพ์
    if (content && content.trim().length >= 10 && this.validationErrors['issueDescription']) {
      this.validationErrors['issueDescription'] = false;
    }
  }

  // Form validation helper methods
  isFieldInvalid(fieldName: string): boolean {
    return this.showValidationErrors && this.validationErrors[fieldName];
  }

  getFieldError(fieldName: string): string {
    if (this.showValidationErrors && this.validationErrors[fieldName]) {
      switch (fieldName) {
        case 'projectId':
          return 'กรุณาเลือกโปรเจค';
        case 'categoryId':
          return 'กรุณาเลือกหมวดหมู่';
        case 'issueDescription':
          return 'กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร';
        default:
          return 'กรุณากรอกข้อมูลนี้';
      }
    }
    return '';
  }
  
  // ✅ ปรับปรุง method สำหรับจัดการ custom alert
  onAlertClosed(): void {
    this.showCustomAlert = false;
    
    // ถ้าเป็น success message ให้ redirect ไป dashboard
    if (this.alertType === 'success') {
      this.router.navigate(['/dashboard']);
    }
    
    // ถ้าเป็น error message เกี่ยวกับ validation ให้แสดงขอบสีแดง
    if (this.alertType === 'error' && this.alertMessage.includes('กรุณากรอกข้อมูล')) {
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
    }
  }

  // ✅ METHOD ใหม่: mark fields ว่า invalid
  private markFieldsAsInvalid(): void {
    const validation = this.validateFormForAutoSave();
    
    if (!validation.isValid) {
      const projectId = this.ticketForm.get('projectId')?.value;
      const categoryId = this.ticketForm.get('categoryId')?.value;
      const issueDescription = this.ticketForm.get('issueDescription')?.value;
      
      this.validationErrors = {
        projectId: !projectId || projectId === '',
        categoryId: !categoryId || categoryId === '',
        issueDescription: !issueDescription || issueDescription.trim().length < 10
      };
    }
  }

  // ✅ เพิ่ม method สำหรับ handle browser refresh/close
  @HostListener('window:beforeunload', ['$event'])
  canDeactivate(event: BeforeUnloadEvent): boolean {
    if (this.hasUnsavedChanges) {
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return false;
    }
    return true;
  }
}
