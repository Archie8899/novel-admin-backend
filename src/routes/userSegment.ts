import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取用户分层列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, condition, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (condition && condition !== 'all') {
    // 根据分层条件筛选
    where.conditions = {
      array_contains: condition
    };
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

  const [segments, total] = await Promise.all([
    prisma.userSegment.findMany({
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
    prisma.userSegment.count({ where }),
  ]);

  // 格式化返回数据
  const data = segments.map(segment => ({
    id: segment.id,
    segmentId: segment.segmentId,
    name: segment.name,
    conditions: JSON.parse(segment.conditions || "[]"),
    conditionsDisplay: formatConditions(JSON.parse(segment.conditions || "[]")),
    osCondition: segment.osCondition,
    countryLevels: segment.countryLevels,
    status: segment.status,
    statusDisplay: segment.status === 'active' ? '有效' : '无效',
    createdBy: segment.createdByUser?.name || segment.createdByUser?.email || '-',
    createdAt: segment.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取有效用户分层列表（用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const segments = await prisma.userSegment.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      segmentId: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(res, segments);
}));

// 获取单个用户分层
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const segment = await prisma.userSegment.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!segment) {
    return errorResponse(res, 404, '用户分层不存在');
  }

  return successResponse(res, {
    ...segment,
    conditions: JSON.parse(segment.conditions || "[]"),
    countryLevels: JSON.parse(segment.countryLevels || "{}"),
  });
}));

// 新建用户分层
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, conditions, osCondition, systemLanguage, countryLevels, status = 'active' } = req.body;

  // 验证必填字段
  if (!name) {
    return errorResponse(res, 400, '分层名称为必填项');
  }

  // 校验长度
  if (name.length > 40) {
    return errorResponse(res, 400, '分层名称长度不能超过40字符');
  }

  // 验证分层条件
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return errorResponse(res, 400, '请选择至少一个分层条件');
  }

  // 验证操作系统条件
  if (conditions.includes('os')) {
    if (!osCondition) {
      return errorResponse(res, 400, '请选择操作系统条件');
    }
  }

  // 验证国家等级条件
  if (conditions.includes('country_level')) {
    if (!countryLevels) {
      return errorResponse(res, 400, '请选择国家等级');
    }
  }

  // 生成唯一编号
  const count = await prisma.userSegment.count();
  const segmentId = `SEG${String(count + 1).padStart(6, '0')}`;

  const segment = await prisma.userSegment.create({
    data: {
      segmentId,
      name,
      conditions: JSON.stringify(conditions),
      osCondition: conditions.includes('os') ? osCondition : null,
      systemLanguage: conditions.includes('system_language') ? JSON.stringify(systemLanguage || []) : null,
      countryLevels: conditions.includes('country_level') ? JSON.stringify(countryLevels) : '{}',
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: segment.id,
    segmentId: segment.segmentId,
    name: segment.name,
    status: segment.status,
  }, '创建成功');
}));

// 编辑用户分层
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, conditions, osCondition, systemLanguage, countryLevels, status } = req.body;

  const existingSegment = await prisma.userSegment.findUnique({ where: { id } });

  if (!existingSegment) {
    return errorResponse(res, 404, '用户分层不存在');
  }

  // 校验长度
  if (name && name.length > 40) {
    return errorResponse(res, 400, '分层名称长度不能超过40字符');
  }

  // 验证分层条件
  let newConditions = JSON.parse(existingSegment.conditions || "[]");
  let newOsCondition = existingSegment.osCondition;
  let newSystemLanguage = existingSegment.systemLanguage;
  let newCountryLevels = existingSegment.countryLevels;

  if (conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return errorResponse(res, 400, '请选择至少一个分层条件');
    }
    newConditions = conditions;
  }

  if (newConditions.includes('os')) {
    if (osCondition !== undefined) {
      newOsCondition = osCondition;
    } else if (!existingSegment.osCondition) {
      return errorResponse(res, 400, '请选择操作系统条件');
    }
  }

  if (newConditions.includes('system_language')) {
    if (systemLanguage !== undefined) {
      newSystemLanguage = JSON.stringify(systemLanguage);
    } else if (!existingSegment.systemLanguage) {
      return errorResponse(res, 400, '请选择系统语言');
    }
  }

  if (newConditions.includes('country_level')) {
    if (countryLevels !== undefined && (!countryLevels || Object.keys(countryLevels).length === 0)) {
      return errorResponse(res, 400, '请选择国家等级');
    }
    if (countryLevels !== undefined) {
      newCountryLevels = JSON.stringify(countryLevels);
    } else if (!existingSegment.countryLevels || existingSegment.countryLevels === '{}') {
      return errorResponse(res, 400, '请选择国家等级');
    }
  }

  const segment = await prisma.userSegment.update({
    where: { id },
    data: {
      name: name || existingSegment.name,
      conditions: JSON.stringify(newConditions),
      osCondition: newConditions.includes('os') ? newOsCondition : null,
      systemLanguage: newConditions.includes('system_language') ? newSystemLanguage : null,
      countryLevels: newConditions.includes('country_level') ? newCountryLevels : '{}',
      status: status || existingSegment.status,
    },
  });

  return successResponse(res, {
    id: segment.id,
    segmentId: segment.segmentId,
    name: segment.name,
    status: segment.status,
  }, '更新成功');
}));

// 删除用户分层
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingSegment = await prisma.userSegment.findUnique({ where: { id } });

  if (!existingSegment) {
    return errorResponse(res, 404, '用户分层不存在');
  }

  // 检查是否有关联的支付墙
  const paymentWallCount = await prisma.paymentWall.count({
    where: { userSegmentId: id }
  });

  if (paymentWallCount > 0) {
    return errorResponse(res, 400, `该分层已被${paymentWallCount}个支付墙使用，无法删除`);
  }

  // 检查是否有关联的分层定价
  const pricingTierCount = await prisma.pricingTier.count({
    where: { userSegmentId: id }
  });

  if (pricingTierCount > 0) {
    return errorResponse(res, 400, `该分层已被${pricingTierCount}个分层定价使用，无法删除`);
  }

  await prisma.userSegment.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 辅助函数：格式化分层条件显示
function formatConditions(conditions: string[]): string {
  if (!conditions || conditions.length === 0) return '-';
  
  const conditionMap: Record<string, string> = {
    'os': '操作系统',
    'country_level': '国家等级',
  };
  
  return conditions.map(c => conditionMap[c] || c).join('、');
}

export default router;
