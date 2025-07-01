import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
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
  private route = inject(ActivatedRoute);
  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);

  // เพิ่ม environment สำหรับ debug (ใช้แทน import)
  get environment() {
    return { production: false }; // เปลี่ยนเป็น true ใน production
  }

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

  // Edit Mode Properties
  isEditMode = false;
  editTicketNo: string = '';
  originalTicketData: any = null;
  existingAttachments: any[] = [];

  ticketId: number | null = null;
  ticket_no: string = '';
  isTicketCreated = false;

  uploadedFileNames: string[] = [];
  uploadingFileNames: string[] = [];
  errorFileNames: string[] = [];
  fileSuccessMessages: string[] = [];
  
  isNavigating = false;

  // Delete attachment tracking
  private deletingAttachmentIds: Set<number> = new Set();

  // ✅ NEW: File Analysis Properties
  attachmentTypes: { [key: number]: {
    type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
    extension: string;
    filename: string;
    isLoading?: boolean;
  } } = {};

  // ✅ NEW: Bulk Selection Properties
  selectedAttachmentIds: Set<number> = new Set();

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
    
    // ตรวจสอบว่าเป็นโหมดแก้ไขหรือไม่
    this.checkEditMode();
    
    this.ticketForm.get('issueDescription')?.valueChanges
      .pipe(debounceTime(1000))
      .subscribe(value => {
        console.log('Issue Description changed:', value);
        if (!this.isEditMode) {
          this.onFormCompleted();
        }
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

    // ลบข้อมูล edit ออกจาก localStorage เมื่อออกจากหน้า
    this.clearEditData();
  }

  // ===== Edit Mode Methods ===== ✅

  /**
   * ตรวจสอบว่าเป็นโหมดแก้ไขหรือไม่
   */
  private checkEditMode(): void {
    // ตรวจสอบจาก URL parameter
    this.editTicketNo = this.route.snapshot.params['ticket_no'];
    
    if (this.editTicketNo) {
      console.log('Edit mode detected for ticket:', this.editTicketNo);
      this.isEditMode = true;
      this.restoreEditTicketData();
    } else {
      console.log('Create mode detected');
      this.isEditMode = false;
      this.restoreIncompleteTicket();
    }
  }

  /**
   * ✅ UPDATED: กู้คืนข้อมูล ticket สำหรับการแก้ไข (พร้อมการวิเคราะห์ไฟล์)
   */
  private restoreEditTicketData(): void {
    try {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (!currentUserId) {
        console.log('No current user ID found');
        this.backToTicketDetail();
        return;
      }

      const editStorageKey = `editTicket_${currentUserId}_${this.editTicketNo}`;
      const editTicketData = localStorage.getItem(editStorageKey);
      
      if (editTicketData) {
        const ticketData = JSON.parse(editTicketData);
        console.log('Found edit ticket data:', ticketData);
        
        // ตรวจสอบความถูกต้องของข้อมูล
        if (ticketData.userId !== currentUserId || !ticketData.isEditMode) {
          console.log('Invalid edit data, clearing');
          localStorage.removeItem(editStorageKey);
          this.backToTicketDetail();
          return;
        }

        // เซ็ต properties สำหรับ edit mode
        this.isEditMode = true;
        this.ticketId = ticketData.ticketId;
        this.ticket_no = ticketData.ticket_no;
        this.isTicketCreated = true;
        this.originalTicketData = ticketData;
        this.existingAttachments = ticketData.existingAttachments || [];
        
        // กรอกข้อมูลในฟอร์ม
        this.ticketForm.patchValue({
          projectId: ticketData.formData.projectId,
          categoryId: ticketData.formData.categoryId,
          issueDescription: ticketData.formData.issueDescription
        });
        
        this.selectedProject = ticketData.selectedProject;
        this.selectedCategory = ticketData.selectedCategory;
        
        // อัปเดต UI และวิเคราะห์ไฟล์
        setTimeout(() => {
          this.updateUIFromRestoredData(ticketData);
          this.addSuccessState();
          
          // ✅ NEW: วิเคราะห์ไฟล์ existing attachments
          this.analyzeAllExistingAttachments();
        }, 500);
        
        console.log('Edit mode initialized for ticket:', this.ticket_no);
      } else {
        console.log('No edit data found, redirecting back');
        this.backToTicketDetail();
      }
    } catch (error) {
      console.error('Error restoring edit ticket data:', error);
      this.backToTicketDetail();
    }
  }

  /**
   * กลับไปหน้า ticket detail
   */
  private backToTicketDetail(): void {
    if (this.editTicketNo) {
      this.router.navigate(['/tickets', this.editTicketNo]);
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  /**
   * ลบข้อมูล edit ออกจาก localStorage
   */
  private clearEditData(): void {
    if (this.isEditMode && this.editTicketNo) {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (currentUserId) {
        const editStorageKey = `editTicket_${currentUserId}_${this.editTicketNo}`;
        localStorage.removeItem(editStorageKey);
        console.log('Cleared edit data from localStorage');
      }
    }
  }

  /**
   * อัปเดต ticket ที่มีอยู่แล้ว
   */
  private updateExistingTicket(): void {
    if (!this.ticketId) {
      console.error('No ticket ID for update');
      return;
    }

    this.isSubmitting = true;
    
    const formData = this.ticketForm.value;
    
    const updateData = {
      project_id: parseInt(formData.projectId),
      categories_id: parseInt(formData.categoryId),
      issue_description: formData.issueDescription
    };

    console.log('Updating existing ticket with data:', updateData);

    // ใช้ saveTicket API แต่ส่ง ticket_id ด้วย
    this.apiService.updateTicketData(this.ticketId, updateData).subscribe({
      next: (response) => {
        console.log('updateTicketData response:', response);
        
        if (response.code === 1) {
          console.log('Ticket updated successfully');
          
          // อัปโหลดไฟล์ใหม่ (ถ้ามี)
          if (this.selectedFiles.length > 0) {
            this.uploadFilesToExistingTicket(this.selectedFiles);
          } else {
            this.completeTicketUpdate();
          }
        } else {
          this.onUpdateError('Failed to update ticket: ' + response.message);
        }
      },
      error: (error) => {
        console.error('Error updating ticket:', error);
        this.onUpdateError('เกิดข้อผิดพลาดในการอัปเดตตั๋ว');
      }
    });
  }

  /**
   * จัดการข้อผิดพลาดในการอัปเดต
   */
  private onUpdateError(error: any): void {
    let message = 'เกิดข้อผิดพลาดในการอัปเดตตั๋ว';
    
    if (typeof error === 'string') {
      message = error;
    } else if (error && error.message) {
      message = error.message;
    }
    
    console.error('Update error:', error);
    
    this.alertMessage = message;
    this.alertType = 'error';
    this.showCustomAlert = true;
    this.isSubmitting = false;
  }

  /**
   * เสร็จสิ้นการอัปเดต ticket
   */
  private completeTicketUpdate(): void {
    console.log('Ticket update completed');
    
    this.clearEditData();
    
    this.alertMessage = `Ticket updated successfully\nTicket ID: ${this.ticket_no}`;
    this.alertType = 'success';
    this.showCustomAlert = true;
    this.isSubmitting = false;

    // นำทางกลับไปหน้า ticket detail
    this.autoNavigationTimer = setTimeout(() => {
      if (this.ticket_no && !this.isNavigating) {
        this.navigateToTicketDetail();
      }
    }, 2000);
  }

  /**
   * ได้รับชื่อหน้าที่ถูกต้อง
   */
  getPageTitle(): string {
    return this.isEditMode ? 'Edit Ticket' : 'New Ticket';
  }

  /**
   * ได้รับข้อความปุ่มที่ถูกต้อง
   */
  getSubmitButtonText(): string {
    if (this.isSubmitting) {
      return this.isEditMode ? 'Updating Ticket...' : 'Creating Ticket...';
    }
    return this.isEditMode ? 'Update Ticket' : 'New Ticket';
  }

  // ===== File Analysis Methods ===== ✅

  /**
   * ✅ NEW: วิเคราะห์ไฟล์ทั้งหมดใน existing attachments
   */
  private analyzeAllExistingAttachments(): void {
    if (!this.existingAttachments || this.existingAttachments.length === 0) {
      return;
    }

    console.log('Analyzing existing attachments:', this.existingAttachments.length);
    this.existingAttachments.forEach(attachment => {
      this.analyzeExistingAttachment(attachment);
    });
  }

  /**
   * ✅ NEW: วิเคราะห์ไฟล์ existing attachment แต่ละไฟล์
   */
  private analyzeExistingAttachment(attachment: any): void {
    const attachmentId = attachment.attachment_id;
    
    // เริ่มต้นด้วย loading state
    this.attachmentTypes[attachmentId] = {
      type: 'file',
      extension: '',
      filename: 'Loading...',
      isLoading: true
    };

    // ถ้ามีข้อมูล filename และ file_type จาก API
    if (attachment.filename || attachment.file_type) {
      const filename = attachment.filename || this.extractFilenameFromPath(attachment.path);
      const fileType = attachment.file_type || this.getFileTypeFromFilename(filename);
      
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategory(fileType, filename),
        extension: this.getFileExtension(filename),
        filename: filename,
        isLoading: false
      };
      
      console.log(`Existing file analyzed from API data:`, {
        id: attachmentId,
        filename,
        fileType,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

    // ถ้าไม่มีข้อมูลจาก API ให้วิเคราะห์จาก path
    const filename = this.extractFilenameFromPath(attachment.path);
    const extension = this.getFileExtension(filename);
    
    if (extension) {
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByExtension(extension),
        extension: extension,
        filename: filename,
        isLoading: false
      };
      
      console.log(`Existing file analyzed from path:`, {
        id: attachmentId,
        filename,
        extension,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

    // ถ้าเป็น data URL
    if (attachment.path.startsWith('data:')) {
      const mimeType = this.extractMimeTypeFromDataUrl(attachment.path);
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByMimeType(mimeType),
        extension: this.getExtensionFromMimeType(mimeType),
        filename: `attachment_${attachmentId}.${this.getExtensionFromMimeType(mimeType)}`,
        isLoading: false
      };
      
      console.log(`Existing file analyzed from data URL:`, {
        id: attachmentId,
        mimeType,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

    // ลองตรวจสอบจาก HTTP headers
    this.checkFileTypeFromHeaders(attachment.path, attachmentId);
  }

  private extractFilenameFromPath(path: string): string {
    if (!path) return 'unknown';
    
    if (path.startsWith('data:')) {
      return 'data_file';
    }
    
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    
    return lastPart.split('?')[0] || 'unknown';
  }

  private getFileExtension(filename: string): string {
    if (!filename || filename === 'unknown') return '';
    
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private getFileTypeFromFilename(filename: string): string {
    const extension = this.getFileExtension(filename);
    return extension || 'unknown';
  }

  private determineFileCategory(fileType: string, filename: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = fileType.toLowerCase();
    const ext = this.getFileExtension(filename).toLowerCase();
    
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }
    
    if (type.includes('pdf') || ext === 'pdf') {
      return 'pdf';
    }
    
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }
    
    if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }
    
    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }
    
    if (type.includes('archive') || type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    
    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }
    
    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }
    
    return 'file';
  }

  private determineFileCategoryByExtension(extension: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const ext = extension.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }
    
    if (ext === 'pdf') {
      return 'pdf';
    }
    
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }
    
    if (['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }
    
    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }
    
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }
    
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }
    
    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }
    
    return 'file';
  }

  private extractMimeTypeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+)/);
    return match ? match[1] : '';
  }

  private determineFileCategoryByMimeType(mimeType: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    
    return 'file';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/json': 'json',
      'text/html': 'html',
      'application/zip': 'zip',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3'
    };
    
    return mimeToExt[mimeType] || 'bin';
  }

  private checkFileTypeFromHeaders(url: string, attachmentId: number): void {
    fetch(url, { 
      method: 'HEAD',
      mode: 'cors'
    })
    .then(response => {
      const contentType = response.headers.get('content-type');
      const contentDisposition = response.headers.get('content-disposition');
      
      let filename = `attachment_${attachmentId}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      if (contentType) {
        this.attachmentTypes[attachmentId] = {
          type: this.determineFileCategoryByMimeType(contentType),
          extension: this.getExtensionFromMimeType(contentType),
          filename: filename,
          isLoading: false
        };
        
        console.log(`Existing file analyzed from HTTP headers:`, {
          id: attachmentId,
          contentType,
          filename,
          category: this.attachmentTypes[attachmentId].type
        });
      } else {
        this.attachmentTypes[attachmentId] = {
          type: 'file',
          extension: '',
          filename: filename,
          isLoading: false
        };
      }
    })
    .catch(error => {
      console.log(`Could not fetch headers for ${url}:`, error);
      this.tryImageLoad(url, attachmentId);
    });
  }

  private tryImageLoad(url: string, attachmentId: number): void {
    const img = new Image();
    
    img.onload = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'image',
        extension: 'jpg',
        filename: this.extractFilenameFromPath(url) || `image_${attachmentId}.jpg`,
        isLoading: false
      };
      console.log(`Existing file detected as image through loading test:`, attachmentId);
    };
    
    img.onerror = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: this.extractFilenameFromPath(url) || `file_${attachmentId}`,
        isLoading: false
      };
      console.log(`Existing file defaulted to generic file type:`, attachmentId);
    };
    
    img.crossOrigin = 'anonymous';
    img.src = url;
  }

  // ===== Existing Attachment Preview Methods ===== ✅

  /**
   * ✅ NEW: ตรวจสอบว่า existing attachment เป็นไฟล์รูปภาพหรือไม่
   */
  isExistingAttachmentImage(attachment: any): boolean {
    if (!attachment) return false;
    
    const attachmentId = attachment.attachment_id;
    
    // ใช้ข้อมูลที่วิเคราะห์แล้ว
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }
    
    // Fallback: ตรวจสอบจาก path
    if (attachment.path && attachment.path.startsWith('data:image/')) {
      return true;
    }
    
    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';
    
    return fileType.includes('image') || filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
  }

  /**
   * ✅ NEW: ได้รับ icon สำหรับ existing attachment
   */
  getExistingAttachmentIcon(attachment: any): string {
    if (!attachment) return 'bi-file-earmark-fill';
    
    const attachmentId = attachment.attachment_id;
    
    // ใช้ข้อมูลที่วิเคราะห์แล้ว
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      const fileInfo = this.attachmentTypes[attachmentId];
      
      switch (fileInfo.type) {
        case 'image': return 'bi-image-fill';
        case 'pdf': return 'bi-file-earmark-pdf-fill';
        case 'excel': return 'bi-file-earmark-excel-fill';
        case 'word': return 'bi-file-earmark-word-fill';
        case 'text': return 'bi-file-earmark-text-fill';
        case 'archive': return 'bi-file-earmark-zip-fill';
        case 'video': return 'bi-file-earmark-play-fill';
        case 'audio': return 'bi-file-earmark-music-fill';
        default: return 'bi-file-earmark-fill';
      }
    }
    
    // Fallback: ตรวจสอบจาก filename
    if (!attachment.filename && !attachment.file_type) {
      return 'bi-file-earmark-fill';
    }
    
    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';
    
    if (fileType.includes('image') || filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
      return 'bi-image-fill';
    }
    
    if (fileType.includes('pdf') || filename.match(/\.pdf$/i)) {
      return 'bi-file-earmark-pdf-fill';
    }
    
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || filename.match(/\.(xls|xlsx|csv)$/i)) {
      return 'bi-file-earmark-excel-fill';
    }
    
    if (fileType.includes('word') || fileType.includes('document') || filename.match(/\.(doc|docx|rtf)$/i)) {
      return 'bi-file-earmark-word-fill';
    }
    
    if (fileType.includes('text') || filename.match(/\.(txt|log|md|json|xml)$/i)) {
      return 'bi-file-earmark-text-fill';
    }
    
    return 'bi-file-earmark-fill';
  }

  /**
   * ✅ NEW: ได้รับชื่อไฟล์ที่แสดงสำหรับ existing attachment
   */
  getExistingAttachmentDisplayName(attachment: any): string {
    if (!attachment) return 'Unknown file';
    
    const attachmentId = attachment.attachment_id;
    
    // ใช้ข้อมูลที่วิเคราะห์แล้ว
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }
    
    // Fallback
    return attachment.filename || this.extractFilenameFromPath(attachment.path) || 'Unknown file';
  }

  /**
   * ✅ NEW: ได้รับข้อมูลไฟล์สำหรับ existing attachment
   */
  getExistingAttachmentFileInfo(attachmentId: number): {
    type: string;
    extension: string;
    filename: string;
    isLoading: boolean;
    icon: string;
  } {
    const fileInfo = this.attachmentTypes[attachmentId];
    
    if (fileInfo) {
      return {
        type: fileInfo.type,
        extension: fileInfo.extension,
        filename: fileInfo.filename,
        isLoading: fileInfo.isLoading || false,
        icon: this.getExistingAttachmentIcon({ attachment_id: attachmentId })
      };
    }
    
    return {
      type: 'unknown',
      extension: '',
      filename: 'Unknown file',
      isLoading: false,
      icon: 'bi-file-earmark-fill'
    };
  }

  /**
   * ✅ NEW: Format file size สำหรับ existing attachments
   */
  formatExistingAttachmentSize(attachment: any): string {
    if (attachment.file_size) {
      return this.formatFileSize(attachment.file_size);
    }
    return '';
  }

  /**
   * ✅ NEW: จัดการข้อผิดพลาดการโหลดรูปภาพ
   */
  onExistingAttachmentImageError(attachmentId: number): void {
    console.log(`Image failed to load for existing attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
    }
  }

  /**
   * ✅ NEW: จัดการการโหลดรูปภาพสำเร็จ
   */
  onExistingAttachmentImageLoad(attachmentId: number): void {
    console.log(`Image loaded successfully for existing attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
    }
  }

  /**
   * ✅ NEW: ตรวจสอบว่ามี existing attachments หรือไม่
   */
  hasExistingAttachments(): boolean {
    return this.isEditMode && this.existingAttachments.length > 0;
  }

  /**
   * ✅ NEW: ตรวจสอบว่า attachment กำลังถูกลบหรือไม่
   */
  isAttachmentDeleting(attachmentId: number): boolean {
    return this.deletingAttachmentIds.has(attachmentId);
  }

  // ===== Attachment Management Methods ===== ✅

  /**
   * ✅ UPDATED: ลบ existing attachment (ใช้ข้อมูลที่วิเคราะห์แล้ว)
   */
  removeExistingAttachment(index: number, attachment?: any): void {
    // ใช้ attachment จาก parameter หรือ ดึงจาก array
    const attachmentToDelete = attachment || this.existingAttachments[index];
    
    if (!attachmentToDelete || !attachmentToDelete.attachment_id) {
      console.error('Invalid attachment data:', attachmentToDelete);
      this.showFileUploadError('ไม่สามารถลบไฟล์ได้: ข้อมูลไฟล์ไม่ถูกต้อง');
      return;
    }

    // ใช้ชื่อไฟล์ที่วิเคราะห์แล้ว
    const filename = this.getExistingAttachmentDisplayName(attachmentToDelete);

    // แสดง confirmation dialog
    if (!confirm(`คุณต้องการลบไฟล์ "${filename}" หรือไม่?`)) {
      return;
    }

    const attachmentId = attachmentToDelete.attachment_id;
    
    // เพิ่ม loading state
    this.deletingAttachmentIds.add(attachmentId);
    
    console.log('Removing existing attachment:', attachmentToDelete);

    this.apiService.deleteAttachment(attachmentId).subscribe({
      next: (response) => {
        console.log('Delete attachment response:', response);
        
        // ลบ loading state
        this.deletingAttachmentIds.delete(attachmentId);
        
        if (response.code === 1 || response.code === 200) {
          // ลบออกจาก array
          this.existingAttachments.splice(index, 1);
          
          // ลบข้อมูลการวิเคราะห์ไฟล์
          delete this.attachmentTypes[attachmentId];
          
          this.showFileUploadSuccess(`ลบไฟล์ "${filename}" สำเร็จ`);
          
          // อัปเดต UI
          this.cdr.detectChanges();
          
          console.log('Attachment deleted successfully');
        } else {
          this.showFileUploadError(response.message || 'ไม่สามารถลบไฟล์ได้');
        }
      },
      error: (error) => {
        console.error('Error deleting attachment:', error);
        
        // ลบ loading state
        this.deletingAttachmentIds.delete(attachmentId);
        
        let errorMessage = 'เกิดข้อผิดพลาดในการลบไฟล์';
        if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        this.showFileUploadError(errorMessage);
      }
    });
  }

  /**
   * ✅ UPDATED: ดาวน์โหลด existing attachment (ใช้ข้อมูลที่วิเคราะห์แล้ว)
   */
  downloadExistingAttachment(attachment: any): void {
    if (!attachment || !attachment.path) {
      this.showFileUploadError('ไม่สามารถดาวน์โหลดไฟล์ได้: ไม่พบที่อยู่ไฟล์');
      return;
    }

    // ใช้ข้อมูลที่วิเคราะห์แล้วสำหรับชื่อไฟล์
    const filename = this.getExistingAttachmentDisplayName(attachment);

    console.log('Downloading existing attachment:', attachment);

    try {
      if (attachment.path.startsWith('data:')) {
        // ไฟล์เป็น base64 data URL
        const link = document.createElement('a');
        link.href = attachment.path;
        link.download = filename || `attachment_${attachment.attachment_id}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (attachment.path.startsWith('http')) {
        // ไฟล์เป็น URL
        window.open(attachment.path, '_blank');
      } else {
        // ไฟล์เป็น path ในเซิร์ฟเวอร์ - ใช้ apiUrl จาก ApiService
        const apiUrl = this.apiService['apiUrl'] || '/api'; // fallback
        const fullUrl = `${apiUrl}/${attachment.path}`;
        window.open(fullUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      this.showFileUploadError('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์');
    }
  }

  // ===== Bulk Selection Methods ===== ✅

  /**
   * ✅ NEW: เลือก/ยกเลิกการเลือก attachment
   */
  toggleAttachmentSelection(attachmentId: number): void {
    if (this.selectedAttachmentIds.has(attachmentId)) {
      this.selectedAttachmentIds.delete(attachmentId);
    } else {
      this.selectedAttachmentIds.add(attachmentId);
    }
  }

  /**
   * ✅ NEW: ตรวจสอบว่า attachment ถูกเลือกหรือไม่
   */
  isAttachmentSelected(attachmentId: number): boolean {
    return this.selectedAttachmentIds.has(attachmentId);
  }

  /**
   * ✅ NEW: ลบ attachments ที่เลือกไว้
   */
  removeSelectedAttachments(): void {
    const selectedIds = Array.from(this.selectedAttachmentIds);
    if (selectedIds.length > 0) {
      this.removeMultipleExistingAttachments(selectedIds);
      this.selectedAttachmentIds.clear();
    }
  }

  /**
   * ✅ NEW: เลือก attachments ทั้งหมด
   */
  selectAllAttachments(): void {
    this.existingAttachments.forEach(att => {
      if (att.attachment_id) {
        this.selectedAttachmentIds.add(att.attachment_id);
      }
    });
  }

  /**
   * ✅ NEW: ยกเลิกการเลือก attachments ทั้งหมด
   */
  clearAttachmentSelection(): void {
    this.selectedAttachmentIds.clear();
  }

  /**
   * ✅ NEW: ตรวจสอบว่ามี attachments ที่เลือกไว้หรือไม่
   */
  get hasSelectedAttachments(): boolean {
    return this.selectedAttachmentIds.size > 0;
  }

  /**
   * ✅ NEW: ได้รับจำนวน attachments ที่เลือกไว้
   */
  get selectedAttachmentCount(): number {
    return this.selectedAttachmentIds.size;
  }

  /**
   * ✅ NEW: ลบ existing attachments หลายไฟล์พร้อมกัน
   */
  removeMultipleExistingAttachments(attachmentIds: number[]): void {
    if (attachmentIds.length === 0) return;

    if (!confirm(`คุณต้องการลบไฟล์ ${attachmentIds.length} ไฟล์หรือไม่?`)) {
      return;
    }

    // เพิ่ม loading state สำหรับทุกไฟล์
    attachmentIds.forEach(id => this.deletingAttachmentIds.add(id));

    const deletePromises = attachmentIds.map(attachmentId => 
      this.apiService.deleteAttachment(attachmentId).toPromise()
    );

    Promise.allSettled(deletePromises).then(results => {
      let successCount = 0;
      let errorCount = 0;

      results.forEach((result, index) => {
        const attachmentId = attachmentIds[index];
        
        // ลบ loading state
        this.deletingAttachmentIds.delete(attachmentId);
        
        if (result.status === 'fulfilled' && result.value?.code === 1) {
          successCount++;
          // ลบออกจาก array
          const attachmentIndex = this.existingAttachments.findIndex(
            att => att.attachment_id === attachmentId
          );
          if (attachmentIndex > -1) {
            this.existingAttachments.splice(attachmentIndex, 1);
          }
          // ลบข้อมูลการวิเคราะห์ไฟล์
          delete this.attachmentTypes[attachmentId];
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        this.showFileUploadSuccess(`ลบไฟล์สำเร็จ ${successCount} ไฟล์`);
      }
      
      if (errorCount > 0) {
        this.showFileUploadError(`ไม่สามารถลบไฟล์ได้ ${errorCount} ไฟล์`);
      }

      this.cdr.detectChanges();
    });
  }

  // ===== EXISTING METHODS (เดิม) ===== ✅

  private restoreIncompleteTicket(): void {
    if (this.isEditMode) return; // ถ้าเป็น edit mode ไม่ต้อง restore incomplete ticket
    
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
    if (this.isEditMode) return; // ไม่ save incomplete ticket ในโหมดแก้ไข
    
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
    if (this.isEditMode) return; // ไม่ clear incomplete ticket ในโหมดแก้ไข
    
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
    if (!this.isEditMode) {
      this.onFormCompleted();
    }
  }

  onCategoryChange(event: { category: any, categoryId: string | number }): void {
    this.selectedCategory = event.category;
    this.ticketForm.patchValue({ categoryId: event.categoryId });
    
    if (event.categoryId && this.validationErrors['categoryId']) {
      this.validationErrors['categoryId'] = false;
    }
    
    console.log('Category selected:', event);
    if (!this.isEditMode) {
      this.onFormCompleted();
    }
  }

  onFormCompleted(): void {
    if (this.isEditMode) return; // ไม่ auto-create ในโหมดแก้ไข
    
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
    if (this.isEditMode) return; // ไม่ auto-create ในโหมดแก้ไข
    
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
    
    // ในโหมดแก้ไข ไม่ต้องตรวจสอบ form validation
    if (!this.isEditMode) {
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
    console.log('Submit button clicked, Edit mode:', this.isEditMode);
    
    const validation = this.validateFormForAutoSave();
    
    if (!validation.isValid) {
      this.alertMessage = 'กรุณากรอกข้อมูลให้ครบก่อน';
      this.alertType = 'error';
      this.showCustomAlert = true;
      
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
      
      return;
    }
    
    // แยกการทำงานระหว่าง edit และ create
    if (this.isEditMode) {
      this.updateExistingTicket();
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
      if (this.isEditMode) {
        this.completeTicketUpdate();
      } else {
        this.completedTicketCreation();
      }
    }, 2000);
  }

  private completedTicketCreation(): void {
    console.log('Ticket creation completed');
    
    this.clearIncompleteTicket();
    
    this.alertMessage = `Ticket created successfully\nTicket ID: ${this.ticket_no}`;
    this.alertType = 'success';
    this.showCustomAlert = true;

    this.autoNavigationTimer = setTimeout(() => {
      if (this.ticket_no && !this.isNavigating) {
        this.navigateToTicketDetail();
      }
    }, 3000);
  }

  private navigateToTicketDetail(): void {
    if (this.ticket_no) {
      console.log('Navigating to ticket detail with ticket_no:', this.ticket_no);
      this.isNavigating = true;
      this.showCustomAlert = false;
      
      if (this.autoNavigationTimer) {
        clearTimeout(this.autoNavigationTimer);
        this.autoNavigationTimer = null;
      }
      
      this.router.navigate(['/tickets', this.ticket_no]);
    }
  }

  resetForm(): void {
    if (this.autoNavigationTimer) {
      clearTimeout(this.autoNavigationTimer);
      this.autoNavigationTimer = null;
    }
    
    // แยกการ clear ระหว่าง edit และ create mode
    if (this.isEditMode) {
      this.clearEditData();
      this.backToTicketDetail();
      return;
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
    if (this.isEditMode) {
      // ในโหมดแก้ไข ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
      if (!this.originalTicketData) return false;
      
      const currentFormData = {
        projectId: this.ticketForm.get('projectId')?.value,
        categoryId: this.ticketForm.get('categoryId')?.value,
        issueDescription: this.ticketForm.get('issueDescription')?.value
      };
      
      const originalFormData = this.originalTicketData.formData;
      
      return (
        currentFormData.projectId !== originalFormData.projectId ||
        currentFormData.categoryId !== originalFormData.categoryId ||
        currentFormData.issueDescription !== originalFormData.issueDescription ||
        this.selectedFiles.length > 0
      );
    }
    
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
    
    // บันทึกข้อมูลต่างกันระหว่าง edit และ create mode
    if (this.isEditMode) {
      // ในโหมดแก้ไข ไม่ต้องบันทึก localStorage
      console.log('Edit mode: Description updated');
    } else if (this.isTicketCreated) {
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
    
    // จัดการ localStorage ต่างกันระหว่าง edit และ create mode
    if (this.isEditMode) {
      // ในโหมดแก้ไข ไม่ต้องบันทึก incomplete ticket
      if (this.hasUnsavedChanges) {
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return false;
      }
    } else {
      // ในโหมดสร้างใหม่ บันทึก incomplete ticket ตามเดิม
      if (this.isTicketCreated && this.ticket_no) {
        this.saveIncompleteTicket();
      }
      
      if (this.hasUnsavedChanges) {
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return false;
      }
    }
    
    return true;
  }
}