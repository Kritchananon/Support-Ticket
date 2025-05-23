export interface User {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  code: string;
  message: string;
  data: {
    access_token: string;
    user: User;
  };
}
