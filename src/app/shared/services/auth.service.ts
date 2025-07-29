import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
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
    refresh_token: string;
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
  refresh_token?: string;
  user?: any;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at?: string;
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
  
  // Token management properties
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private warningSubject = new BehaviorSubject<boolean>(false);
  private refreshInProgress = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
    this.initTokenCheck();
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('Auth API Error:', error);
    return throwError(() => error);
  }

  private loadUserFromStorage(): void {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        this.currentUserSubject.next(JSON.parse(user));
        this.tokenSubject.next(token);
      } catch (error) {
        this.logout();
      }
    }
  }

  // ✅ Token Management Methods
  setTokens(tokenData: TokenData): void {
    localStorage.setItem('access_token', tokenData.access_token);
    localStorage.setItem('refresh_token', tokenData.refresh_token);
    
    if (tokenData.expires_at) {
      localStorage.setItem('token_expires_at', tokenData.expires_at);
    } else {
      try {
        const payload = JSON.parse(atob(tokenData.access_token.split('.')[1]));
        if (payload.exp) {
          localStorage.setItem('token_expires_at', (payload.exp * 1000).toString());
        }
      } catch (error) {
        console.warn('Cannot parse token expiration:', error);
      }
    }
    
    this.tokenSubject.next(tokenData.access_token);
    console.log('✅ Tokens saved successfully');
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  isTokenExpiring(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp - currentTime;
      return timeLeft <= 300; // 5 minutes
    } catch (error) {
      return false;
    }
  }

  // ✅ ปรับปรุง hasValidToken method
  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) {
      console.log('❌ No token found');
      return false;
    }

    if (this.isTokenExpired()) {
      console.log('❌ Token is expired');
      return false;
    }

    console.log('✅ Token is valid');
    return true;
  }

  // ✅ Refresh Token Method
  refreshAccessToken(): Observable<TokenData> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => 'No refresh token available');
    }

    if (this.refreshInProgress) {
      return new Observable(observer => {
        const checkInterval = setInterval(() => {
          if (!this.refreshInProgress) {
            clearInterval(checkInterval);
            const newToken = this.getToken();
            if (newToken) {
              observer.next({
                access_token: newToken,
                refresh_token: this.getRefreshToken()!
              });
              observer.complete();
            } else {
              observer.error('Token refresh failed');
            }
          }
        }, 100);
      });
    }

    this.refreshInProgress = true;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const body = { refresh_token: refreshToken };

    return this.http.post<any>(`${this.apiUrl}/auth/refresh`, body, { headers })
      .pipe(
        tap((response: any) => {
          if (response.access_token) {
            const tokenData: TokenData = {
              access_token: response.access_token,
              refresh_token: response.refresh_token || refreshToken,
              expires_at: response.expires_at
            };
            
            this.setTokens(tokenData);
            this.warningSubject.next(false);
            console.log('Token refreshed successfully');
          } else {
            throw new Error('Invalid refresh response');
          }
          
          this.refreshInProgress = false;
        }),
        catchError((error) => {
          console.error('Token refresh failed:', error);
          this.refreshInProgress = false;
          this.clearTokensAndRedirect();
          return throwError(() => 'Token refresh failed');
        })
      );
  }

  // ✅ Auto Token Check
  private initTokenCheck(): void {
    setInterval(() => {
      const token = this.getToken();
      
      if (!token) return;

      if (this.isTokenExpired()) {
        console.log('Token expired, attempting refresh...');
        this.refreshAccessToken().subscribe({
          next: () => console.log('Auto refresh successful'),
          error: (error) => console.error('Auto refresh failed:', error)
        });
      } else if (this.isTokenExpiring() && !this.warningSubject.value) {
        console.log('Token expiring soon, showing warning');
        this.warningSubject.next(true);
        
        // Auto refresh เมื่อใกล้หมดอายุ
        this.refreshAccessToken().subscribe({
          next: () => console.log('Proactive refresh successful'),
          error: (error) => console.error('Proactive refresh failed:', error)
        });
      }
    }, 30000); // ตรวจสอบทุก 30 วินาที
  }

  clearTokensAndRedirect(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('user');
    localStorage.removeItem('remember_me');
    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    this.warningSubject.next(false);
    this.refreshInProgress = false;
    
    console.log('Tokens cleared, redirecting to login');
    this.router.navigate(['/login']);
  }

  // ✅ ปรับปรุง login method
  async login(username: string, password: string, language: string = 'th'): Promise<LoginResponse> {
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'language': language
      });

      const body: LoginRequest = {
        username,
        password
      };

      console.log('🔄 Login API call:', { username, apiUrl: this.apiUrl });

      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, body, { headers })
          .pipe(catchError(this.handleError))
      );

      console.log('📥 Login API response:', response);

      // ✅ รองรับ response format หลายแบบ
      const isSuccess = response.code === '2' || 
                       response.code === 2 || 
                       response.status === true || 
                       response.status === 1 ||
                       (response.message && response.message.toLowerCase().includes('success'));

      if (isSuccess) {
        // ✅ ดึง token และ user data จาก response
        let accessToken = '';
        let refreshToken = '';
        let userData = null;

        if (response.data) {
          accessToken = response.data.access_token || '';
          refreshToken = response.data.refresh_token || '';
          userData = response.data.user;
        } else {
          // รองรับ format เก่า
          accessToken = response.access_token || '';
          refreshToken = response.refresh_token || '';
          userData = response.user;
        }

        console.log('🔑 Extracted tokens:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasUserData: !!userData
        });

        if (accessToken && userData) {
          // ✅ บันทึก tokens และ user data
          this.setTokens({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          // ✅ บันทึก user data
          localStorage.setItem('user', JSON.stringify(userData));
          this.currentUserSubject.next(userData);

          console.log('✅ Login data saved successfully');
          console.log('👤 User data:', userData);
        } else {
          console.error('❌ Missing token or user data in response');
          throw new Error('Invalid login response: missing required data');
        }
      }

      return response;
    } catch (error: any) {
      console.error('❌ Login catch error:', error);
      if (error.error?.message) {
        throw new Error(error.error.message);
      }
      throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  }

  // ✅ Logout method (updated)
  logout(): void {
    const refreshToken = this.getRefreshToken();
    
    if (refreshToken) {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      });

      // เรียก logout API
      this.http.post(`${this.apiUrl}/auth/logout`, 
        { refresh_token: refreshToken }, 
        { headers }
      ).subscribe({
        next: () => console.log('Logout API successful'),
        error: (error) => console.error('Logout API failed:', error),
        complete: () => this.clearTokensAndRedirect()
      });
    } else {
      this.clearTokensAndRedirect();
    }
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, userData)
      .pipe(catchError(this.handleError));
  }

  isLoggedIn(): boolean {
    return this.hasValidToken();
  }

  // ✅ ปรับปรุง isAuthenticated method
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    
    console.log('🔍 Checking authentication:');
    console.log('- Token exists:', !!token);
    console.log('- User exists:', !!user);
    console.log('- Token expired:', token ? this.isTokenExpired() : 'No token');
    
    // ✅ ตรวจสอบแบบง่าย: มี token และ user และ token ยังไม่หมดอายุ
    const isAuth = !!(token && user && !this.isTokenExpired());
    console.log('- Is authenticated:', isAuth);
    
    return isAuth;
  }

  // ✅ ปรับปรุง getCurrentUser method
  getCurrentUser(): any {
    if (this.currentUserSubject.value) {
      return this.currentUserSubject.value;
    }

    // ลองดึงจาก localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        this.currentUserSubject.next(userData);
        return userData;
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
        localStorage.removeItem('user');
      }
    }

    return null;
  }

  setAuthData(token: string, userData: any): void {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    this.currentUserSubject.next(userData);
    this.tokenSubject.next(token);
  }

  // ✅ Observable Methods
  getWarningStatus(): Observable<boolean> {
    return this.warningSubject.asObservable();
  }

  getTokenChanges(): Observable<string | null> {
    return this.tokenSubject.asObservable();
  }

  // ✅ Manual refresh สำหรับ UI
  manualRefresh(): Observable<TokenData> {
    return this.refreshAccessToken();
  }

  // ✅ Debug method สำหรับตรวจสอบสถานะ authentication
  debugAuthStatus(): void {
    console.group('🔍 Authentication Debug Info');
    
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();
    const user = this.getCurrentUser();
    
    console.log('📋 Basic Info:');
    console.log('- Token exists:', !!token);
    console.log('- Refresh token exists:', !!refreshToken);
    console.log('- User data exists:', !!user);
    
    if (token) {
      console.log('🔑 Token Info:');
      console.log('- Token length:', token.length);
      console.log('- Token preview:', token.substring(0, 50) + '...');
      console.log('- Is expired:', this.isTokenExpired());
      console.log('- Is expiring soon:', this.isTokenExpiring());
      
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('- Token payload:', {
          user_id: payload.sub || payload.user_id,
          username: payload.username,
          expires_at: new Date(payload.exp * 1000).toISOString(),
          issued_at: new Date(payload.iat * 1000).toISOString()
        });
      } catch (error) {
        console.error('- Cannot decode token:', error);
      }
    }
    
    if (user) {
      console.log('👤 User Info:');
      console.log('- User ID:', user.id);
      console.log('- Username:', user.username);
      console.log('- Full name:', `${user.firstname} ${user.lastname}`);
      console.log('- Email:', user.email);
    }
    
    console.log('🔐 Auth Methods:');
    console.log('- isAuthenticated():', this.isAuthenticated());
    console.log('- hasValidToken():', this.hasValidToken());
    console.log('- isLoggedIn():', this.isLoggedIn());
    
    console.log('💾 LocalStorage:');
    console.log('- access_token:', !!localStorage.getItem('access_token'));
    console.log('- refresh_token:', !!localStorage.getItem('refresh_token'));
    console.log('- user:', !!localStorage.getItem('user'));
    console.log('- remember_me:', localStorage.getItem('remember_me'));
    
    console.groupEnd();
  }

  // ✅ Debug method
  getTokenInfo(): any {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp - currentTime;
      
      return {
        user_id: payload.sub || payload.user_id,
        username: payload.username,
        expires_at: new Date(payload.exp * 1000).toISOString(),
        time_left_seconds: timeLeft,
        time_left_minutes: Math.floor(timeLeft / 60),
        is_expired: timeLeft <= 0,
        is_expiring: timeLeft <= 300
      };
    } catch (error) {
      return null;
    }
  }
}