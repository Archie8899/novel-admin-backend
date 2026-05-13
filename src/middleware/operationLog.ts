import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

// 操作日志白名单（不记录日志的路径）
const WHITELIST_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/facebook',
  '/api/auth/facebook/callback',
];

// 需要记录日志的HTTP方法
const LOG_METHODS = ['POST', 'PUT', 'DELETE'];

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

export const createOperationLog = async (logData: OperationLogData) => {
  try {
    await prisma.operationLog.create({
      data: {
        userId: logData.userId,
        username: logData.username,
        module: logData.module,
        action: logData.action,
        method: logData.method,
        url: logData.url,
        params: logData.params,
        ip: logData.ip,
        userAgent: logData.userAgent,
        status: logData.status || 'success',
        errorMsg: logData.errorMsg,
      },
    });
  } catch (error) {
    console.error('Failed to create operation log:', error);
  }
};

// 获取客户端IP
export const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket?.remoteAddress ||
    '';
};

// 获取模块名称
export const getModuleName = (url: string): { module: string; action: string } => {
  const path = url.replace('/api/', '');
  const parts = path.split('/');
  
  // 移除ID等参数部分
  const cleanParts = parts.filter(p => !p.match(/^[a-f0-9]{24}$|^\w{4,}$/i));
  
  let module = cleanParts[0] || '';
  let action = cleanParts[1] || '';
  
  // 格式化模块名称
  const moduleMap: Record<string, string> = {
    'categories': '分类管理',
    'copyright-companies': '版权方管理',
    'novels': '小说管理',
    'chapters': '章节管理',
    'products': '商品管理',
    'payment-walls': '支付墙管理',
    'landing-pages': '落地页管理',
    'promo-codes': '优惠码管理',
    'channels': '渠道管理',
    'orders': '订单管理',
    'app-users': 'App用户管理',
    'user-segments': '用户分层管理',
    'pricing-tiers': '定价层级管理',
    'admin-users': '管理员用户管理',
    'roles': '角色管理',
    'departments': '部门管理',
    'menus': '菜单管理',
    'operation-logs': '操作日志管理',
    'login-logs': '登录日志管理',
  };
  
  // 格式化动作名称
  const actionMap: Record<string, string> = {
    'POST': '创建',
    'PUT': '更新',
    'DELETE': '删除',
    'create': '创建',
    'update': '更新',
    'delete': '删除',
  };
  
  return {
    module: moduleMap[module] || module,
    action: actionMap[action] || action,
  };
};

// 操作日志中间件
export const operationLogMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 只记录指定的HTTP方法
  if (!LOG_METHODS.includes(req.method)) {
    return next();
  }
  
  // 检查白名单
  if (WHITELIST_PATHS.some(p => req.path.includes(p))) {
    return next();
  }
  
  // @ts-ignore
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // 如果有用户信息且请求成功，记录日志
    const user = (req as any).user;
    if (user && body && body.success !== false) {
      const { module, action } = getModuleName(req.path);
      createOperationLog({
        userId: user.userId,
        username: user.username || user.email || user.userId,
        module,
        action,
        method: req.method,
        url: req.originalUrl,
        params: ['POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body).substring(0, 1000) : undefined,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: 'success',
        errorMsg: body.message,
      }).catch(err => console.error('Failed to create operation log:', err));
    }
    
    return originalJson(body);
  };
  
  next();
};

// 登录日志记录
export const createLoginLog = async (data: {
  userId: string;
  username: string;
  ip?: string;
  userAgent?: string;
  status: string;
  message?: string;
}) => {
  try {
    await prisma.loginLog.create({
      data: {
        userId: data.userId,
        username: data.username,
        ip: data.ip,
        userAgent: data.userAgent,
        status: data.status,
        message: data.message,
      },
    });
  } catch (error) {
    console.error('Failed to create login log:', error);
  }
};
