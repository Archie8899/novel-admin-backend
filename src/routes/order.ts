import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取订单列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { orderId, userId, productName, productType, promoCode, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (orderId) {
    where.orderId = orderId;
  }
  
  if (userId) {
    where.userId = userId;
  }
  
  if (productName) {
    where.productName = { contains: productName as string };
  }
  
  if (productType && productType !== 'all') {
    where.productType = productType;
  }
  
  if (promoCode) {
    where.promoCode = promoCode;
  }
  
  if (status && status !== 'all') {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  // 格式化返回数据
  const data = orders.map(order => ({
    id: order.id,
    orderId: order.orderId,
    storeOrderId: order.storeOrderId || '-',
    userId: order.userId,
    productType: order.productType,
    productTypeDisplay: order.productType === 'recharge' ? '充值' : '订阅',
    productName: order.productName,
    productPrice: `$${(order.productPrice / 100).toFixed(2)}`,
    paymentMethod: order.paymentMethod || '-',
    status: order.status,
    statusDisplay: formatOrderStatus(order.status),
    promoCode: order.promoCode || '-',
    createdAt: order.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个订单
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: { userId: true, email: true, os: true }
      }
    }
  });

  if (!order) {
    return errorResponse(res, 404, '订单不存在');
  }

  return successResponse(res, {
    ...order,
    productPriceDisplay: `$${(order.productPrice / 100).toFixed(2)}`,
    statusDisplay: formatOrderStatus(order.status),
  });
}));

// 导出订单
router.get('/export/data', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { orderId, userId, productType, status, startDate, endDate } = req.query;

  // 构建查询条件
  const where: any = {};
  
  if (orderId) {
    where.orderId = orderId;
  }
  
  if (userId) {
    where.userId = userId;
  }
  
  if (productType) {
    where.productType = productType;
  }
  
  if (status) {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: {
        select: { userId: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  // 转换为导出格式
  const exportData = orders.map(order => ({
    orderId: order.orderId,
    storeOrderId: order.storeOrderId || '',
    userId: order.userId,
    userEmail: order.user?.email || '',
    productType: order.productType === 'recharge' ? '充值' : '订阅',
    productName: order.productName,
    productPrice: `$${(order.productPrice / 100).toFixed(2)}`,
    paymentMethod: order.paymentMethod || '',
    status: formatOrderStatus(order.status),
    promoCode: order.promoCode || '',
    createdAt: order.createdAt.toISOString(),
  }));

  return successResponse(res, exportData, `共${exportData.length}条数据`);
}));

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
