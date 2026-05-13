import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取支付墙列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, userSegmentName, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (userSegmentName) {
    where.userSegment = { name: { contains: userSegmentName as string } };
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

  const [paymentWalls, total] = await Promise.all([
    prisma.paymentWall.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { sort: 'asc' }, // 按排序正序
        { createdAt: 'desc' } // 相同则按创建时间倒序
      ],
      include: {
        userSegment: {
          select: { segmentId: true, name: true }
        },
        createdByUser: {
          select: { name: true, email: true }
        },
        _count: {
          select: { products: true }
        }
      }
    }),
    prisma.paymentWall.count({ where }),
  ]);

  // 格式化返回数据
  const data = paymentWalls.map(pw => ({
    id: pw.id,
    paymentWallId: pw.paymentWallId,
    name: pw.name,
    userSegment: pw.userSegment,
    sort: pw.sort,
    status: pw.status,
    statusDisplay: pw.status === 'active' ? '有效' : '无效',
    productCount: pw._count.products,
    createdBy: pw.createdByUser?.name || pw.createdByUser?.email || '-',
    createdAt: pw.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个支付墙详情
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const paymentWall = await prisma.paymentWall.findUnique({
    where: { id },
    include: {
      userSegment: true,
      createdByUser: {
        select: { name: true, email: true }
      },
      products: {
        include: {
          product: true
        }
      }
    }
  });

  if (!paymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  return successResponse(res, paymentWall);
}));

// 新建支付墙
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, userSegmentId, sort = 0, status = 'active' } = req.body;

  // 验证必填字段
  if (!name || !userSegmentId) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 校验长度
  if (name.length > 40) {
    return errorResponse(res, 400, '支付墙名称长度不能超过40字符');
  }

  // 校验排序值
  const sortNum = parseInt(sort);
  if (isNaN(sortNum) || sortNum < 0 || sortNum > 999) {
    return errorResponse(res, 400, '排序值必须在0-999之间');
  }

  // 验证用户分层是否存在
  const userSegment = await prisma.userSegment.findUnique({
    where: { id: userSegmentId }
  });

  if (!userSegment) {
    return errorResponse(res, 400, '所选用户分层不存在');
  }

  // 生成唯一编号
  const count = await prisma.paymentWall.count();
  const paymentWallId = `PW${String(count + 1).padStart(6, '0')}`;

  const paymentWall = await prisma.paymentWall.create({
    data: {
      paymentWallId,
      name,
      userSegmentId,
      sort: sortNum,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: paymentWall.id,
    paymentWallId: paymentWall.paymentWallId,
    name: paymentWall.name,
    sort: paymentWall.sort,
    status: paymentWall.status,
  }, '创建成功');
}));

// 编辑支付墙
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, userSegmentId, sort, status } = req.body;

  const existingPaymentWall = await prisma.paymentWall.findUnique({ where: { id } });

  if (!existingPaymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  // 校验长度
  if (name && name.length > 40) {
    return errorResponse(res, 400, '支付墙名称长度不能超过40字符');
  }

  // 校验排序值
  let newSort = existingPaymentWall.sort;
  if (sort !== undefined) {
    newSort = parseInt(sort);
    if (isNaN(newSort) || newSort < 0 || newSort > 999) {
      return errorResponse(res, 400, '排序值必须在0-999之间');
    }
  }

  // 验证用户分层是否存在
  if (userSegmentId) {
    const userSegment = await prisma.userSegment.findUnique({
      where: { id: userSegmentId }
    });

    if (!userSegment) {
      return errorResponse(res, 400, '所选用户分层不存在');
    }
  }

  const paymentWall = await prisma.paymentWall.update({
    where: { id },
    data: {
      name: name || existingPaymentWall.name,
      userSegmentId: userSegmentId || existingPaymentWall.userSegmentId,
      sort: newSort,
      status: status || existingPaymentWall.status,
    },
  });

  return successResponse(res, {
    id: paymentWall.id,
    paymentWallId: paymentWall.paymentWallId,
    name: paymentWall.name,
    sort: paymentWall.sort,
    status: paymentWall.status,
  }, '更新成功');
}));

// 删除支付墙
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingPaymentWall = await prisma.paymentWall.findUnique({ where: { id } });

  if (!existingPaymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  // 删除关联的商品配置
  await prisma.$transaction([
    prisma.paymentWallProduct.deleteMany({ where: { paymentWallId: id } }),
    prisma.paymentWall.delete({ where: { id } })
  ]);

  return successResponse(res, null, '删除成功');
}));

// ===== 支付墙商品配置 =====

// 获取支付墙商品列表
router.get('/:id/products', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { type } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const paymentWall = await prisma.paymentWall.findUnique({ where: { id } });

  if (!paymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  const where: any = { paymentWallId: id };
  if (type) {
    where.type = type;
  }

  const [products, total] = await Promise.all([
    prisma.paymentWallProduct.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [
        { sort: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        product: true,
        createdByUser: {
          select: { name: true, email: true }
        }
      }
    }),
    prisma.paymentWallProduct.count({ where }),
  ]);

  // 格式化返回数据
  const data = products.map(pwp => ({
    id: pwp.id,
    paymentWallId: pwp.paymentWallId,
    sort: pwp.sort,
    product: {
      id: pwp.product.id,
      productId: pwp.product.productId,
      name: pwp.product.name,
      os: pwp.product.os,
      price: `$${(pwp.product.price / 100).toFixed(2)}`,
      coins: pwp.product.coins,
      subscriptionDuration: pwp.product.subscriptionDuration,
    },
    bonusCoins: pwp.bonusCoins,
    isDefaultSelected: pwp.isDefaultSelected,
    showBadge: pwp.showBadge,
    marketingText: pwp.marketingText,
    subscriptionText: pwp.subscriptionText,
    createdBy: pwp.createdByUser?.name || pwp.createdByUser?.email || '-',
    createdAt: pwp.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 新建支付墙商品配置
router.post('/:id/products', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const {
    productId,
    bonusCoins,
    isDefaultSelected = false,
    showBadge = false,
    marketingText,
    subscriptionText,
    sort = 0
  } = req.body;

  const paymentWall = await prisma.paymentWall.findUnique({ where: { id } });

  if (!paymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  // 验证必填字段
  if (!productId) {
    return errorResponse(res, 400, '请选择商品');
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    return errorResponse(res, 400, '所选商品不存在');
  }

  // 检查商品类型与支付墙是否匹配
  // （这里可以添加类型检查逻辑）

  // 校验唯一默认勾选
  if (isDefaultSelected) {
    const existingDefault = await prisma.paymentWallProduct.findFirst({
      where: { paymentWallId: id, isDefaultSelected: true }
    });

    if (existingDefault) {
      return errorResponse(res, 400, '已有默认勾选商品，请先取消');
    }
  }

  // 校验营销文案长度
  if (showBadge) {
    const text = product.type === 'subscription' ? subscriptionText : marketingText;
    if (!text || text.length > 10) {
      return errorResponse(res, 400, '营销文案长度不能超过10字符');
    }
  }

  // 检查是否已存在相同商品配置
  const existingProduct = await prisma.paymentWallProduct.findFirst({
    where: { paymentWallId: id, productId }
  });

  if (existingProduct) {
    return errorResponse(res, 400, '该商品已在支付墙中配置');
  }

  const paymentWallProduct = await prisma.paymentWallProduct.create({
    data: {
      paymentWallId: id,
      productId,
      type: product.type,
      bonusCoins: product.type === 'recharge' ? (bonusCoins ? parseInt(bonusCoins) : null) : null,
      isDefaultSelected,
      showBadge,
      marketingText: product.type === 'recharge' ? marketingText : null,
      subscriptionText: product.type === 'subscription' ? subscriptionText : null,
      sort: parseInt(sort) || 0,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, paymentWallProduct, '创建成功');
}));

// 编辑支付墙商品配置
router.put('/:id/products/:productConfigId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const productConfigId = req.params.productConfigId as string;
  const updateData = req.body;

  const paymentWall = await prisma.paymentWall.findUnique({ where: { id } });

  if (!paymentWall) {
    return errorResponse(res, 404, '支付墙不存在');
  }

  const existingConfig = await prisma.paymentWallProduct.findUnique({
    where: { id: productConfigId }
  });

  if (!existingConfig) {
    return errorResponse(res, 404, '商品配置不存在');
  }

  // 校验唯一默认勾选
  if (updateData.isDefaultSelected === true) {
    const existingDefault = await prisma.paymentWallProduct.findFirst({
      where: { 
        paymentWallId: id, 
        isDefaultSelected: true,
        id: { not: productConfigId }
      }
    });

    if (existingDefault) {
      return errorResponse(res, 400, '已有默认勾选商品，请先取消');
    }
  }

  const paymentWallProduct = await prisma.paymentWallProduct.update({
    where: { id: productConfigId },
    data: {
      bonusCoins: updateData.bonusCoins !== undefined 
        ? (updateData.bonusCoins ? parseInt(updateData.bonusCoins) : null)
        : existingConfig.bonusCoins,
      isDefaultSelected: updateData.isDefaultSelected !== undefined 
        ? updateData.isDefaultSelected 
        : existingConfig.isDefaultSelected,
      showBadge: updateData.showBadge !== undefined 
        ? updateData.showBadge 
        : existingConfig.showBadge,
      marketingText: updateData.marketingText !== undefined 
        ? updateData.marketingText 
        : existingConfig.marketingText,
      subscriptionText: updateData.subscriptionText !== undefined 
        ? updateData.subscriptionText 
        : existingConfig.subscriptionText,
      sort: updateData.sort !== undefined 
        ? (parseInt(updateData.sort) || 0) 
        : existingConfig.sort,
    },
  });

  return successResponse(res, paymentWallProduct, '更新成功');
}));

// 删除支付墙商品配置
router.delete('/:id/products/:productConfigId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const productConfigId = req.params.productConfigId as string;

  const existingConfig = await prisma.paymentWallProduct.findUnique({
    where: { id: productConfigId }
  });

  if (!existingConfig) {
    return errorResponse(res, 404, '商品配置不存在');
  }

  await prisma.paymentWallProduct.delete({ where: { id: productConfigId } });

  return successResponse(res, null, '删除成功');
}));

export default router;
