import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../../../../shared/services/ticket.service';

// Interfaces
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
  } | null;
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
  assign: Array<{
    ticket_no: string;
    assignTo: string;
    assignBy: string;
  }>;
}

@Component({
  selector: 'app-support-information-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './support-information-display.component.html',
  styleUrls: ['./support-information-display.component.css']
})
export class SupportInformationDisplayComponent implements OnChanges {
  estimateTime: number = 0;
  leadTime: number = 0;
  assignToName: string = '-'; // เพิ่มตัวแปรใหม่สำหรับเก็บชื่อผู้รับผิดชอบ

  constructor(private ticketService: TicketService) {}

  @Input() ticketData: TicketData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketData'] && this.ticketData) {
      this.updateDisplayData();
    }
  }

  updateDisplayData(): void {
    if (this.ticketData?.ticket) {
      const closeEstimateDate = this.ticketData.ticket.close_estimate ?
        new Date(this.ticketData.ticket.close_estimate) : new Date();
      const dueDateDate = this.ticketData.ticket.due_date ?
        new Date(this.ticketData.ticket.due_date) : new Date();

      this.estimateTime = this.ticketService.calculateEstimateTime(closeEstimateDate);
      this.leadTime = this.ticketService.calculateLeadTime(dueDateDate);
    }
    
    // ตรวจสอบและกำหนดค่า assignToName จากอาร์เรย์ assign
    if (this.ticketData?.assign && this.ticketData.assign.length > 0) {
      this.assignToName = this.ticketData.assign[0].assignTo;
    } else {
      this.assignToName = '-';
    }
  }

  // Date Formatting Methods
  formatDate(dateString: string | null | undefined): string {
    if (!dateString || dateString.trim() === '') return '';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  formatDateTime(dateString: string | null | undefined): string {
    if (!dateString || dateString.trim() === '') return '';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting datetime:', error);
      return '';
    }
  }
  
  // Priority Styling
  getPriorityClass(priority: string | undefined): string {
    if (!priority) return '';

    switch (priority.toLowerCase()) {
      case 'high':
      case 'สูง':
        return 'priority-high text-danger';
      case 'medium':
      case 'กลาง':
        return 'priority-medium text-warning';
      case 'low':
      case 'ต่ำ':
        return 'priority-low text-success';
      default:
        return 'priority-normal';
    }
  }
  
  // Attachment Methods
  hasFixAttachments(): boolean {
    return !!(this.ticketData?.fix_attachment &&
      this.ticketData.fix_attachment.length > 0);
  }

  getFixAttachmentsCount(): number {
    return this.ticketData?.fix_attachment?.length || 0;
  }

  getAttachmentDisplayName(attachment: any): string {
    if (attachment.filename) {
      return attachment.filename;
    }

    if (attachment.path) {
      const pathParts = attachment.path.split('/');
      const filename = pathParts[pathParts.length - 1];
      return filename.split('?')[0] || 'Unknown File';
    }

    return `Attachment ${attachment.attachment_id}`;
  }

  getAttachmentIcon(path: string, fileType?: string): string {
    let extension = '';
    if (fileType) {
      extension = fileType.toLowerCase();
    } else if (path) {
      const pathParts = path.split('.');
      extension = pathParts.length > 1 ? pathParts[pathParts.length - 1].toLowerCase() : '';
    }

    switch (extension) {
      case 'pdf':
        return 'bi-file-earmark-pdf-fill text-danger';
      case 'doc':
      case 'docx':
        return 'bi-file-earmark-word-fill text-primary';
      case 'xls':
      case 'xlsx':
      case 'csv':
        return 'bi-file-earmark-excel-fill text-success';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'bi-image-fill text-info';
      case 'txt':
      case 'log':
      case 'md':
        return 'bi-file-earmark-text-fill text-secondary';
      case 'zip':
      case 'rar':
      case '7z':
        return 'bi-file-earmark-zip-fill text-warning';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
        return 'bi-file-earmark-play-fill text-purple';
      case 'mp3':
      case 'wav':
      case 'aac':
        return 'bi-file-earmark-music-fill text-primary';
      default:
        return 'bi-file-earmark-fill text-muted';
    }
  }

  getAttachmentTooltip(attachment: any): string {
    const fileName = this.getAttachmentDisplayName(attachment);
    const fileSize = this.formatFileSize(attachment.file_size);
    const fileType = attachment.file_type || 'Unknown';
    let tooltip = `ไฟล์: ${fileName}`;
    if (fileSize) tooltip += `\nขนาด: ${fileSize}`;
    if (fileType !== 'Unknown') tooltip += `\nประเภท: ${fileType}`;
    tooltip += '\nคลิกเพื่อดาวน์โหลด';
    return tooltip;
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  onDownloadAttachment(attachmentId: number, path: string): void {
    console.log(`Downloading attachment ${attachmentId}:`, path);
    if (path.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = path;
      link.download = `attachment_${attachmentId}`;
      link.click();
    } else {
      window.open(path, '_blank');
    }
  }
}