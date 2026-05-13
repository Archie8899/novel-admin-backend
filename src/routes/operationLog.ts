import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取登录日志列表
router.get('/login', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { username, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const where: any = {};
  
  if (username) where.username = { contains: username as string };
  if (status && status !== 'all') where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [logs, total] = await Promise.all([
    prisma.loginLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.loginLog.count({ where }),
  ]);

  const data = logs.map(log => ({
    id: log.id,
    userId: log.userId,
    username: log.username,
    user: log.user,
    ip: log.ip,
    userAgent: log.userAgent,
    status: log.status,
    statusDisplay: log.status === 'success' ? '成功' : '失败',
    message: log.message,
    createdAt: log.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取操作日志列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { username, module, action, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const where: any = {};
  
  if (username) where.username = { contains: username as string };
  if (module) where.module = { contains: module as string };
  if (action) where.action = { contains: action as string };
  if (status && status !== 'all') where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }

  const [logs, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.operationLog.count({ where }),
  ]);

  const data = logs.map(log => ({
    id: log.id,
    userId: log.userId,
    username: log.username,
    user: log.user,
    module: log.module,
    action: log.action,
    method: log.method,
    url: log.url,
    params: log.params,
    ip: log.ip,
    userAgent: log.userAgent,
    status: log.status,
    statusDisplay: log.status === 'success' ? '成功' : '失败',
    errorMsg: log.errorMsg,
    createdAt: log.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个操作日志
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const log = await prisma.operationLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });

  if (!log) {
    return res.status(404).json({ success: false, message: '日志不存在' });
  }

  return successResponse(res, {
    id: log.id,
    userId: log.userId,
    username: log.username,
    user: log.user,
    module: log.module,
    action: log.action,
    method: log.method,
    url: log.url,
    params: log.params,
    ip: log.ip,
    userAgent: log.userAgent,
    status: log.status,
    errorMsg: log.errorMsg,
    createdAt: log.createdAt,
  });
}));

export default router;
