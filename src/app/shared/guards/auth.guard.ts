import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔐 Auth Guard checking authentication...');
  console.log('Current route:', state.url);
  console.log('Token exists:', !!authService.getToken());
  console.log('Is authenticated:', authService.isAuthenticated());

  // ✅ ตรวจสอบการ authenticate แบบง่าย
  if (authService.isAuthenticated()) {
    console.log('✅ Authentication successful, allowing access to:', state.url);
    return true;
  }

  // ❌ ไม่ authenticated - redirect ไป login
  console.log('❌ Not authenticated, redirecting to login');
  router.navigate(['/login'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};