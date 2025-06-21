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
  }>;
  fix_attachment: Array<{
    attachment_id: number;
    path: string;
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
  ticketId: number = 0;
  
  // Rating properties
  currentRating = 0;
  hoverRating = 0;

  // ✅ เพิ่ม property สำหรับเก็บข้อมูลว่า attachment ไหนเป็นรูปภาพ
  attachmentTypes: { [key: number]: 'image' | 'file' } = {};

  ngOnInit(): void {
    this.ticketId = Number(this.route.snapshot.params['id']);
    if (this.ticketId) {
      this.loadTicketDetail();
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  loadTicketDetail(): void {
    this.isLoading = true;
    this.error = '';

    // ✅ เรียก API getTicketData จริง
    this.apiService.getTicketData({ ticket_id: this.ticketId }).subscribe({
      next: (response) => {
        console.log('getTicketData response:', response);
        
        if (response.code === 1) {
          this.ticketData = response.data;
          // ✅ เช็คประเภทของ attachment หลังจากได้ข้อมูล
          this.checkAttachmentTypes();
          console.log('Ticket data loaded:', this.ticketData);
        } else {
          this.error = 'ไม่พบข้อมูล ticket ที่ต้องการ';
          console.error('Ticket not found:', response.message);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading ticket detail:', error);
        this.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        
        // ✅ ถ้า API ยังไม่พร้อม ใช้ mock data แทน
        console.warn('API not available, using mock data');
        this.loadMockDataFromCreatedTicket();
        // ✅ เช็คประเภทของ attachment สำหรับ mock data ด้วย
        this.checkAttachmentTypes();
        this.isLoading = false;
      }
    });
  }

  // ✅ Method ใหม่สำหรับเช็คประเภทของ attachment
  private checkAttachmentTypes(): void {
    if (!this.ticketData?.issue_attachment) return;

    this.ticketData.issue_attachment.forEach(attachment => {
      this.checkIfImage(attachment.path, attachment.attachment_id);
    });

    // เช็ค fix_attachment ด้วยถ้ามี
    if (this.ticketData?.fix_attachment) {
      this.ticketData.fix_attachment.forEach(attachment => {
        this.checkIfImage(attachment.path, attachment.attachment_id);
      });
    }
  }

  // ✅ Method สำหรับเช็คว่า URL เป็นรูปภาพหรือไม่
  private checkIfImage(url: string, attachmentId: number): void {
    // ถ้าเป็น base64 data URL
    if (url.startsWith('data:image/')) {
      this.attachmentTypes[attachmentId] = 'image';
      return;
    }

    // ถ้าเป็น URL ที่มี file extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
    
    if (hasImageExtension) {
      this.attachmentTypes[attachmentId] = 'image';
      return;
    }

    // ✅ สำหรับ URL ที่ไม่มี extension (เช่น /images/issue_attachment/69)
    // ให้ลองโหลดเป็นรูปภาพ
    const img = new Image();
    img.onload = () => {
      // ถ้าโหลดได้แสดงว่าเป็นรูปภาพ
      this.attachmentTypes[attachmentId] = 'image';
      // Angular จะ detect changes อัตโนมัติ
    };
    img.onerror = () => {
      // ถ้าโหลดไม่ได้แสดงว่าไม่ใช่รูปภาพ
      this.attachmentTypes[attachmentId] = 'file';
    };
    
    // เพิ่ม CORS headers ถ้าจำเป็น
    img.crossOrigin = 'anonymous';
    img.src = url;
  }

  // ✅ แก้ไข method สำหรับใช้ข้อมูลจาก ticket ที่สร้างจริง
  private loadMockDataFromCreatedTicket(): void {
    // ดึงข้อมูลจาก localStorage ถ้ามี (จากหน้า create)
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = currentUser?.id || currentUser?.user_id;
    
    if (currentUserId) {
      const savedTicketData = localStorage.getItem(`incompleteTicket_${currentUserId}`);
      if (savedTicketData) {
        try {
          const ticketData = JSON.parse(savedTicketData);
          
          // ใช้ข้อมูลจาก ticket ที่สร้างจริง
          this.ticketData = {
            ticket: {
              id: ticketData.ticketId || this.ticketId,
              ticket_no: ticketData.ticketNo || `#68050001`,
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
                path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
              },
              {
                attachment_id: 2,
                path: 'sample-document.pdf'
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
    
    // ถ้าไม่มีข้อมูลใน localStorage ใช้ mock data แบบเดิม
    this.loadMockData();
  }

  private loadMockData(): void {
    // Mock data เก่าสำหรับ fallback
    this.ticketData = {
      ticket: {
        id: this.ticketId,
        ticket_no: '#68050001',
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
          path: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        },
        {
          attachment_id: 2,
          path: 'sample-document.pdf'
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

  // Status badge methods
  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'badge-pending';     // Pending
      case 2: return 'badge-in-progress'; // In Progress  
      case 3: return 'badge-hold';        // Hold
      case 4: return 'badge-resolved';    // Resolved
      case 5: return 'badge-complete';    // Complete
      case 6: return 'badge-cancel';      // Cancel
      default: return 'badge-pending';
    }
  }

  getStatusIcon(statusId: number): string {
    switch (statusId) {
      case 1: return 'bi-clock';                    // Pending
      case 2: return 'bi-chat';                     // In Progress
      case 3: return 'bi-pause-circle';             // Hold
      case 4: return 'bi-check-circle';             // Resolved
      case 5: return 'bi-check-circle-fill';        // Complete
      case 6: return 'bi-x-circle';                 // Cancel
      default: return 'bi-clock';
    }
  }

  // History badge methods
  getHistoryBadgeClass(statusId: number, index: number): string {
    if (index === 0) return 'badge-current'; // Current status
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

  // Utility methods
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

  // ✅ แก้ไข method isImageFile ให้ใช้ข้อมูลที่เช็คไว้แล้ว
  isImageFile(path: string, attachmentId?: number): boolean {
    // ใช้ข้อมูลที่เช็คไว้แล้วก่อน
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId] === 'image';
    }

    // Fallback: เช็คแบบเดิม
    if (path.startsWith('data:image/')) return true;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  getFileIcon(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'bi-file-earmark-pdf-fill';
      case 'doc':
      case 'docx': return 'bi-file-earmark-word-fill';
      case 'xls':
      case 'xlsx': return 'bi-file-earmark-excel-fill';
      default: return 'bi-file-earmark-fill';
    }
  }

  // ✅ Method สำหรับดึงชื่อไฟล์จาก path
  getFileName(path: string): string {
    if (path.includes('/')) {
      const parts = path.split('/');
      return parts[parts.length - 1] || 'Unknown file';
    }
    return path || 'Unknown file';
  }

  // ✅ Method สำหรับจัดการ error ของรูปภาพ
  onImageError(attachmentId: number): void {
    console.log(`Image failed to load for attachment ${attachmentId}`);
    this.attachmentTypes[attachmentId] = 'file';
  }

  // ✅ Method สำหรับจัดการเมื่อรูปภาพโหลดสำเร็จ
  onImageLoad(attachmentId: number): void {
    console.log(`Image loaded successfully for attachment ${attachmentId}`);
    this.attachmentTypes[attachmentId] = 'image';
  }

  // Action methods
  onEditTicket(): void {
    if (confirm('คุณต้องการแก้ไข status เป็น Resolved หรือไม่?')) {
      console.log('Edit ticket status to Resolved:', this.ticketId);
      // TODO: เรียก API เพื่อเปลี่ยน status
    }
  }

  onDeleteTicket(): void {
    if (confirm('คุณแน่ใจหรือไม่ที่ต้องการลบ ticket นี้?')) {
      console.log('Delete ticket:', this.ticketId);
      // TODO: เรียก API เพื่อลบ ticket
    }
  }

  onDownloadAttachment(attachmentId: number, path: string): void {
    if (path.startsWith('data:')) {
      // Handle base64 data
      const link = document.createElement('a');
      link.href = path;
      link.download = `attachment_${attachmentId}`;
      link.click();
    } else {
      // Handle file path
      window.open(path, '_blank');
    }
  }

  backToList(): void {
    this.router.navigate(['/tickets']);
  }

  // Rating methods
  setRating(rating: number): void {
    this.currentRating = rating;
    console.log('Rating set to:', rating);
    // TODO: Save rating to API
  }
}