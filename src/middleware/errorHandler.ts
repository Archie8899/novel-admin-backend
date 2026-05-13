import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/helpers';

// 自定义错误类型
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 异步处理器包装
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 全局错误处理中间件
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return errorResponse(res, err.statusCode, err.message);
  }

  // Prisma错误处理
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    
    // 唯一约束错误
    if (prismaErr.code === 'P2002') {
      return errorResponse(res, 400, '该记录已存在，请勿重复创建');
    }
    
    // 外键约束错误
    if (prismaErr.code === 'P2003') {
      return errorResponse(res, 400, '关联数据不存在');
    }
    
    // 记录未找到
    if (prismaErr.code === 'P2025') {
      return errorResponse(res, 404, '记录未找到');
    }
  }

  // 未知错误
  return errorResponse(
    res,
    500,
    process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message
  );
}

// 404处理
export function notFoundHandler(req: Request, res: Response) {
  return errorResponse(res, 404, `路由 ${req.method} ${req.path} 不存在`);
}
