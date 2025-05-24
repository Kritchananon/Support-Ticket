export interface Category {
  id: number;
  name: string;
  create_by?: number;
  isenabled?: boolean;
}

// เพิ่ม interface สำหรับ API ใหม่
export interface CategoryDDL {
  id: number;
  categoryName: string;
  categoryCode?: string;
}

export interface CategoryDDLRequest {
  status?: string;
}

export interface CategoryDDLResponse {
  code: number;
  message: string;
  data: CategoryDDL[];
}
