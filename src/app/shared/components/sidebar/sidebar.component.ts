import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  private router = inject(Router);
  
  // State for dropdown menus
  isReportDropdownOpen = false;
  isSettingDropdownOpen = false;

  /**
   * Toggle Report dropdown menu
   */
  toggleReportDropdown() {
    console.log('Toggling Report dropdown:', this.isReportDropdownOpen); // Debug log
    this.isReportDropdownOpen = !this.isReportDropdownOpen;
    // Close other dropdowns
    if (this.isReportDropdownOpen) {
      this.isSettingDropdownOpen = false;
    }
  }

  /**
   * Toggle Setting dropdown menu
   */
  toggleSettingDropdown() {
    console.log('Toggling Setting dropdown:', this.isSettingDropdownOpen); // Debug log
    this.isSettingDropdownOpen = !this.isSettingDropdownOpen;
    // Close other dropdowns
    if (this.isSettingDropdownOpen) {
      this.isReportDropdownOpen = false;
    }
  }

  /**
   * Close all dropdowns
   */
  closeAllDropdowns() {
    console.log('Closing all dropdowns'); // Debug log
    this.isReportDropdownOpen = false;
    this.isSettingDropdownOpen = false;
  }

  /**
   * Handle navigation and close dropdowns
   */
  navigateTo(route: string) {
    this.router.navigate([route]);
    this.closeAllDropdowns();
  }

  /**
   * Handle menu item click (prevents event bubbling)
   */
  onMenuItemClick(event: Event) {
    event.stopPropagation();
  }
}