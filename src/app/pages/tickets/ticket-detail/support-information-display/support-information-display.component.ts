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
  assignToName: string = '-';

  // ✅ เพิ่ม properties สำหรับจัดการ attachments
  attachmentTypes: {
    [key: number]: {
      type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
      extension: string;
      filename: string;
      isLoading?: boolean;
    }
  } = {};

  constructor(private ticketService: TicketService) {}

  @Input() ticketData: TicketData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketData'] && this.ticketData) {
      this.updateDisplayData();
      this.analyzeAllAttachments(); // ✅ เพิ่มการวิเคราะห์ไฟล์
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

  // ===== ✅ NEW METHODS FOR ADVANCED ATTACHMENT HANDLING =====

  /**
   * วิเคราะห์ไฟล์แนบทั้งหมด
   */
  private analyzeAllAttachments(): void {
    if (!this.ticketData) return;

    if (this.ticketData.fix_attachment?.length > 0) {
      this.ticketData.fix_attachment.forEach(attachment => {
        this.analyzeAttachment(attachment);
      });
    }
  }

  /**
   * วิเคราะห์ไฟล์แนบแต่ละไฟล์
   */
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
      return;
    }

    this.tryImageLoad(attachment.path, attachmentId);
  }

  /**
   * ตรวจสอบว่าเป็นไฟล์รูปภาพหรือไม่
   */
  isImageFile(path: string, attachmentId?: number): boolean {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }

    if (path.startsWith('data:image/')) return true;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }

  /**
   * ดึงข้อมูลไฟล์
   */
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
        icon: this.getFileIconClass(fileInfo.type)
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
   * ดึง icon class ตามประเภทไฟล์
   */
  private getFileIconClass(type: string): string {
    switch (type) {
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

  /**
   * ดึงชื่อไฟล์สำหรับแสดง
   */
  getDisplayFileName(path: string, attachmentId?: number): string {
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }
    return this.extractFilenameFromPath(path);
  }

  /**
   * ดึงขนาดไฟล์
   */
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

  /**
   * จัดการ error เมื่อโหลดรูปภาพไม่สำเร็จ
   */
  onImageError(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
    }
  }

  /**
   * จัดการเมื่อโหลดรูปภาพสำเร็จ
   */
  onImageLoad(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
    }
  }

  // ===== HELPER METHODS =====

  private getFileExtension(filename: string): string {
    if (!filename || filename === 'unknown') return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private getFileTypeFromFilename(filename: string): string {
    const extension = this.getFileExtension(filename);
    return extension || 'unknown';
  }

  private extractFilenameFromPath(path: string): string {
    if (!path) return 'unknown';
    if (path.startsWith('data:')) return 'data_file';
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0] || 'unknown';
  }

  private determineFileCategory(
    fileType: string, 
    filename: string
  ): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = fileType.toLowerCase();
    const ext = this.getFileExtension(filename).toLowerCase();

    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
      return 'image';
    }
    if (type.includes('pdf') || ext === 'pdf') return 'pdf';
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (type.includes('word') || type.includes('document') || ['doc', 'docx'].includes(ext)) return 'word';
    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml'].includes(ext)) return 'text';
    if (type.includes('archive') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return 'video';
    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) return 'audio';

    return 'file';
  }

  private determineFileCategoryByExtension(
    extension: string
  ): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const ext = extension.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['txt', 'log', 'md', 'json', 'xml'].includes(ext)) return 'text';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) return 'audio';

    return 'file';
  }

  private extractMimeTypeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+)/);
    return match ? match[1] : '';
  }

  private determineFileCategoryByMimeType(
    mimeType: string
  ): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
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
      'application/pdf': 'pdf',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/json': 'json',
      'application/zip': 'zip',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3'
    };
    return mimeToExt[mimeType] || 'bin';
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
    };

    img.onerror = () => {
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: this.extractFilenameFromPath(url) || `file_${attachmentId}`,
        isLoading: false
      };
    };

    img.crossOrigin = 'anonymous';
    img.src = url;
  }
}