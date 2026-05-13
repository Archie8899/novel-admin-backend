import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取用户列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { userId, email, os, isSubscribed, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (userId) {
    where.userId = userId;
  }
  
  if (email) {
    where.email = email;
  }
  
  if (os && os !== 'all') {
    where.os = os;
  }
  
  if (isSubscribed && isSubscribed !== 'all') {
    where.isSubscribed = isSubscribed === 'true';
  }
  
  if (status && status !== 'all') {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.registeredAt = {};
    if (startDate) {
      where.registeredAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.registeredAt.lte = new Date(endDate as string);
    }
  }

  const [users, total] = await Promise.all([
    prisma.appUser.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.appUser.count({ where }),
  ]);

  // 格式化返回数据
  const data = users.map(user => ({
    id: user.id,
    userId: user.userId,
    email: user.email || '-',
    os: user.os || '-',
    osDisplay: formatOS(user.os),
    coins: user.coins,
    isSubscribed: user.isSubscribed,
    isSubscribedDisplay: user.isSubscribed ? '已订阅' : '未订阅',
    status: user.status,
    statusDisplay: user.status === 'active' ? '正常' : '注销',
    registeredAt: user.registeredAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个用户详情
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const user = await prisma.appUser.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      }
    }
  });

  if (!user) {
    return errorResponse(res, 404, '用户不存在');
  }

  return successResponse(res, {
    ...user,
    osDisplay: formatOS(user.os),
    isSubscribedDisplay: user.isSubscribed ? '已订阅' : '未订阅',
    statusDisplay: user.status === 'active' ? '正常' : '注销',
    orderCount: user.orders.length,
  });
}));

// 获取用户订单
router.get('/:id/orders', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const user = await prisma.appUser.findUnique({
    where: { id }
  });

  if (!user) {
    return errorResponse(res, 404, '用户不存在');
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where: { userId: user.userId } }),
  ]);

  const data = orders.map(order => ({
    orderId: order.orderId,
    productName: order.productName,
    productPrice: `$${(order.productPrice / 100).toFixed(2)}`,
    status: formatOrderStatus(order.status),
    createdAt: order.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 导出用户数据
router.get('/export/data', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { os, isSubscribed, status, startDate, endDate } = req.query;

  // 构建查询条件
  const where: any = {};
  
  if (os) {
    where.os = os;
  }
  
  if (isSubscribed) {
    where.isSubscribed = isSubscribed === 'true';
  }
  
  if (status) {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.registeredAt = {};
    if (startDate) {
      where.registeredAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.registeredAt.lte = new Date(endDate as string);
    }
  }

  const users = await prisma.appUser.findMany({
    where,
    orderBy: { registeredAt: 'desc' },
  });

  // 转换为导出格式
  const exportData = users.map(user => ({
    userId: user.userId,
    email: user.email || '',
    os: formatOS(user.os),
    coins: user.coins,
    isSubscribed: user.isSubscribed ? '是' : '否',
    status: user.status === 'active' ? '正常' : '注销',
    registeredAt: user.registeredAt.toISOString(),
  }));

  return successResponse(res, exportData, `共${exportData.length}条数据`);
}));

// 辅助函数：格式化操作系统显示
function formatOS(os: string | null): string {
  if (!os) return '-';
  const osMap: Record<string, string> = {
    'H5': 'H5',
    'iOS': 'iOS',
    'Android': 'Android',
  };
  return osMap[os] || os;
}

// 辅助函数：格式化订单状态
function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待支付',
    'paid': '已支付',
    'failed': '支付失败',
    'closed': '支付关闭',
  };
  return statusMap[status] || status;
}

export default router;
