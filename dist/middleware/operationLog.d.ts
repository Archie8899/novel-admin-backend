import { Request, Response, NextFunction } from 'express';
export interface OperationLogData {
    userId: string;
    username: string;
    module: string;
    action: string;
    method: string;
    url: string;
    params?: string;
    ip?: string;
    userAgent?: string;
    status?: string;
    errorMsg?: string;
}
export declare const createOperationLog: (logData: OperationLogData) => Promise<void>;
export declare const getClientIp: (req: Request) => string;
export declare const getModuleName: (url: string) => {
    module: string;
    action: string;
};
export declare const operationLogMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const createLoginLog: (data: {
    userId: string;
    username: string;
    ip?: string;
    userAgent?: string;
    status: string;
    message?: string;
}) => Promise<void>;
//# sourceMappingURL=operationLog.d.ts.map