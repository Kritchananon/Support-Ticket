import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ✅ Import interfaces ใหม่
import { 
  SaveSupporterResponse, 
  SaveSupporterFormData, 
  TicketAttachment 
} from '../models/ticket.model';

export interface TicketAttachmentResponse {
  ticket: {
    id: number;
    ticket_no: string;
    issue_description: string;
    project_id: number;
    categories_id: number;
    status_id: number;
    create_by: number;
    create_date: string;
    update_date: string;
  };
  attachments: {
    id: number;
    filename: string;
    original_name: string;
    path: string;
    type: string;
    ticket_id: number;
    create_date: string;
    create_by: number;
  }[];
}

export interface ApiResponse<T> {
  code?: string | number;
  status?: number | boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Helper method สำหรับสร้าง headers พร้อม token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
      // ไม่ใส่ Content-Type สำหรับ multipart/form-data
    });
  }

  // ✅ Helper method สำหรับสร้าง headers สำหรับ JSON request
  private getJsonHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      'language': 'th' // ✅ เพิ่ม language header ตาม API spec
    });
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('Ticket Service Error:', error);
    let errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 401:
          errorMessage = 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่';
          break;
        case 403:
          errorMessage = 'ไม่มีสิทธิ์ในการดำเนินการนี้';
          break;
        case 404:
          errorMessage = 'ไม่พบข้อมูลที่ต้องการ';
          break;
        case 413:
          errorMessage = 'ไฟล์มีขนาดใหญ่เกินไป';
          break;
        case 415:
          errorMessage = 'ประเภทไฟล์ไม่ถูกต้อง';
          break;
        case 422:
          errorMessage = 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
          break;
        case 500:
          errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์';
          break;
        default:
          errorMessage = error.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      }
    }
    
    return throwError(() => errorMessage);
  }

  // ✅ ============ NEW: saveSupporter Method ============

  /**
   * บันทึกข้อมูล supporter สำหรับ ticket
   * @param ticketNo หมายเลข ticket
   * @param formData ข้อมูลฟอร์ม supporter
   * @param files ไฟล์แนบ (optional)
   * @returns Observable ผลลัพธ์การบันทึก
   */
  saveSupporter(
    ticketNo: string, 
    formData: SaveSupporterFormData, 
    files: File[] = []
  ): Observable<SaveSupporterResponse> {
    
    console.log('=== saveSupporter called ===');
    console.log('Ticket No:', ticketNo);
    console.log('Form Data:', formData);
    console.log('Files:', files.length);

    // ✅ สร้าง FormData สำหรับส่งไปยัง API
    const requestFormData = new FormData();

    // ✅ เพิ่มข้อมูลพื้นฐาน
    if (formData.estimate_time !== undefined) {
      requestFormData.append('estimate_time', formData.estimate_time.toString());
    }
    
    if (formData.lead_time !== undefined) {
      requestFormData.append('lead_time', formData.lead_time.toString());
    }
    
    if (formData.due_date) {
      requestFormData.append('due_date', formData.due_date);
    }
    
    if (formData.close_estimate) {
      requestFormData.append('close_estimate', formData.close_estimate);
    }
    
    if (formData.fix_issue_description) {
      requestFormData.append('fix_issue_description', formData.fix_issue_description);
    }
    
    if (formData.related_ticket_id) {
      requestFormData.append('related_ticket_id', formData.related_ticket_id.toString());
    }

    // ✅ เพิ่มไฟล์แนบ (ถ้ามี)
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        requestFormData.append('attachments', file);
        console.log(`Added file ${index + 1}: ${file.name}`);
      });
    }

    // ✅ เพิ่ม user ID จาก localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.id) {
      requestFormData.append('user_id', currentUser.id.toString());
    }

    // ✅ Debug: แสดงข้อมูลใน FormData
    console.log('FormData contents:');
    requestFormData.forEach((value, key) => {
      if (value instanceof File) {
        console.log(`${key}: File(${value.name}, ${value.size} bytes)`);
      } else {
        console.log(`${key}: ${value}`);
      }
    });

    // ✅ ส่ง request ไปยัง API
    return this.http.post<SaveSupporterResponse>(
      `${this.apiUrl}/saveSupporter/${ticketNo}`, 
      requestFormData, 
      { 
        headers: this.getAuthHeaders() // ไม่ระบุ Content-Type ให้ browser ตั้งเอง
      }
    ).pipe(
      catchError((error) => {
        console.error('saveSupporter error:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * ✅ ตรวจสอบว่า user มีสิทธิ์ saveSupporter หรือไม่
   * @returns boolean
   */
  canUserSaveSupporter(): boolean {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // ตรวจสอบ role หรือ permission
    // ปรับตาม business logic ของแอพ
    const allowedRoles = ['supporter', 'admin', 'lead'];
    const userRole = currentUser.role?.toLowerCase();
    
    if (allowedRoles.includes(userRole)) {
      return true;
    }

    // ตรวจสอบ permissions
    const permissions = currentUser.permissions || [];
    return permissions.includes('SOLVE_PROBLEM');
  }

  /**
   * ✅ สร้าง FormData สำหรับ saveSupporter แบบง่าย
   * @param ticketId ID ของ ticket (สำหรับ body parameter)
   * @returns FormData
   */
  createBasicSupporterFormData(ticketId: number): FormData {
    const formData = new FormData();
    formData.append('ticket_id', ticketId.toString());
    
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.id) {
      formData.append('user_id', currentUser.id.toString());
    }
    
    return formData;
  }

  /**
   * ✅ Validate ข้อมูลก่อนส่ง saveSupporter
   * @param formData ข้อมูลที่ต้องการ validate
   * @param files ไฟล์แนบ
   * @returns object ผลการ validate
   */
  validateSupporterData(
    formData: SaveSupporterFormData, 
    files: File[] = []
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ตรวจสอบ estimate_time
    if (formData.estimate_time !== undefined) {
      if (formData.estimate_time < 0 || formData.estimate_time > 1000) {
        errors.push('เวลาประมาณการต้องอยู่ระหว่าง 0-1000 ชั่วโมง');
      }
    }

    // ตรวจสอบ lead_time
    if (formData.lead_time !== undefined) {
      if (formData.lead_time < 0 || formData.lead_time > 10000) {
        errors.push('เวลาที่ใช้จริงต้องอยู่ระหว่าง 0-10000 ชั่วโมง');
      }
    }

    // ตรวจสอบ due_date
    if (formData.due_date) {
      const dueDate = new Date(formData.due_date);
      if (isNaN(dueDate.getTime())) {
        errors.push('รูปแบบวันครบกำหนดไม่ถูกต้อง');
      }
    }

    // ตรวจสอบ close_estimate
    if (formData.close_estimate) {
      const closeDate = new Date(formData.close_estimate);
      if (isNaN(closeDate.getTime())) {
        errors.push('รูปแบบเวลาประมาณการปิดไม่ถูกต้อง');
      }
    }

    // ตรวจสอบ fix_issue_description
    if (formData.fix_issue_description) {
      if (formData.fix_issue_description.length > 5000) {
        errors.push('รายละเอียดการแก้ไขต้องไม่เกิน 5000 ตัวอักษร');
      }
    }

    // ตรวจสอบไฟล์แนบ
    if (files.length > 5) {
      errors.push('สามารถแนบไฟล์ได้สูงสุด 5 ไฟล์');
    }

    // ตรวจสอบขนาดและประเภทไฟล์
    for (const file of files) {
      if (!this.isValidFileType(file)) {
        errors.push(`ไฟล์ ${file.name} มีประเภทที่ไม่รองรับ`);
      }
      
      if (!this.isValidFileSize(file)) {
        errors.push(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 10MB`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ✅ ============ EXISTING METHODS ============

  /**
   * อัปโหลดไฟล์แนบสำหรับตั๋วใหม่
   * @param files ไฟล์ที่ต้องการอัปโหลด
   * @param projectId ไอดีของโปรเจค
   * @param categoryId ไอดีของหมวดหมู่
   * @param issueDescription รายละเอียดปัญหา
   * @param type ประเภทของไฟล์แนบ (reporter หรือ supporter)
   * @returns Observable ข้อมูลผลลัพธ์
   */
  createTicketWithAttachments(
    files: File[] = [], // ค่าเริ่มต้นเป็น empty array
    projectId: number,
    categoryId: number,
    issueDescription: string,
    type: string = 'reporter'
  ): Observable<ApiResponse<TicketAttachmentResponse>> {
    const formData = new FormData();
    
    // เฉพาะกรณีที่มีไฟล์
    if (files && files.length > 0) {
      for (const file of files) {
        formData.append('files', file);
      }
    }
    
    // เพิ่มข้อมูลอื่นๆ
    formData.append('project_id', projectId.toString());
    formData.append('category_id', categoryId.toString());
    formData.append('issue_description', issueDescription);
    formData.append('type', type);
    formData.append('status_id', '1'); // Default status: New
    
    // รับ user_id จาก localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.id) {
      formData.append('create_by', currentUser.id.toString());
    }

    console.log('Sending FormData to API:', {
      project_id: projectId,
      category_id: categoryId,
      issue_description: issueDescription,
      type: type,
      files_count: files.length,
      create_by: currentUser.id
    });

    return this.http.post<ApiResponse<TicketAttachmentResponse>>(
      `${this.apiUrl}/updateAttachment`, 
      formData, 
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * อัปเดตไฟล์แนบสำหรับตั๋วที่มีอยู่แล้ว
   * @param ticketId ไอดีของตั๋ว
   * @param files ไฟล์ที่ต้องการอัปโหลด
   * @param type ประเภทของไฟล์แนบ (reporter หรือ supporter)
   * @returns Observable ข้อมูลผลลัพธ์
   */
  updateTicketAttachments(
    ticketId: number,
    files: File[],
    type: string = 'supporter'
  ): Observable<ApiResponse<TicketAttachmentResponse>> {
    const formData = new FormData();
    
    // เพิ่มไฟล์ลงใน FormData
    for (const file of files) {
      formData.append('files', file);
    }
    
    // เพิ่มข้อมูลที่จำเป็น
    formData.append('ticket_id', ticketId.toString());
    formData.append('type', type);
    
    // รับ user_id จาก localStorage
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (currentUser.id) {
      formData.append('create_by', currentUser.id.toString());
    }

    console.log('Updating ticket attachments:', {
      ticket_id: ticketId,
      type: type,
      files_count: files.length,
      create_by: currentUser.id
    });

    return this.http.post<ApiResponse<TicketAttachmentResponse>>(
      `${this.apiUrl}/updateAttachment`, 
      formData, 
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ดึงข้อมูลไฟล์แนบของตั๋ว
   * @param ticketId ไอดีของตั๋ว
   * @returns Observable ข้อมูลไฟล์แนบ
   */
  getTicketAttachments(ticketId: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(
      `${this.apiUrl}/ticket/${ticketId}/attachments`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ลบไฟล์แนบ
   * @param attachmentId ไอดีของไฟล์แนบ
   * @returns Observable ผลลัพธ์
   */
  deleteAttachment(attachmentId: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/images/issue_attachment/${attachmentId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ดาวน์โหลดไฟล์แนบ
   * @param attachmentId ไอดีของไฟล์แนบ
   * @returns Observable Blob ข้อมูล
   */
  downloadAttachment(attachmentId: number): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/attachment/${attachmentId}/download`,
      { 
        headers: this.getAuthHeaders(),
        responseType: 'blob'
      }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ตรวจสอบประเภทไฟล์ที่รองรับ
   * @param file ไฟล์ที่ต้องการตรวจสอบ
   * @returns boolean
   */
  isValidFileType(file: File): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    
    return allowedTypes.includes(file.type);
  }

  /**
   * ตรวจสอบขนาดไฟล์
   * @param file ไฟล์ที่ต้องการตรวจสอบ
   * @param maxSizeMB ขนาดสูงสุดเป็น MB (default: 10MB)
   * @returns boolean
   */
  isValidFileSize(file: File, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * ตรวจสอบไฟล์ทั้งประเภทและขนาด
   * @param files รายการไฟล์ที่ต้องการตรวจสอบ
   * @param maxFiles จำนวนไฟล์สูงสุด (default: 5)
   * @returns object ผลการตรวจสอบ
   */
  validateFiles(files: File[], maxFiles: number = 5): { 
    isValid: boolean; 
    errors: string[]; 
    validFiles: File[] 
  } {
    const errors: string[] = [];
    const validFiles: File[] = [];

    // ตรวจสอบจำนวนไฟล์
    if (files.length > maxFiles) {
      errors.push(`สามารถอัปโหลดได้สูงสุด ${maxFiles} ไฟล์`);
      return { isValid: false, errors, validFiles: [] };
    }

    if (files.length === 0) {
      errors.push('กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์');
      return { isValid: false, errors, validFiles: [] };
    }

    for (const file of files) {
      // ตรวจสอบประเภทไฟล์
      if (!this.isValidFileType(file)) {
        errors.push(`ไฟล์ ${file.name} มีประเภทที่ไม่รองรับ (รองรับ: jpg, png, gif, pdf, doc, docx, xls, xlsx, txt)`);
        continue;
      }

      // ตรวจสอบขนาดไฟล์
      if (!this.isValidFileSize(file)) {
        errors.push(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 10MB (ขนาดปัจจุบัน: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        continue;
      }

      // ตรวจสอบชื่อไฟล์
      if (file.name.length > 255) {
        errors.push(`ชื่อไฟล์ ${file.name} ยาวเกิน 255 ตัวอักษร`);
        continue;
      }

      validFiles.push(file);
    }

    return {
      isValid: errors.length === 0 && validFiles.length > 0,
      errors,
      validFiles
    };
  }

  /**
   * แปลงขนาดไฟล์เป็น string ที่อ่านง่าย
   * @param bytes ขนาดไฟล์ในหน่วย bytes
   * @returns string ขนาดไฟล์ที่แปลงแล้ว
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * ดึงไอคอนสำหรับประเภทไฟล์
   * @param fileName ชื่อไฟล์
   * @returns string class ของ Bootstrap Icon
   */
  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return 'bi-file-earmark-pdf';
      case 'doc':
      case 'docx':
        return 'bi-file-earmark-word';
      case 'xls':
      case 'xlsx':
        return 'bi-file-earmark-excel';
      case 'ppt':
      case 'pptx':
        return 'bi-file-earmark-ppt';
      case 'txt':
        return 'bi-file-earmark-text';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'bi-file-earmark-image';
      case 'zip':
      case 'rar':
      case '7z':
        return 'bi-file-earmark-zip';
      default:
        return 'bi-file-earmark';
    }
  }

  /**
   * ตรวจสอบว่าไฟล์เป็นรูปภาพหรือไม่
   * @param file ไฟล์ที่ต้องการตรวจสอบ
   * @returns boolean
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * สร้าง preview URL สำหรับรูปภาพ
   * @param file ไฟล์รูปภาพ
   * @returns Promise<string> URL สำหรับ preview
   */
  createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isImageFile(file)) {
        reject('File is not an image');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => {
        reject('Error reading file');
      };
      reader.readAsDataURL(file);
    });
  }
}