import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Auth Guard checking authentication...');
  console.log('Token exists:', !!localStorage.getItem('access_token'));
  console.log('AuthService isAuthenticated:', authService.isAuthenticated());

  if (authService.isAuthenticated()) {
    console.log('Authentication successful, allowing access');
    return true;
  } else {
    console.log('Authentication failed, redirecting to login');
    router.navigate(['/login']);
    return false;
  }
};