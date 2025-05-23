import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  code?: string | number;
  status?: boolean | number;
  message: string;
  data?: {
    access_token: string;
    user: {
      id: number;
      username: string;
      firstname: string;
      lastname: string;
      email?: string;
      phone?: string;
    };
  };
  // รองรับ format อื่นๆ
  access_token?: string;
  user?: any;
}

export interface ApiResponse<T> {
  code?: string;
  status?: number;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // ตรวจสอบ token ใน localStorage เมื่อเริ่มต้น
    this.loadUserFromStorage();
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('Auth API Error:', error);
    console.error('Error status:', error.status);
    console.error('Error message:', error.message);
    console.error('Error URL:', error.url);
    return throwError(() => error);
  }

  private loadUserFromStorage(): void {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        this.currentUserSubject.next(JSON.parse(user));
      } catch (error) {
        this.logout();
      }
    }
  }

  // เข้าสู่ระบบแบบ Promise (สำหรับ login component เดิม)
  async login(username: string, password: string, language: string = 'th'): Promise<LoginResponse> {
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'language': language  // ใส่ language header กลับมา
      });

      const body: LoginRequest = {
        username,
        password
      };

      console.log('Login attempt:', { username, apiUrl: this.apiUrl });
      console.log('Request headers:', headers);

      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, body, { headers })
          .pipe(catchError(this.handleError))
      );

      console.log('Login response:', response);

      // รองรับ response format หลายแบบ
      const isSuccess = response.code === '2' || 
                       response.code === 2 || 
                       response.status === true || 
                       response.status === 1 ||
                       (response.message && response.message.toLowerCase().includes('success'));

      if (isSuccess) {
        // ดึง token และ user data จาก response อย่างปลอดภัย
        let token = '';
        let userData = null;

        if (response.data?.access_token) {
          token = response.data.access_token;
          userData = response.data.user;
        } else if (response.access_token) {
          token = response.access_token;
          userData = response.user;
        }

        if (token) {
          localStorage.setItem('access_token', token);
          if (userData) {
            localStorage.setItem('user', JSON.stringify(userData));
            this.currentUserSubject.next(userData);
          }
        }
      }

      return response;
    } catch (error: any) {
      console.error('Login catch error:', error);
      if (error.error?.message) {
        throw new Error(error.error.message);
      }
      throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  }

  // เข้าสู่ระบบแบบ Observable (สำหรับใช้กับ reactive forms)
  loginObservable(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          const isSuccess = response.code === '2' || 
                           response.code === 2 || 
                           response.status === true || 
                           response.status === 1 ||
                           (response.message && response.message.toLowerCase().includes('success'));

          if (isSuccess) {
            // ดึง token และ user data จาก response อย่างปลอดภัย
            let token = '';
            let userData = null;

            if (response.data?.access_token) {
              token = response.data.access_token;
              userData = response.data.user;
            } else if (response.access_token) {
              token = response.access_token;
              userData = response.user;
            }

            if (token) {
              localStorage.setItem('access_token', token);
              if (userData) {
                localStorage.setItem('user', JSON.stringify(userData));
                this.currentUserSubject.next(userData);
              }
            }
          }
        }),
        catchError(this.handleError)
      );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, userData)
      .pipe(catchError(this.handleError));
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('remember_me');
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }

  setAuthData(token: string, userData: any): void {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    this.currentUserSubject.next(userData);
  }
}
