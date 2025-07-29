import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginData = {
    username: '',
    password: '',
    rememberMe: false
  };

  isLoading = false;
  errorMessage = '';
  showPassword = false;
  currentLanguage = 'th';
  returnUrl = '/dashboard'; // ✅ Default return URL

  ngOnInit(): void {
    // ✅ ดึง returnUrl จาก query parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    
    // ✅ ถ้า login แล้วให้ redirect ไปหน้าที่ต้องการ
    if (this.authService.isAuthenticated()) {
      console.log('✅ Already authenticated, redirecting to:', this.returnUrl);
      this.router.navigate([this.returnUrl]);
    }
  }

  async onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.errorMessage = this.currentLanguage === 'th' 
        ? 'กรุณากรอกข้อมูลให้ครบถ้วน' 
        : 'Please fill in all required fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('🔄 Attempting login...');
      
      const response = await this.authService.login(
        this.loginData.username,
        this.loginData.password,
        this.currentLanguage
      );

      console.log('📥 Login response:', response);

      // ✅ ตรวจสอบ response แบบละเอียด
      const isSuccess = response.code === '2' || 
                       response.code === 2 || 
                       response.status === true || 
                       response.status === 1 ||
                       (response.message && response.message.toLowerCase().includes('success'));

      if (isSuccess) {
        // ✅ Save remember me preference
        if (this.loginData.rememberMe) {
          localStorage.setItem('remember_me', 'true');
        }

        console.log('✅ Login successful!');
        
        // ✅ รอให้ token save เสร็จก่อน navigate
        setTimeout(async () => {
          console.log('🚀 Navigating to:', this.returnUrl);
          console.log('🔑 Token after login:', !!this.authService.getToken());
          console.log('👤 Current user:', this.authService.getCurrentUser());
          
          try {
            const navigationResult = await this.router.navigate([this.returnUrl]);
            console.log('✅ Navigation result:', navigationResult);
            
            if (!navigationResult) {
              console.error('❌ Navigation failed, trying dashboard...');
              await this.router.navigate(['/dashboard']);
            }
          } catch (navError) {
            console.error('❌ Navigation error:', navError);
            // ลองใช้ window.location เป็น fallback
            window.location.href = '/dashboard';
          }
        }, 100);
        
      } else {
        this.errorMessage = response.message || 
          (this.currentLanguage === 'th' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Login failed');
        console.error('❌ Login failed:', this.errorMessage);
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      this.errorMessage = error.message || 
        (this.currentLanguage === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' : 'An error occurred. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  switchLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  getLanguageText(thText: string, enText: string): string {
    return this.currentLanguage === 'th' ? thText : enText;
  }
}