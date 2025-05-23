export interface ApiResponse<T> {
  code: number;
  status: boolean;
  message: string;
  data: T;
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}
