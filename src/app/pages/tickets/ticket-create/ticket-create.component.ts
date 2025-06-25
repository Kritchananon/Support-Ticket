import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, HostListener, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  ticketForm: FormGroup;
  
  isLoading = false;
  isSubmitting = false;
  selectedFiles: File[] = [];
  filePreviewUrls: { [key: string]: string } = {};
  fileErrors: string[] = [];
  
  currentUser: any;
  
  selectedProject: any = null;
  selectedCategory: any = null;

  showValidationErrors = false;
  validationErrors: { [key: string]: boolean } = {};
  
  showCustomAlert = false;
  alertMessage = '';
  alertType: 'error' | 'success' = 'error';
  
  autoNavigationTimer: any = null;

  // ✅ แก้ไข: เปลี่ยนจาก ticketId เป็น ticketNo สำหรับการ navigate
  ticketId: number | null = null;
  ticket_no: string = '';
  isTicketCreated = false;

  uploadedFileNames: string[] = [];
  uploadingFileNames: string[] = [];
  errorFileNames: string[] = [];
  fileSuccessMessages: string[] = [];
  
  isNavigating = false;

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
    
    this.restoreIncompleteTicket();
    
    this.ticketForm.get('issueDescription')?.valueChanges
      .pipe(debounceTime(1000))
      .subscribe(value => {
        console.log('Issue Description changed:', value);
        this.onFormCompleted();
      });
  }

  ngOnDestroy(): void {
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    
    if (this.autoNavigationTimer) {
      clearTimeout(this.autoNavigationTimer);
    }
  }

  private restoreIncompleteTicket(): void {
    try {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (!currentUserId) {
        console.log('No current user ID found');
        return;
      }

      const savedTicketData = localStorage.getItem(`incompleteTicket_${currentUserId}`);
      if (savedTicketData) {
        const ticketData = JSON.parse(savedTicketData);
        console.log('Found incomplete ticket for user:', currentUserId, ticketData);
        
        if (ticketData.userId !== currentUserId) {
          console.log('User ID mismatch, clearing data');
          localStorage.removeItem(`incompleteTicket_${currentUserId}`);
          return;
        }

        const savedTime = ticketData.timestamp;
        const currentTime = new Date().getTime();
        const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          console.log('Ticket data too old, clearing');
          localStorage.removeItem(`incompleteTicket_${currentUserId}`);
          return;
        }
        
        this.ticketId = ticketData.ticketId;
        this.ticket_no = ticketData.ticket_no;
        this.isTicketCreated = ticketData.isTicketCreated;
        
        this.ticketForm.patchValue({
          projectId: ticketData.formData.projectId,
          categoryId: ticketData.formData.categoryId,
          issueDescription: ticketData.formData.issueDescription
        });
        
        this.selectedProject = ticketData.selectedProject;
        this.selectedCategory = ticketData.selectedCategory;
        
        setTimeout(() => {
          this.updateUIFromRestoredData(ticketData);
        }, 500);
        
        if (this.isTicketCreated) {
          this.addSuccessState();
          console.log('Restored incomplete ticket:', this.ticket_no);
        }
      }
    } catch (error) {
      console.error('Error restoring incomplete ticket:', error);
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (currentUserId) {
        localStorage.removeItem(`incompleteTicket_${currentUserId}`);
      }
    }
  }

  private updateUIFromRestoredData(ticketData: any): void {
    if (ticketData.formData.issueDescription) {
      const richEditor = document.querySelector('.rich-editor') as HTMLElement;
      if (richEditor) {
        richEditor.innerHTML = ticketData.formData.issueDescription;
      }
    }
    
    this.ticketForm.get('projectId')?.updateValueAndValidity();
    this.ticketForm.get('categoryId')?.updateValueAndValidity();
    
    this.cdr.detectChanges();
    
    console.log('UI updated from restored data');
  }

  private saveIncompleteTicket(): void {
    if (this.isTicketCreated && this.ticketId) {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (!currentUserId) {
        console.log('No current user ID, cannot save ticket');
        return;
      }

      const ticketData = {
        userId: currentUserId,
        ticketId: this.ticketId,
        ticket_no: this.ticket_no,
        isTicketCreated: this.isTicketCreated,
        formData: {
          projectId: this.ticketForm.get('projectId')?.value,
          categoryId: this.ticketForm.get('categoryId')?.value,
          issueDescription: this.ticketForm.get('issueDescription')?.value
        },
        selectedProject: this.selectedProject,
        selectedCategory: this.selectedCategory,
        timestamp: new Date().getTime()
      };
      
      localStorage.setItem(`incompleteTicket_${currentUserId}`, JSON.stringify(ticketData));
      console.log('Saved incomplete ticket to localStorage for user:', currentUserId);
    }
  }

  private clearIncompleteTicket(): void {
    const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
    if (currentUserId) {
      localStorage.removeItem(`incompleteTicket_${currentUserId}`);
      console.log('Cleared incomplete ticket from localStorage for user:', currentUserId);
    }
  }

  onProjectChange(event: { project: any, projectId: string | number }): void {
    this.selectedProject = event.project;
    this.ticketForm.patchValue({ projectId: event.projectId });
    
    if (event.projectId && this.validationErrors['projectId']) {
      this.validationErrors['projectId'] = false;
    }
    
    console.log('Project selected:', event);
    this.onFormCompleted();
  }

  onCategoryChange(event: { category: any, categoryId: string | number }): void {
    this.selectedCategory = event.category;
    this.ticketForm.patchValue({ categoryId: event.categoryId });
    
    if (event.categoryId && this.validationErrors['categoryId']) {
      this.validationErrors['categoryId'] = false;
    }
    
    console.log('Category selected:', event);
    this.onFormCompleted();
  }

  onFormCompleted(): void {
    const validation = this.validateFormForAutoSave();
    
    if (validation.isValid && !this.isTicketCreated && !this.isSubmitting) {
      console.log('Form completed! Auto-creating ticket...');
      this.createTicketAutomatically();
    }
  }

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

  private createTicketAutomatically(): void {
    this.isSubmitting = true;
    
    const formData = this.ticketForm.value;
    
    const ticketData = {
      project_id: parseInt(formData.projectId),
      categories_id: parseInt(formData.categoryId),
      issue_description: formData.issueDescription
    };

    console.log('Auto-creating ticket with data:', ticketData);

    this.apiService.saveTicket(ticketData).subscribe({
      next: (response) => {
        console.log('saveTicket response:', response);
        
        if (response.code === 1) {
          this.ticketId = response.ticket_id;
          this.ticket_no = response.ticket_no;
          this.isTicketCreated = true;
          
          console.log('Ticket created successfully:', {
            ticketId: this.ticketId,
            ticket_no: this.ticket_no
          });
          
          this.showSuccessMessage(`✅ Ticket ${this.ticket_no} created successfully!`);
          this.addSuccessState();
          
          this.saveIncompleteTicket();
          
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

  private onAutoCreateError(error: any): void {
    let message = 'เกิดข้อผิดพลาดในการสร้างตั๋ว';
    
    if (typeof error === 'string') {
      message = error;
    } else if (error && error.message) {
      message = error.message;
    }
    
    console.error('Auto-create error:', error);
    
    this.alertMessage = message;
    this.alertType = 'error';
    this.showCustomAlert = true;
    
    this.isTicketCreated = false;
    this.ticketId = null;
    this.ticket_no = '';
  }

  private showSuccessMessage(message: string): void {
    console.log('Success:', message);
  }

  private addSuccessState(): void {
    setTimeout(() => {
      const form = document.querySelector('.ticket-form');
      const richEditor = document.querySelector('.rich-text-editor-container');
      
      if (form) form.classList.add('success');
      if (richEditor) richEditor.classList.add('success');
      
      if (this.selectedFiles.length > 0) {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (fileUploadArea) fileUploadArea.classList.add('has-files');
      }
    }, 100);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    const validation = this.validateFormForAutoSave();
    if (!validation.isValid) {
      input.value = '';
      
      this.alertMessage = 'กรุณากรอกข้อมูลให้ครบก่อน';
      this.alertType = 'error';
      this.showCustomAlert = true;
      
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
      
      return;
    }

    if (input.files) {
      const newFiles = Array.from(input.files);
      
      this.fileErrors = [];
      
      const allFiles = [...this.selectedFiles, ...newFiles];
      const fileValidation = this.ticketService.validateFiles(allFiles);
      
      if (!fileValidation.isValid) {
        this.fileErrors = fileValidation.errors;
        input.value = '';
        return;
      }
      
      const imagePromises = newFiles
        .filter(file => this.isImageFile(file))
        .map(file => 
          this.ticketService.createImagePreview(file)
            .then(url => this.filePreviewUrls[file.name] = url)
            .catch(err => console.warn('Failed to create preview for', file.name, err))
        );
      
      Promise.all(imagePromises).then(() => {
        this.selectedFiles = [...this.selectedFiles, ...newFiles];
        this.ticketForm.patchValue({ attachments: this.selectedFiles });
        console.log('Files selected:', this.selectedFiles.length);
        
        if (this.isTicketCreated && this.ticketId) {
          this.uploadFilesToExistingTicket(newFiles);
        }
      });
      
      input.value = '';
    }
  }

  private uploadFilesToExistingTicket(files: File[]): void {
    if (!this.ticketId || files.length === 0) {
      return;
    }

    console.log('Uploading files to existing ticket:', this.ticketId);

    files.forEach(file => {
      this.uploadingFileNames.push(file.name);
    });

    const attachmentData = {
      ticket_id: this.ticketId,
      files: files,
      project_id: parseInt(this.ticketForm.get('projectId')?.value),
      categories_id: parseInt(this.ticketForm.get('categoryId')?.value),
      issue_description: this.ticketForm.get('issueDescription')?.value,
      type: 'reporter'
    };

    console.log('Attachment data being sent:', attachmentData);

    this.apiService.updateAttachment(attachmentData).subscribe({
      next: (response) => {
        console.log('updateAttachment response:', response);
        
        if (response.code === 1) {
          console.log('Files uploaded successfully:', response.data);
          
          files.forEach((file, index) => {
            this.markFileAsUploaded(file.name);
          });
          
          this.showFileUploadSuccess(`อัปโหลดไฟล์ ${files.length} ไฟล์สำเร็จ`);
          
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

  private markFileAsUploaded(fileName: string): void {
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== fileName);
    this.errorFileNames = this.errorFileNames.filter(name => name !== fileName);
    
    if (!this.uploadedFileNames.includes(fileName)) {
      this.uploadedFileNames.push(fileName);
    }
  }

  private markFileAsError(fileName: string): void {
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== fileName);
    
    if (!this.errorFileNames.includes(fileName)) {
      this.errorFileNames.push(fileName);
    }
  }

  private showFileUploadSuccess(message: string): void {
    this.fileSuccessMessages.push(message);
    setTimeout(() => {
      this.fileSuccessMessages = this.fileSuccessMessages.filter(msg => msg !== message);
    }, 5000);
  }

  private showFileUploadError(message: string): void {
    this.fileErrors.push(message);
  }

  removeFile(index: number): void {
    const file = this.selectedFiles[index];
    
    if (this.filePreviewUrls[file.name]) {
      if (this.filePreviewUrls[file.name].startsWith('blob:')) {
        URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      }
      delete this.filePreviewUrls[file.name];
    }
    
    this.uploadedFileNames = this.uploadedFileNames.filter(name => name !== file.name);
    this.uploadingFileNames = this.uploadingFileNames.filter(name => name !== file.name);
    this.errorFileNames = this.errorFileNames.filter(name => name !== file.name);
    
    this.selectedFiles.splice(index, 1);
    this.ticketForm.patchValue({ attachments: this.selectedFiles });
    
    if (this.selectedFiles.length === 0) {
      this.fileErrors = [];
    } else {
      const validation = this.ticketService.validateFiles(this.selectedFiles);
      this.fileErrors = validation.errors;
    }
    
    console.log('File removed. Remaining files:', this.selectedFiles.length);
  }

  onSubmit(): void {
    console.log('Submit button clicked');
    
    const validation = this.validateFormForAutoSave();
    
    if (!validation.isValid) {
      this.alertMessage = 'กรุณากรอกข้อมูลให้ครบก่อน';
      this.alertType = 'error';
      this.showCustomAlert = true;
      
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
      
      return;
    }
    
    if (!this.isTicketCreated) {
      this.createTicketAutomatically();
      return;
    }
    
    if (this.selectedFiles.length > 0 && this.uploadingFileNames.length > 0) {
      this.waitForUploadsAndFinish();
      return;
    }
    
    this.completedTicketCreation();
  }

  private waitForUploadsAndFinish(): void {
    this.isSubmitting = true;
    
    setTimeout(() => {
      this.isSubmitting = false;
      this.completedTicketCreation();
    }, 2000);
  }

  private completedTicketCreation(): void {
    console.log('Ticket creation completed');
    
    this.clearIncompleteTicket();
    
    this.alertMessage = `Ticket created successfully\nTicket ID: ${this.ticket_no}`;
    this.alertType = 'success';
    this.showCustomAlert = true;

    // ✅ แก้ไข: ใช้ ticketNo แทน ticketId สำหรับการ navigate
    this.autoNavigationTimer = setTimeout(() => {
      if (this.ticket_no && !this.isNavigating) {
        this.navigateToTicketDetail();
      }
    }, 3000);
  }

  // ✅ แก้ไข: ใช้ ticketNo แทน ticketId สำหรับการ navigate
  private navigateToTicketDetail(): void {
    if (this.ticket_no) {
      console.log('Navigating to ticket detail with ticket_no:', this.ticket_no);
      this.isNavigating = true;
      this.showCustomAlert = false;
      
      if (this.autoNavigationTimer) {
        clearTimeout(this.autoNavigationTimer);
        this.autoNavigationTimer = null;
      }
      
      // ✅ เปลี่ยนจาก ticketId เป็น ticketNo
      this.router.navigate(['/tickets', this.ticket_no]);
    }
  }

  resetForm(): void {
    if (this.autoNavigationTimer) {
      clearTimeout(this.autoNavigationTimer);
      this.autoNavigationTimer = null;
    }
    
    this.clearIncompleteTicket();
    
    this.ticketForm.reset();
    this.selectedFiles = [];
    this.fileErrors = [];
    this.isTicketCreated = false;
    this.ticketId = null;
    this.ticket_no = '';
    this.isSubmitting = false;
    this.showValidationErrors = false;
    this.validationErrors = {};
    this.isNavigating = false;
    
    this.uploadedFileNames = [];
    this.uploadingFileNames = [];
    this.errorFileNames = [];
    this.fileSuccessMessages = [];
    
    this.selectedProject = null;
    this.selectedCategory = null;
    
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.filePreviewUrls = {};
    
    this.removeSuccessState();
    
    console.log('Form reset completed');
  }

  private removeSuccessState(): void {
    const form = document.querySelector('.ticket-form');
    const richEditor = document.querySelector('.rich-text-editor-container');
    const fileUploadArea = document.querySelector('.file-upload-area');
    
    if (form) form.classList.remove('success');
    if (richEditor) richEditor.classList.remove('success');
    if (fileUploadArea) fileUploadArea.classList.remove('has-files');
  }

  get isFormCompleted(): boolean {
    const validation = this.validateFormForAutoSave();
    return validation.isValid;
  }

  get hasUnsavedChanges(): boolean {
    return this.isFormCompleted && !this.isTicketCreated;
  }

  isFileUploaded(fileName: string): boolean {
    return this.uploadedFileNames.includes(fileName);
  }

  isFileUploading(fileName: string): boolean {
    return this.uploadingFileNames.includes(fileName);
  }

  isFileError(fileName: string): boolean {
    return this.errorFileNames.includes(fileName);
  }

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
    
    if (content && content.trim().length >= 10 && this.validationErrors['issueDescription']) {
      this.validationErrors['issueDescription'] = false;
    }
    
    if (this.isTicketCreated) {
      this.saveIncompleteTicket();
    }
  }

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
  
  onAlertClosed(): void {
    // ✅ แก้ไข: ใช้ ticketNo แทน ticketId
    if (this.alertType === 'success' && this.ticket_no && !this.isNavigating) {
      this.navigateToTicketDetail();
    } else {
      this.showCustomAlert = false;
    }
  }

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

  @HostListener('window:beforeunload', ['$event'])
  canDeactivate(event: BeforeUnloadEvent): boolean {
    if (this.autoNavigationTimer) {
      clearTimeout(this.autoNavigationTimer);
      this.autoNavigationTimer = null;
    }
    
    // ✅ แก้ไข: ใช้ ticketNo แทน ticketId
    if (this.isTicketCreated && this.ticket_no) {
      this.saveIncompleteTicket();
    }
    
    if (this.hasUnsavedChanges) {
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return false;
    }
    return true;
  }
}