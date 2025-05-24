export interface Project {
  id: number;
  name: string; // เปลี่ยนจา projectName เป็น name ให้ตรงกับ API เดิม
  create_by?: number;
  isenabled?: boolean;
}

// เพิ่ม interface สำหรับ API ใหม่
export interface ProjectDDL {
  id: number;
  projectName: string;
  projectCode: string;
}

export interface ProjectDDLRequest {
  status?: string;
}

export interface ProjectDDLResponse {
  code: number;
  message: string;
  data: ProjectDDL[];
}

export interface Customer {
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
