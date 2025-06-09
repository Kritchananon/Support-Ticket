import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ProjectDDLRequest, ProjectDDLResponse } from '../models/project.model';
import { CategoryDDLRequest, CategoryDDLResponse } from '../models/category.model';

export interface ApiResponse<T> {
  code?: string;
  status?: number;
  message: string;
  data: T;
}

export interface TicketData {
  id?: number;
  ticket_no?: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id?: number;
  hour_estimate?: number;
  estimate_time?: string;
  due_date?: string;
  lead_time?: number;
  related_ticket_id?: number;
  change_request?: boolean;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ✅ เพิ่ม interfaces สำหรับ saveTicket API
export interface SaveTicketRequest {
  ticket_id?: number;           // ไม่ส่งหรือส่งเป็น undefined = สร้างใหม่
  project_id: number;
  categories_id: number;
  issue_description: string;
}

export interface SaveTicketResponse {
  code: number;                 // 1 = success, 2 = error
  message: string;
  ticket_id: number;           // ✅ มี ticket_id ใน response
  ticket_no: string;           // ✅ มี ticket_no ใน response
}

// ✅ เพิ่ม interfaces สำหรับ updateAttachment API
export interface UpdateAttachmentRequest {
  ticket_id?: number | null;    // NULL = สร้าง ticket ใหม่, มีค่า = เพิ่มไฟล์เข้า ticket ที่มีอยู่
  project_id?: number;          // สำหรับกรณีสร้าง ticket ใหม่
  categories_id?: number;       // สำหรับกรณีสร้าง ticket ใหม่
  issue_description?: string;   // สำหรับกรณีสร้าง ticket ใหม่
  files?: File[];               // ไฟล์ที่ต้องการอัปโหลด
}

export interface UpdateAttachmentResponse {
  code: number;                 // 1 = success, 2 = error
  message: string;
  ticket_id: number;
  attachment_id?: number;
  data: AttachmentData[];
}

export interface AttachmentData {
  attachment_id: number;
  attachment_path: string;
}

export interface ProjectData {
  id: number;
  name: string;
  create_by: number;
  isenabled: boolean;
}

export interface CustomerData {
  id: number;
  name: string;
  address: string;
  telephone: string;
  email: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

export interface UserData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  start_date: string;
  end_date: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Helper method สำหรับสร้าง headers พร้อม token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'language': 'th'
    });
  }

  // ✅ Helper method สำหรับสร้าง headers สำหรับ multipart
  private getMultipartHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'language': 'th'
      // ไม่ใส่ Content-Type ให้ browser จัดการเอง
    });
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
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

  // ===== Save Ticket API ===== ✅
  /**
   * บันทึก ticket ใหม่หรืออัปเดต ticket ที่มีอยู่
   * @param data ข้อมูล ticket
   * @returns Observable ผลลัพธ์
   */
  saveTicket(data: SaveTicketRequest): Observable<SaveTicketResponse> {
    console.log('Calling saveTicket API with data:', data);
    
    return this.http.post<SaveTicketResponse>(`${this.apiUrl}/saveTicket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('saveTicket API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * สร้าง ticket ใหม่ (wrapper สำหรับ saveTicket โดยไม่ส่ง ticket_id)
   * @param data ข้อมูล ticket ใหม่
   * @returns Observable ผลลัพธ์
   */
  createTicketNew(data: {
    project_id: number;
    categories_id: number;
    issue_description: string;
  }): Observable<SaveTicketResponse> {
    const requestData: SaveTicketRequest = {
      project_id: data.project_id,
      categories_id: data.categories_id,
      issue_description: data.issue_description
      // ไม่ส่ง ticket_id เพื่อให้ API สร้างใหม่
    };

    return this.saveTicket(requestData);
  }

  /**
   * อัปเดต ticket ที่มีอยู่แล้ว
   * @param ticketId ID ของ ticket ที่ต้องการอัปเดต
   * @param data ข้อมูลที่ต้องการอัปเดต
   * @returns Observable ผลลัพธ์
   */
  updateTicketData(ticketId: number, data: {
    project_id: number;
    categories_id: number;
    issue_description: string;
  }): Observable<SaveTicketResponse> {
    const requestData: SaveTicketRequest = {
      ticket_id: ticketId,
      project_id: data.project_id,
      categories_id: data.categories_id,
      issue_description: data.issue_description
    };

    return this.saveTicket(requestData);
  }

  // ===== Update Attachment API ===== ✅
  /**
   * อัปโหลดไฟล์แนบสำหรับ ticket
   * @param data ข้อมูลและไฟล์ที่ต้องการอัปโหลด
   * @returns Observable ผลลัพธ์
   */
  updateAttachment(data: UpdateAttachmentRequest): Observable<UpdateAttachmentResponse> {
    console.log('Calling updateAttachment API with data:', {
      ticket_id: data.ticket_id,
      files_count: data.files?.length || 0,
      project_id: data.project_id,
      categories_id: data.categories_id
    });

    const formData = new FormData();

    // ✅ แก้ไข: เพิ่ม ticket_id (ถ้ามี)
    if (data.ticket_id !== null && data.ticket_id !== undefined) {
      formData.append('ticket_id', data.ticket_id.toString());
    }

    // ✅ แก้ไข: เพิ่มข้อมูล ticket (สำหรับกรณีสร้างใหม่)
    if (data.project_id) {
      formData.append('project_id', data.project_id.toString());
    }
    if (data.categories_id) {
      formData.append('categories_id', data.categories_id.toString());
    }
    if (data.issue_description) {
      formData.append('issue_description', data.issue_description);
    }

    // ✅ แก้ไขสำคัญ: เปลี่ยนจาก 'attachment[]' เป็น 'files' เพื่อให้ตรงกับ Backend
    if (data.files && data.files.length > 0) {
      data.files.forEach(file => {
        formData.append('files', file);  // ใช้ 'files' ตรงกับ FilesInterceptor ใน Backend
      });
    }

    // ✅ แก้ไข: เพิ่ม type parameter
    formData.append('type', 'reporter');  // default type

    return this.http.post<UpdateAttachmentResponse>(
      `${this.apiUrl}/updateAttachment`, 
      formData, 
      { headers: this.getMultipartHeaders() }
    ).pipe(
      tap(response => console.log('updateAttachment API response:', response)),
      catchError(this.handleError)
    );
  }

  // ===== Project DDL Methods =====
  
  getProjectDDL(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    return this.http.post<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getProjectDDLGet(): Observable<ProjectDDLResponse> {
    return this.http.get<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getActiveProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'active' });
  }

  getAllProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'all' });
  }

  getInactiveProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'inactive' });
  }

  // ===== Categories DDL Methods =====
  
  getCategoriesDDL(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
    return this.http.post<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCategoriesDDLGet(): Observable<CategoryDDLResponse> {
    return this.http.get<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getActiveCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'active' });
  }

  getAllCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'all' });
  }

  getInactiveCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'inactive' });
  }

  // ===== User APIs =====
  getUsers(): Observable<ApiResponse<UserData[]>> {
    return this.http.get<ApiResponse<UserData[]>>(`${this.apiUrl}/users`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getUserById(id: number): Observable<ApiResponse<UserData>> {
    return this.http.get<ApiResponse<UserData>>(`${this.apiUrl}/users/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Customer For Project APIs =====
  getCustomerForProject(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/customer-for-project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerForProjectById(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomerForProject(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomerForProject(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/customer-for-project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomerForProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Project APIs =====
  getProjects(): Observable<ApiResponse<ProjectData[]>> {
    return this.http.get<ApiResponse<ProjectData[]>>(`${this.apiUrl}/project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getProjectById(id: number): Observable<ApiResponse<ProjectData>> {
    return this.http.get<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createProject(data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.post<ApiResponse<ProjectData>>(`${this.apiUrl}/project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateProject(id: number, data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.patch<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Customer APIs =====
  getCustomers(): Observable<ApiResponse<CustomerData[]>> {
    return this.http.get<ApiResponse<CustomerData[]>>(`${this.apiUrl}/customer`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerById(id: number): Observable<ApiResponse<CustomerData>> {
    return this.http.get<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomer(data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.post<ApiResponse<CustomerData>>(`${this.apiUrl}/customer`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomer(id: number, data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.patch<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomer(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket APIs =====
  getTickets(): Observable<ApiResponse<TicketData[]>> {
    return this.http.get<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getTicketById(id: number): Observable<ApiResponse<TicketData>> {
    return this.http.get<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createTicket(data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.post<ApiResponse<TicketData>>(`${this.apiUrl}/ticket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateTicket(id: number, data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.patch<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteTicket(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/ticket/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket Categories APIs =====
  getTicketCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-categories`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket Status APIs =====
  getTicketStatuses(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-status`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Dashboard/Statistics APIs =====
  getDashboardStats(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/dashboard/stats`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== File Upload API =====
  uploadFile(file: File, ticketId?: number): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (ticketId) {
      formData.append('ticket_id', ticketId.toString());
    }

    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : ''
      // ไม่ใส่ Content-Type ให้ browser จัดการเอง สำหรับ multipart/form-data
    });

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/upload`, formData, {
      headers: headers
    }).pipe(catchError(this.handleError));
  }
}
