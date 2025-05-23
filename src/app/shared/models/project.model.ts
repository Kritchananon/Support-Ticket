export interface Project {
  id: number;
  name: string;
  create_by: number;
  isenabled: boolean;
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
