import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number);
}
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
export declare function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>>;
export declare function notFoundHandler(req: Request, res: Response): Response<any, Record<string, any>>;
//# sourceMappingURL=errorHandler.d.ts.map