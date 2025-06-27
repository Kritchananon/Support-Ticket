import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, filter, take, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService, TokenData } from './auth.service';
import { ProjectDDLRequest, ProjectDDLResponse } from '../models/project.model';
import { CategoryDDLRequest, CategoryDDLResponse } from '../models/category.model';

// ✅ HTTP Interceptor Class
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ✅ เพิ่ม token ใน header อัตโนมัติ
    req = this.addTokenHeader(req);

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // ✅ จัดการ 401 Unauthorized
        if (error.status === 401) {
          return this.handle401Error(req, next);
        }
        
        return throwError(() => error);
      })
    );
  }

  private addTokenHeader(request: HttpRequest<any>): HttpRequest<any> {
    const token = this.authService.getToken();
    
    if (token && !this.authService.isTokenExpired()) {
      return request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
    }
    
    return request;
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.authService.getRefreshToken();
      
      if (refreshToken) {
        return this.authService.refreshAccessToken().pipe(
          switchMap((tokenData: TokenData) => {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(tokenData.access_token);
            
            // ลองใหม่ด้วย token ใหม่
            return next.handle(this.addTokenHeader(request));
          }),
          catchError((error) => {
            this.isRefreshing = false;
            // Refresh ล้มเหลว - AuthService จะจัดการ logout เอง
            return throwError(() => error);
          })
        );
      } else {
        // ไม่มี refresh token
        this.authService.clearTokensAndRedirect();
        return throwError(() => new Error('No refresh token available'));
      }
    }

    // ถ้ากำลัง refresh อยู่ ให้รอ
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(() => next.handle(this.addTokenHeader(request)))
    );
  }
}

// ✅ API Service (เดิม + เพิ่ม auth headers อัตโนมัติ)
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

// ✅ เพิ่ม interfaces สำหรับ getAllMasterFilter API
export interface MasterFilterCategory {
  id: number;
  name: string;
}

export interface MasterFilterProject {
  id: number;
  name: string;
}

export interface MasterFilterData {
  categories: MasterFilterCategory[];
  projects: MasterFilterProject[];
}

export interface MasterFilterRequest {
  // ไม่มีพารามิเตอร์เพิ่มเติม
}

export interface MasterFilterResponse {
  code: number;
  message: string;
  data: MasterFilterData | null;
}

// ✅ เพิ่ม interfaces สำหรับ getAllTicket API
export interface GetAllTicketRequest {
  // ไม่มี parameters เพิ่มเติม เพราะ userId จะมาจาก JWT token
}

export interface GetAllTicketResponse {
  success: boolean;
  data?: AllTicketData[];
  message?: string;
  debug?: {
    userId: number;
    ticketCount: number;
  };
}

export interface AllTicketData {
  ticket_no: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id: number;
  create_by: number;
  create_date: string;
  // เพิ่มข้อมูลที่อาจจะได้จาก join หรือ mapping
  category_name?: string;
  project_name?: string;
  user_name?: string;
  priority?: string;
}

// ✅ เพิ่ม interfaces สำหรับ saveTicket API
export interface SaveTicketRequest {
  ticket_id?: number;           
  project_id: number;
  categories_id: number;
  issue_description: string;
}

export interface SaveTicketResponse {
  code: number;                 
  message: string;
  ticket_id: number;           
  ticket_no: string;           
}

// ✅ เพิ่ม interfaces สำหรับ updateAttachment API
export interface UpdateAttachmentRequest {
  ticket_id?: number | null;    
  project_id?: number;          
  categories_id?: number;       
  issue_description?: string;   
  files?: File[];               
}

export interface UpdateAttachmentResponse {
  code: number;                 
  message: string;
  ticket_id: number;
  attachment_id?: number;
  data: AttachmentData[];
}

export interface AttachmentData {
  attachment_id: number;
  attachment_path: string;
}

// ✅ เพิ่ม interfaces สำหรับ getTicketData API
export interface GetTicketDataRequest {
  ticket_no: string;
}

export interface GetTicketDataResponse {
  code: number;                 
  message: string;
  data: {
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
  };
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
  private authService = inject(AuthService);

  constructor(private http: HttpClient) { }

  // ✅ Helper method สำหรับสร้าง headers พร้อม token (อัตโนมัติ)
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const language = localStorage.getItem('language') || 'th';
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'language': language
    });
  }

  // ✅ Helper method สำหรับสร้าง headers สำหรับ multipart (อัตโนมัติ)
  private getMultipartHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const language = localStorage.getItem('language') || 'th';
    
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'language': language
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

  // ===== Get All Tickets API ===== ✅
  /**
   * เรียก API getAllTicket เพื่อดึงข้อมูล tickets ทั้งหมดของ user ปัจจุบัน
   * userId จะถูกดึงจาก JWT token อัตโนมัติ
   */
  getAllTickets(): Observable<GetAllTicketResponse> {
    console.log('Calling getAllTicket API');
    
    const requestBody: GetAllTicketRequest = {};
    
    return this.http.post<GetAllTicketResponse>(`${this.apiUrl}/getAllTicket`, requestBody, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log('getAllTicket API response:', response);
        if (response.debug) {
          console.log('Debug info:', response.debug);
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Helper method สำหรับแปลง raw ticket data ให้มีข้อมูลเพิ่มเติม
   * @param tickets Raw ticket data จาก API
   * @returns Processed ticket data พร้อมข้อมูลเพิ่มเติม
   */
  private processTicketData(tickets: AllTicketData[]): AllTicketData[] {
    return tickets.map(ticket => ({
      ...ticket,
      // เพิ่ม priority default ถ้าไม่มี
      priority: ticket.priority || this.generateRandomPriority(),
      // Format date ถ้าต้องการ
      create_date: ticket.create_date || new Date().toISOString()
    }));
  }

  /**
   * สร้าง priority แบบสุ่มสำหรับ demo (ในการใช้งานจริงควรมาจาก database)
   */
  private generateRandomPriority(): string {
    const priorities = ['high', 'medium', 'low'];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }

  /**
   * Fallback method ที่ใช้ข้อมูลจาก master filter มาช่วยเติมข้อมูล
   */
  getAllTicketsWithDetails(): Observable<AllTicketData[]> {
    return this.getAllTickets().pipe(
      switchMap(ticketResponse => {
        if (!ticketResponse.success || !ticketResponse.data) {
          return of([]);
        }

        // ดึงข้อมูล master filter เพื่อ map ชื่อ category และ project
        return this.getAllMasterFilter().pipe(
          map(masterResponse => {
            const categories = masterResponse.data?.categories || [];
            const projects = masterResponse.data?.projects || [];

            return ticketResponse.data!.map(ticket => ({
              ...ticket,
              category_name: categories.find(c => c.id === ticket.categories_id)?.name || 'Unknown Category',
              project_name: projects.find(p => p.id === ticket.project_id)?.name || 'Unknown Project',
              user_name: 'Current User', // ในการใช้งานจริงอาจต้องดึงจาก user service
              priority: ticket.priority || this.generateRandomPriority()
            }));
          }),
          catchError(error => {
            console.warn('Error loading master filter, using basic ticket data:', error);
            // ถ้า master filter ล้มเหลว ให้ใช้ข้อมูลพื้นฐาน
            return of(this.processTicketData(ticketResponse.data!));
          })
        );
      }),
      catchError(error => {
        console.error('Error in getAllTicketsWithDetails:', error);
        return of([]);
      })
    );
  }

  // ===== Get All Master Filter API ===== ✅
  /**
   * เรียก API getAllMasterFilter เพื่อดึงข้อมูล categories และ projects สำหรับ filter
   */
  getAllMasterFilter(): Observable<MasterFilterResponse> {
    console.log('Calling getAllMasterFilter API');
    
    const requestBody: MasterFilterRequest = {};
    
    return this.http.post<MasterFilterResponse>(`${this.apiUrl}/getAllMasterFilter`, requestBody, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getAllMasterFilter API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Helper method สำหรับดึงเฉพาะ categories จาก master filter
   */
  getMasterFilterCategories(): Observable<MasterFilterCategory[]> {
    return this.getAllMasterFilter().pipe(
      map(response => {
        if (response.code === 1 && response.data) {
          return response.data.categories || [];
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting master filter categories:', error);
        return of([]); // ส่งกลับ empty array ถ้าเกิดข้อผิดพลาด
      })
    );
  }

  /**
   * Helper method สำหรับดึงเฉพาะ projects จาก master filter
   */
  getMasterFilterProjects(): Observable<MasterFilterProject[]> {
    return this.getAllMasterFilter().pipe(
      map(response => {
        if (response.code === 1 && response.data) {
          return response.data.projects || [];
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting master filter projects:', error);
        return of([]); // ส่งกลับ empty array ถ้าเกิดข้อผิดพลาด
      })
    );
  }

  // ===== Save Ticket API ===== ✅
  saveTicket(data: SaveTicketRequest): Observable<SaveTicketResponse> {
    console.log('Calling saveTicket API with data:', data);
    
    return this.http.post<SaveTicketResponse>(`${this.apiUrl}/saveTicket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('saveTicket API response:', response)),
      catchError(this.handleError)
    );
  }

  createTicketNew(data: {
    project_id: number;
    categories_id: number;
    issue_description: string;
  }): Observable<SaveTicketResponse> {
    const requestData: SaveTicketRequest = {
      project_id: data.project_id,
      categories_id: data.categories_id,
      issue_description: data.issue_description
    };

    return this.saveTicket(requestData);
  }

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
  updateAttachment(data: UpdateAttachmentRequest): Observable<UpdateAttachmentResponse> {
    console.log('Calling updateAttachment API with data:', {
      ticket_id: data.ticket_id,
      files_count: data.files?.length || 0,
      project_id: data.project_id,
      categories_id: data.categories_id
    });

    const formData = new FormData();

    // ✅ เพิ่ม ticket_id (ถ้ามี)
    if (data.ticket_id !== null && data.ticket_id !== undefined) {
      formData.append('ticket_id', data.ticket_id.toString());
    }

    // ✅ เพิ่มข้อมูล ticket (สำหรับกรณีสร้างใหม่)
    if (data.project_id) {
      formData.append('project_id', data.project_id.toString());
    }
    if (data.categories_id) {
      formData.append('categories_id', data.categories_id.toString());
    }
    if (data.issue_description) {
      formData.append('issue_description', data.issue_description);
    }

    // ✅ เพิ่มไฟล์
    if (data.files && data.files.length > 0) {
      data.files.forEach(file => {
        formData.append('files', file);
      });
    }

    // ✅ เพิ่ม type parameter
    formData.append('type', 'reporter');

    return this.http.post<UpdateAttachmentResponse>(
      `${this.apiUrl}/updateAttachment`, 
      formData, 
      { headers: this.getMultipartHeaders() }
    ).pipe(
      tap(response => console.log('updateAttachment API response:', response)),
      catchError(this.handleError)
    );
  }

  // ===== Get Ticket Data API ===== ✅
  getTicketData(request: GetTicketDataRequest): Observable<GetTicketDataResponse> {
    console.log('Calling getTicketData API with:', request);
    
    return this.http.post<GetTicketDataResponse>(`${this.apiUrl}/getTicketData`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTicketData API response:', response)),
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

  // ===== Ticket APIs ===== ✅ แก้ไขใหม่
  
  getTickets(params?: {
    page?: number;
    limit?: number;
    status?: string | number;
    project_id?: number;
    category_id?: number;
    search?: string;
  }): Observable<ApiResponse<TicketData[]>> {
    
    // สร้าง query parameters
    let queryParams = '';
    if (params) {
      const paramArray: string[] = [];
      
      if (params.page !== undefined) {
        paramArray.push(`page=${params.page}`);
      }
      if (params.limit !== undefined) {
        paramArray.push(`limit=${params.limit}`);
      }
      if (params.status !== undefined) {
        paramArray.push(`status=${params.status}`);
      }
      if (params.project_id !== undefined) {
        paramArray.push(`project_id=${params.project_id}`);
      }
      if (params.category_id !== undefined) {
        paramArray.push(`category_id=${params.category_id}`);
      }
      if (params.search !== undefined && params.search.trim()) {
        paramArray.push(`search=${encodeURIComponent(params.search)}`);
      }
      
      if (paramArray.length > 0) {
        queryParams = '?' + paramArray.join('&');
      }
    }

    console.log('Getting tickets with params:', queryParams);

    return this.http.get<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket${queryParams}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTickets response:', response)),
      catchError((error) => {
        console.error('getTickets error:', error);
        // ส่งกลับ mock data ถ้า API ล้มเหลว
        return this.getMockTicketsResponse();
      })
    );
  }

  getTicketsPost(request: {
    page?: number;
    limit?: number;
    filters?: {
      status?: string | number;
      project_id?: number;
      category_id?: number;
      search?: string;
      date_from?: string;
      date_to?: string;
    };
  }): Observable<ApiResponse<TicketData[]>> {
    
    const requestBody = {
      page: request.page || 1,
      limit: request.limit || 50,
      filters: request.filters || {}
    };

    console.log('Getting tickets via POST with request:', requestBody);

    return this.http.post<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket/search`, requestBody, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTicketsPost response:', response)),
      catchError((error) => {
        console.error('getTicketsPost error:', error);
        return this.getMockTicketsResponse();
      })
    );
  }

  private getMockTicketsResponse(): Observable<ApiResponse<TicketData[]>> {
    const mockTickets: TicketData[] = [
      {
        id: 1,
        ticket_no: '#68050001',
        categories_id: 1,
        project_id: 1,
        issue_description: 'บันทึกข้อมูลใบลาไม่ได้',
        status_id: 1,
        hour_estimate: 4,
        estimate_time: '2025-06-15T10:00:00Z',
        due_date: '2025-06-20T17:00:00Z',
        lead_time: 2,
        change_request: false,
        create_date: '2025-06-10T09:00:00Z',
        create_by: 1,
        update_date: '2025-06-10T09:00:00Z',
        update_by: 1,
        isenabled: true
      }
    ];

    const mockResponse: ApiResponse<TicketData[]> = {
      code: '2',
      status: 1,
      message: 'success',
      data: mockTickets
    };

    console.log('Returning mock tickets response');
    return new Observable(observer => {
      observer.next(mockResponse);
      observer.complete();
    });
  }

  getTicketByTicketNo(ticket_no: string): Observable<ApiResponse<TicketData>> {
    return this.http.get<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${ticket_no}`, {
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
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/ticket/stats`, {
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

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/upload`, formData, {
      headers: this.getMultipartHeaders()
    }).pipe(catchError(this.handleError));
  }
}