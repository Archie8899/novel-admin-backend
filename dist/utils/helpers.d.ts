import { Request, Response, NextFunction } from 'express';
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
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
export declare function successResponse<T>(res: Response, data?: T, message?: string): Response<any, Record<string, any>>;
export declare function paginatedResponse<T>(res: Response, data: T[], total: number, page: number, pageSize: number): Response<any, Record<string, any>>;
export declare function errorResponse(res: Response, statusCode?: number, message?: string, error?: string): Response<any, Record<string, any>>;
export interface PaginationParams {
    page: number;
    pageSize: number;
    skip: number;
}
export declare function parsePaginationParams(query: Request['query']): PaginationParams;
export declare function generateId(prefix?: string): string;
export declare function formatDateTime(date: Date): string;
export declare function formatViews(views: number): string;
//# sourceMappingURL=helpers.d.ts.map