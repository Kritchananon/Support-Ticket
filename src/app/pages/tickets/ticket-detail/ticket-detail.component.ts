import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';

interface TicketData {
  ticket: {
    id: number;
    ticket_no: string;
    categories_id: number;
    categories_name: string;
    project_id: number;
    project_name: string;
    issue_description: string;
    fix_issue_description: string;
    status_id: number;
    status_name: string;
    close_estimate: string;
    estimate_time: string;
    due_date: string;
    lead_time: string;
    related_ticket_id: number | null;
    change_request: string;
    create_date: string;
    create_by: string;
    update_date: string;
    update_by: string;
    isenabled: boolean;
    priority?: string;
  };
  issue_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  fix_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  status_history: Array<{
    status_id: number;
    status_name: string;
    create_date: string;
  }>;
}

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  ticketData: TicketData | null = null;
  isLoading = false;
  error = '';
  // ✅ แก้ไข: เปลี่ยนจาก ticketId เป็น ticketNo
  ticket_no: string = '';
  
  // Rating properties
  currentRating = 0;
  hoverRating = 0;

  attachmentTypes: { [key: number]: {
    type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
    extension: string;
    filename: string;
    isLoading?: boolean;
  } } = {};

  ngOnInit(): void {
    // ✅ แก้ไข: ดึง ticketNo จาก route parameter แทน id
    this.ticket_no = this.route.snapshot.params['ticket_no'];
    if (this.ticket_no) {
      this.loadTicketDetail();
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  // ✅ แก้ไข: ใช้ getTicketData method ที่มีอยู่แล้ว
  private callGetTicketDataAPI(ticket_no: string): void {
    console.log('=== callGetTicketDataAPI ===');
    console.log('ticket_no:', ticket_no);
    
    // ✅ ส่ง ticket_no ไปยัง method เดิม
    const requestData = { ticket_no: ticket_no };
    
    // ✅ ใช้ method getTicketData ที่มีอยู่แล้ว
    // แต่ส่ง ticket_no แทน ticket_id
    this.apiService.getTicketData(requestData).subscribe({
      next: (response: any) => {
        console.log('=== API Response ===');
        console.log('Response:', response);
        
        if (response && response.code === 1) {
          if (response.data && this.isValidTicketData(response.data)) {
            this.ticketData = response.data as TicketData;
            this.analyzeAllAttachments();
            console.log('✅ Ticket data loaded successfully');
          } else {
            console.error('❌ Invalid ticket data structure');
            this.error = 'ข้อมูล ticket ไม่ถูกต้อง';
            this.loadMockDataFromCreatedTicket();
            this.analyzeAllAttachments();
          }
        } else {
          console.error('❌ API returned error:', response?.message);
          this.error = response?.message || 'ไม่พบข้อมูล ticket ที่ต้องการ';
          this.loadMockDataFromCreatedTicket();
          this.analyzeAllAttachments();
        }
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('=== API Error ===');
        console.error('Error:', error);
        this.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        
        console.warn('🔄 Using mock data');
        this.loadMockDataFromCreatedTicket();
        this.analyzeAllAttachments();
        this.isLoading = false;
      }
    });
  }

  // ✅ แก้ไข getTicketByTicketNo method
  private getTicketByTicketNo(ticket_no: string): void {
    console.log('=== getTicketByTicketNo ===');
    console.log('Input ticket_no:', ticket_no);
    
    if (!ticket_no || ticket_no.trim() === '') {
      console.error('❌ Empty ticket_no');
      this.error = 'หมายเลขตั๋วไม่ถูกต้อง';
      this.isLoading = false;
      return;
    }

    // ✅ เรียก method ที่แก้ไขแล้ว
    this.callGetTicketDataAPI(ticket_no);
  }

  // ✅ ลบ method extractTicketIdFromTicketNo เพราะไม่ต้องใช้แล้ว
  // Backend ต้องการ ticket_no โดยตรง

  // ✅ แก้ไข loadTicketDetail method
  loadTicketDetail(): void {
    console.log('=== loadTicketDetail ===');
    console.log('ticket_no:', this.ticket_no);
    
    this.isLoading = true;
    this.error = '';

    // ✅ เรียกใช้ method ที่แก้ไขแล้ว
    this.getTicketByTicketNo(this.ticket_no);
  }

  // ✅ เก็บ method validation และ helper methods
  private isValidTicketData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const hasTicket = data.ticket && typeof data.ticket === 'object';
    const hasIssueAttachment = Array.isArray(data.issue_attachment);
    const hasFixAttachment = Array.isArray(data.fix_attachment);
    const hasStatusHistory = Array.isArray(data.status_history);

    console.log('Data validation:', {
      hasTicket,
      hasIssueAttachment,
      hasFixAttachment,
      hasStatusHistory
    });

    return hasTicket && hasIssueAttachment && hasFixAttachment && hasStatusHistory;
  }

  private analyzeAllAttachments(): void {
    if (!this.ticketData) return;

    if (this.ticketData.issue_attachment?.length > 0) {
      this.ticketData.issue_attachment.forEach(attachment => {
        this.analyzeAttachment(attachment);
      });
    }

    if (this.ticketData.fix_attachment?.length > 0) {
      this.ticketData.fix_attachment.forEach(attachment => {
        this.analyzeAttachment(attachment);
      });
    }
  }

  private analyzeAttachment(attachment: any): void {
    const attachmentId = attachment.attachment_id;
    
    this.attachmentTypes[attachmentId] = {
      type: 'file',
      extension: '',
      filename: 'Loading...',
      isLoading: true
    };

    if (attachment.filename || attachment.file_type) {
      const filename = attachment.filename || this.extractFilenameFromPath(attachment.path);
      const fileType = attachment.file_type || this.getFileTypeFromFilename(filename);
      
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategory(fileType, filename),
        extension: this.getFileExtension(filename),
        filename: filename,
        isLoading: false
      };
      
      console.log(`File analyzed from API data:`, {
        id: attachmentId,
        filename,
        fileType,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

    const filename = this.extractFilenameFromPath(attachment.path);
    const extension = this.getFileExtension(filename);
    
    if (extension) {
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByExtension(extension),
        extension: extension,
        filename: filename,
        isLoading: false
      };
      
      console.log(`File analyzed from path:`, {
        id: attachmentId,
        filename,
        extension,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

    if (attachment.path.startsWith('data:')) {
      const mimeType = this.extractMimeTypeFromDataUrl(attachment.path);
      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByMimeType(mimeType),
        extension: this.getExtensionFromMimeType(mimeType),
        filename: `attachment_${attachmentId}.${this.getExtensionFromMimeType(mimeType)}`,
        isLoading: false
      };
      
      console.log(`File analyzed from data URL:`, {
        id: attachmentId,
        mimeType,
        category: this.attachmentTypes[attachmentId].type
      });
      return;
    }

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
        
        console.log(`File analyzed from HTTP headers:`, {
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
      console.log(`File detected as image through loading test:`, attachmentId);
    };
    
    img.onerror = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: this.extractFilenameFromPath(url) || `file_${attachmentId}`,
        isLoading: false
      };
      console.log(`File defaulted to generic file type:`, attachmentId);
    };
    
    img.crossOrigin = 'anonymous';
    img.src = url;
  }

  private loadMockDataFromCreatedTicket(): void {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?.user_id;
    
    if (currentUserId) {
      const savedTicketData = localStorage.getItem(`incompleteTicket_${currentUserId}`);
      if (savedTicketData) {
        try {
          const ticketData = JSON.parse(savedTicketData);
          
          this.ticketData = {
            ticket: {
              id: ticketData.ticketId || 1,
              ticket_no: ticketData.ticket_no || this.ticket_no,
              categories_id: ticketData.formData?.categoryId || 1,
              categories_name: ticketData.selectedCategory?.categoryName || 'ระบบล่ม/ใช้งานไม่ได้',
              project_id: ticketData.formData?.projectId || 1,
              project_name: ticketData.selectedProject?.projectName || 'Human Resource Management System ( HRMS )',
              issue_description: ticketData.formData?.issueDescription || 'บันทึกข้อมูลใบลาไม่ได้',
              fix_issue_description: '',
              status_id: 1,
              status_name: 'Pending',
              close_estimate: '',
              estimate_time: '0 H',
              due_date: '',
              lead_time: '0 H',
              related_ticket_id: null,
              change_request: '0 Mandays',
              create_date: new Date().toISOString(),
              create_by: 'Wasan Rungsavang',
              update_date: new Date().toISOString(),
              update_by: 'Wasan Rungsavang',
              isenabled: true,
              priority: 'High'
            },
            issue_attachment: [
              {
                attachment_id: 1,
                path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                filename: 'screenshot.png',
                file_type: 'image/png'
              },
              {
                attachment_id: 2,
                path: '/api/attachments/download/72',
                filename: 'error_report.pdf',
                file_type: 'application/pdf'
              }
            ],
            fix_attachment: [],
            status_history: [
              {
                status_id: 1,
                status_name: 'Created',
                create_date: new Date().toISOString()
              },
              {
                status_id: 2,
                status_name: 'Open Ticket',
                create_date: ''
              },
              {
                status_id: 3,
                status_name: 'In Progress',
                create_date: ''
              },
              {
                status_id: 4,
                status_name: 'Resolved',
                create_date: ''
              },
              {
                status_id: 5,
                status_name: 'Completed',
                create_date: ''
              },
              {
                status_id: 6,
                status_name: 'Cancel',
                create_date: ''
              }
            ]
          };
          
          console.log('Loaded ticket data from localStorage:', this.ticketData);
          return;
        } catch (error) {
          console.error('Error parsing saved ticket data:', error);
        }
      }
    }
    
    this.loadMockData();
  }

  private loadMockData(): void {
    this.ticketData = {
      ticket: {
        id: 1,
        ticket_no: this.ticket_no,
        categories_id: 1,
        categories_name: 'ระบบล่ม/ใช้งานไม่ได้',
        project_id: 1,
        project_name: 'Human Resource Management System ( HRMS )',
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        fix_issue_description: '',
        status_id: 1,
        status_name: 'Pending',
        close_estimate: '',
        estimate_time: '0 H',
        due_date: '',
        lead_time: '0 H',
        related_ticket_id: null,
        change_request: '0 Mandays',
        create_date: '2025-05-08T09:00:00.000Z',
        create_by: 'Wasan Rungsavang',
        update_date: '2025-05-08T09:00:00.000Z',
        update_by: 'Wasan Rungsavang',
        isenabled: true,
        priority: 'High'
      },
      issue_attachment: [
        {
          attachment_id: 1,
          path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          filename: 'screenshot.png',
          file_type: 'image/png'
        },
        {
          attachment_id: 2,
          path: '/api/attachments/download/72',
          filename: 'document.pdf',
          file_type: 'application/pdf'
        }
      ],
      fix_attachment: [],
      status_history: [
        {
          status_id: 1,
          status_name: 'Created',
          create_date: '2025-05-08T09:00:00.000Z'
        },
        {
          status_id: 2,
          status_name: 'Open Ticket',
          create_date: '2025-05-08T09:15:00.000Z'
        },
        {
          status_id: 3,
          status_name: 'In Progress',
          create_date: '2025-05-08T09:20:00.000Z'
        },
        {
          status_id: 4,
          status_name: 'Resolved',
          create_date: '2025-05-08T09:25:00.000Z'
        },
        {
          status_id: 5,
          status_name: 'Completed',
          create_date: '2025-05-08T10:20:00.000Z'
        },
        {
          status_id: 6,
          status_name: 'Cancel',
          create_date: ''
        }
      ]
    };
    this.isLoading = false;
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'badge-pending';
      case 2: return 'badge-in-progress';
      case 3: return 'badge-hold';
      case 4: return 'badge-resolved';
      case 5: return 'badge-complete';
      case 6: return 'badge-cancel';
      default: return 'badge-pending';
    }
  }

  getStatusIcon(statusId: number): string {
    switch (statusId) {
      case 1: return 'bi-clock';
      case 2: return 'bi-chat';
      case 3: return 'bi-pause-circle';
      case 4: return 'bi-check-circle';
      case 5: return 'bi-check-circle-fill';
      case 6: return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  getHistoryBadgeClass(statusId: number, index: number): string {
    if (index === 0) return 'badge-current';
    return 'badge-history';
  }

  getHistoryIcon(statusName: string): string {
    switch (statusName.toLowerCase()) {
      case 'created': return 'bi-clock';
      case 'open ticket': return 'bi-clock';
      case 'in progress': return 'bi-chat';
      case 'resolved': return 'bi-check-circle';
      case 'completed': return 'bi-check-circle-fill';
      case 'cancel': return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  formatHistoryDate(dateString: string): string {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return '-';
    }
  }

  isImageFile(path: string, attachmentId?: number): boolean {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }
    
    if (path.startsWith('data:image/')) return true;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  getFileIcon(path: string, attachmentId?: number): string {
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
    
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'bi-file-earmark-pdf-fill';
      case 'doc':
      case 'docx': return 'bi-file-earmark-word-fill';
      case 'xls':
      case 'xlsx': 
      case 'csv': return 'bi-file-earmark-excel-fill';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg': return 'bi-image-fill';
      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml': return 'bi-file-earmark-text-fill';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz': return 'bi-file-earmark-zip-fill';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
      case 'wmv': return 'bi-file-earmark-play-fill';
      case 'mp3':
      case 'wav':
      case 'aac':
      case 'flac': return 'bi-file-earmark-music-fill';
      default: return 'bi-file-earmark-fill';
    }
  }

  getDisplayFileName(path: string, attachmentId?: number): string {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }
    
    return this.extractFilenameFromPath(path);
  }

  getFileInfo(attachmentId: number): {
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
        icon: this.getFileIcon('', attachmentId)
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

  onImageError(attachmentId: number): void {
    console.log(`Image failed to load for attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
    }
  }

  onImageLoad(attachmentId: number): void {
    console.log(`Image loaded successfully for attachment ${attachmentId}`);
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
    }
  }

  getFileSize(attachment: any): string {
    if (attachment.file_size) {
      const size = attachment.file_size;
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return '';
  }

  onEditTicket(): void {
    if (confirm('คุณต้องการแก้ไข status เป็น Resolved หรือไม่?')) {
      console.log('Edit ticket status to Resolved:', this.ticket_no);
    }
  }

  onDeleteTicket(): void {
    if (confirm('คุณแน่ใจหรือไม่ที่ต้องการลบ ticket นี้?')) {
      console.log('Delete ticket:', this.ticket_no);
    }
  }

  onDownloadAttachment(attachmentId: number, path: string): void {
    const fileInfo = this.getFileInfo(attachmentId);
    
    if (path.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = path;
      link.download = fileInfo.filename || `attachment_${attachmentId}`;
      link.click();
    } else {
      window.open(path, '_blank');
    }
    
    console.log(`Downloading attachment:`, {
      id: attachmentId,
      filename: fileInfo.filename,
      type: fileInfo.type,
      path: path
    });
  }

  backToList(): void {
    this.router.navigate(['/tickets']);
  }

  setRating(rating: number): void {
    this.currentRating = rating;
    console.log('Rating set to:', rating);
  }
}