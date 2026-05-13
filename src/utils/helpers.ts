import { Request, Response, NextFunction } from 'express';

// 异步处理器包装
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// API响应统一格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 成功响应
export function successResponse<T>(res: Response, data?: T, message?: string) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return res.json(response);
}

// 分页响应
export function paginatedResponse<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  const response: PaginatedResponse<T[]> = {
    success: true,
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
  return res.json(response);
}

// 错误响应
export function errorResponse(
  res: Response,
  statusCode: number = 500,
  message?: string,
  error?: string
) {
  const response: ApiResponse = {
    success: false,
    message,
    error,
  };
  return res.status(statusCode).json(response);
}

// 分页参数解析
export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
}

export function parsePaginationParams(query: Request['query']): PaginationParams {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string) || 20));
  const skip = (page - 1) * pageSize;
  
  return { page, pageSize, skip };
}

// 生成唯一ID
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
}

// 格式化日期
export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// 格式化浏览量显示
export function formatViews(views: number): string {
  if (views < 1000) return views.toString();
  if (views < 1000000) return `${(views / 1000).toFixed(1)}k`;
  if (views < 1000000000) return `${(views / 1000000).toFixed(1)}m`;
  return '99m+';
}
