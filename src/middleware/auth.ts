import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/helpers';

// JWT Payload类型
export interface JwtPayload {
  userId: string;
  email: string;
  username?: string;
  role: string;
}

// 扩展Request类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// 验证Token中间件
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, '未提供认证令牌');
    }

    const token = authHeader.substring(7);
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return errorResponse(res, 401, '令牌已过期');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return errorResponse(res, 401, '无效的令牌');
    }
    return errorResponse(res, 401, '认证失败');
  }
}

// 角色验证中间件
export function roleMiddleware(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 401, '未登录');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 403, '权限不足');
    }

    next();
  };
}
