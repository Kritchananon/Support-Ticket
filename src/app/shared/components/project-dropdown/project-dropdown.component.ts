import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProjectService } from '../../services/project.service';
import { ProjectDDL } from '../../models/project.model';

@Component({
  selector: 'app-project-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-dropdown.component.html',
  styleUrls: ['./project-dropdown.component.css']
})
export class ProjectDropdownComponent implements OnInit, OnDestroy {
  private projectService = inject(ProjectService);
  
  @Input() label: string = 'เลือกโปรเจค';
  @Input() placeholder: string = '-- เลือกโปรเจค --';
  @Input() selectedProjectId: number | string = '';
  @Input() status: string = 'active';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCode: boolean = false; // เปลี่ยนจาก true เป็น false
  @Input() showRefreshButton: boolean = true;
  @Input() errorText: string = '';
  
  @Output() selectionChange = new EventEmitter<{
    project: ProjectDDL | null, 
    projectId: number | string
  }>();

  projects: ProjectDDL[] = [];
  loading = false;
  error: string = '';
  hasError = false;
  
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProjects(): void {
    this.loading = true;
    this.error = '';
    this.hasError = false;

    this.projectService.getProjectDDL({ status: this.status })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Project DDL Response:', response);
          if (response.code === 1) {
            this.projects = response.data;
            this.error = '';
          } else {
            this.error = response.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
            this.projects = [];
          }
          this.loading = false;
        },
        error: (err) => {
          this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
          this.projects = [];
          this.loading = false;
          console.error('Error loading projects:', err);
        }
      });
  }

  onSelectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const projectId = target.value;
    let selectedProject: ProjectDDL | null = null;
    
    if (projectId) {
      selectedProject = this.projects.find(p => p.id === +projectId) || null;
    }

    // Reset validation error when user selects something
    if (projectId && this.hasError) {
      this.hasError = false;
    }

    this.selectedProjectId = projectId;
    this.selectionChange.emit({
      project: selectedProject,
      projectId: projectId
    });
  }

  refresh(): void {
    this.loadProjects();
  }

  // Method สำหรับ validation จากภายนอก
  validate(): boolean {
    if (this.required && !this.selectedProjectId) {
      this.hasError = true;
      return false;
    }
    this.hasError = false;
    return true;
  }

  getProjectDisplayName(project: any): string {
    // รองรับทั้ง format จาก API ใหม่ (projectName) และ API เก่า (name)
    return project.projectName || project.name || 'Unknown Project';
  }

  // Method สำหรับ reset
  reset(): void {
    this.selectedProjectId = '';
    this.hasError = false;
    this.selectionChange.emit({
      project: null,
      projectId: ''
    });
  }
}
