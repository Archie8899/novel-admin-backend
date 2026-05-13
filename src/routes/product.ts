import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取商品列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, price, os, type, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (price) {
    where.price = parseInt(price as string);
  }
  
  if (os && os !== 'all') {
    where.os = os;
  }
  
  if (type && type !== 'all') {
    where.type = type;
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

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { name: true, email: true }
        }
      }
    }),
    prisma.product.count({ where }),
  ]);

  // 格式化返回数据
  const data = products.map(product => ({
    id: product.id,
    productId: product.productId,
    name: product.name,
    os: product.os,
    type: product.type,
    typeDisplay: product.type === 'recharge' ? '充值' : '订阅',
    durationOrCoins: product.type === 'recharge' 
      ? `${product.coins}金币` 
      : formatDuration(product.subscriptionDuration),
    price: `$${(product.price / 100).toFixed(2)}`,
    priceRaw: product.price,
    status: product.status,
    statusDisplay: product.status === 'active' ? '有效' : '无效',
    createdBy: product.createdByUser?.name || product.createdByUser?.email || '-',
    createdAt: product.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取有效商品列表（用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { os, type } = req.query;
  
  const where: any = { status: 'active' };
  
  if (os && os !== 'all') {
    where.os = os;
  }
  
  if (type) {
    where.type = type;
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      productId: true,
      name: true,
      os: true,
      type: true,
      price: true,
      coins: true,
      subscriptionDuration: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(res, products);
}));

// 获取单个商品
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!product) {
    return errorResponse(res, 404, '商品不存在');
  }

  return successResponse(res, {
    ...product,
    priceDisplay: `$${(product.price / 100).toFixed(2)}`,
  });
}));

// 新建商品
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    type = 'recharge',
    os = 'H5',
    price,
    coins,
    subscriptionDuration,
    productId: productIdExternal,
    status = 'active'
  } = req.body;

  // 验证必填字段
  if (!name || !price) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 校验长度
  if (name.length > 40) {
    return errorResponse(res, 400, '商品名称长度不能超过40字符');
  }

  // 校验价格（分）
  const priceInCents = Math.round(parseFloat(price) * 100);
  if (isNaN(priceInCents) || priceInCents < 1 || priceInCents > 999900) {
    return errorResponse(res, 400, '商品价格必须在$0.01-$9999之间');
  }

  // 校验类型特定字段
  if (type === 'recharge') {
    if (!coins || coins < 1 || coins > 9999) {
      return errorResponse(res, 400, '金币数量必须在1-9999之间');
    }
  } else {
    if (!subscriptionDuration) {
      return errorResponse(res, 400, '订阅时长为必填项');
    }
  }

  // 校验iOS/Android时的商品ID
  if ((os === 'iOS' || os === 'Android') && !productIdExternal) {
    return errorResponse(res, 400, `${os}平台需要提供商品ID`);
  }

  // 生成唯一编号
  const count = await prisma.product.count();
  const productId = `PRD${String(count + 1).padStart(6, '0')}`;

  const product = await prisma.product.create({
    data: {
      productId,
      name,
      type,
      os,
      price: priceInCents,
      coins: type === 'recharge' ? parseInt(coins) : null,
      subscriptionDuration: type === 'subscription' ? subscriptionDuration : null,
      productIdExternal,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: product.id,
    productId: product.productId,
    name: product.name,
    type: product.type,
    price: `$${(product.price / 100).toFixed(2)}`,
  }, '创建成功');
}));

// 编辑商品
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updateData = req.body;

  const existingProduct = await prisma.product.findUnique({ where: { id } });

  if (!existingProduct) {
    return errorResponse(res, 404, '商品不存在');
  }

  // 校验长度
  if (updateData.name && updateData.name.length > 40) {
    return errorResponse(res, 400, '商品名称长度不能超过40字符');
  }

  // 校验价格
  let newPrice = existingProduct.price;
  if (updateData.price !== undefined) {
    newPrice = Math.round(parseFloat(updateData.price) * 100);
    if (isNaN(newPrice) || newPrice < 1 || newPrice > 999900) {
      return errorResponse(res, 400, '商品价格必须在$0.01-$9999之间');
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: updateData.name || existingProduct.name,
      type: updateData.type || existingProduct.type,
      os: updateData.os || existingProduct.os,
      price: newPrice,
      coins: updateData.type === 'recharge' 
        ? (updateData.coins ? parseInt(updateData.coins) : existingProduct.coins)
        : null,
      subscriptionDuration: updateData.type === 'subscription'
        ? (updateData.subscriptionDuration || existingProduct.subscriptionDuration)
        : null,
      productIdExternal: updateData.productId !== undefined 
        ? updateData.productId 
        : existingProduct.productIdExternal,
      status: updateData.status || existingProduct.status,
    },
  });

  return successResponse(res, {
    id: product.id,
    productId: product.productId,
    name: product.name,
    price: `$${(product.price / 100).toFixed(2)}`,
  }, '更新成功');
}));

// 删除商品
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingProduct = await prisma.product.findUnique({ where: { id } });

  if (!existingProduct) {
    return errorResponse(res, 404, '商品不存在');
  }

  // 检查是否有关联的支付墙商品配置
  const configCount = await prisma.paymentWallProduct.count({
    where: { productId: id }
  });

  if (configCount > 0) {
    return errorResponse(res, 400, `该商品已在${configCount}个支付墙中配置，无法删除`);
  }

  await prisma.product.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 辅助函数：格式化订阅时长
function formatDuration(duration: string | null): string {
  if (!duration) return '-';
  
  const durationMap: Record<string, string> = {
    '1week': '1周',
    '1month': '1个月',
    '3months': '3个月',
    '6months': '6个月',
    '12months': '12个月',
  };
  
  return durationMap[duration] || duration;
}

export default router;
