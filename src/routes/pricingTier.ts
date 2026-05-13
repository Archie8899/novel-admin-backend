import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取分层定价列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
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

  const [pricingTiers, total] = await Promise.all([
    prisma.pricingTier.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { sort: 'asc' },
      include: {
        userSegment: {
          select: { segmentId: true, name: true }
        },
        createdByUser: {
          select: { name: true, email: true }
        },
        _count: {
          select: { novelConfigs: true }
        }
      }
    }),
    prisma.pricingTier.count({ where }),
  ]);

  // 格式化返回数据
  const data = pricingTiers.map(pt => ({
    id: pt.id,
    pricingTierId: pt.pricingTierId,
    name: pt.name,
    userSegment: pt.userSegment,
    defaultChapterPrice: pt.defaultChapterPrice,
    sort: pt.sort,
    status: pt.status,
    statusDisplay: pt.status === 'active' ? '有效' : '无效',
    novelConfigCount: pt._count.novelConfigs,
    createdBy: pt.createdByUser?.name || pt.createdByUser?.email || '-',
    createdAt: pt.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个分层定价
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const pricingTier = await prisma.pricingTier.findUnique({
    where: { id },
    include: {
      userSegment: true,
      createdByUser: {
        select: { name: true, email: true }
      },
      novelConfigs: {
        include: {
          novel: {
            select: { novelId: true, name: true, chineseName: true }
          },
          ranges: {
            orderBy: { startChapter: 'asc' }
          }
        }
      }
    }
  });

  if (!pricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  // 格式化返回数据
  const novelConfigs = pricingTier.novelConfigs.map(config => ({
    id: config.id,
    novel: config.novel,
    uniformChapterPrice: config.uniformChapterPrice,
    ranges: config.ranges.map(r => ({
      id: r.id,
      startChapter: r.startChapter,
      endChapter: r.endChapter,
      price: r.price,
    })),
  }));

  return successResponse(res, {
    ...pricingTier,
    novelConfigs,
  });
}));

// 新建分层定价
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, userSegmentId, defaultChapterPrice, sort = 0, status = 'active' } = req.body;

  // 验证必填字段
  if (!name || !userSegmentId || !defaultChapterPrice) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 校验长度
  if (name.length > 40) {
    return errorResponse(res, 400, '名称长度不能超过40字符');
  }

  // 校验章节价格
  const price = parseInt(defaultChapterPrice);
  if (isNaN(price) || price < 1 || price > 9999) {
    return errorResponse(res, 400, '章节价格必须在1-9999之间');
  }

  // 校验排序值
  const sortNum = parseInt(sort);
  if (isNaN(sortNum) || sortNum < 0 || sortNum > 999) {
    return errorResponse(res, 400, '排序值必须在0-999之间');
  }

  // 验证用户分层是否存在 - 支持 segmentId 或 id
  let userSegment = await prisma.userSegment.findUnique({
    where: { id: userSegmentId }
  });
  if (!userSegment) {
    userSegment = await prisma.userSegment.findFirst({
      where: { segmentId: userSegmentId }
    });
  }
  if (!userSegment) {
    return errorResponse(res, 400, '所选用户分层不存在');
  }

  // 生成唯一编号
  const count = await prisma.pricingTier.count();
  const pricingTierId = `PT${String(count + 1).padStart(6, '0')}`;

  const pricingTier = await prisma.pricingTier.create({
    data: {
      pricingTierId,
      name,
      userSegmentId,
      defaultChapterPrice: price,
      sort: sortNum,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: pricingTier.id,
    pricingTierId: pricingTier.pricingTierId,
    name: pricingTier.name,
    sort: pricingTier.sort,
    status: pricingTier.status,
  }, '创建成功');
}));

// 编辑分层定价
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, userSegmentId, defaultChapterPrice, sort, status } = req.body;

  const existingPricingTier = await prisma.pricingTier.findUnique({ where: { id } });

  if (!existingPricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  // 校验长度
  if (name && name.length > 40) {
    return errorResponse(res, 400, '名称长度不能超过40字符');
  }

  // 校验章节价格
  let newPrice = existingPricingTier.defaultChapterPrice;
  if (defaultChapterPrice !== undefined) {
    newPrice = parseInt(defaultChapterPrice);
    if (isNaN(newPrice) || newPrice < 1 || newPrice > 9999) {
      return errorResponse(res, 400, '章节价格必须在1-9999之间');
    }
  }

  // 校验排序值
  let newSort = existingPricingTier.sort;
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

  const pricingTier = await prisma.pricingTier.update({
    where: { id },
    data: {
      name: name || existingPricingTier.name,
      userSegmentId: userSegmentId || existingPricingTier.userSegmentId,
      defaultChapterPrice: newPrice,
      sort: newSort,
      status: status || existingPricingTier.status,
    },
  });

  return successResponse(res, {
    id: pricingTier.id,
    pricingTierId: pricingTier.pricingTierId,
    name: pricingTier.name,
    sort: pricingTier.sort,
    status: pricingTier.status,
  }, '更新成功');
}));

// 删除分层定价
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingPricingTier = await prisma.pricingTier.findUnique({ where: { id } });

  if (!existingPricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  // 删除关联的小说配置和范围定价
  await prisma.$transaction([
    prisma.pricingTierNovelRange.deleteMany({
      where: {
        pricingTierNovel: {
          pricingTierId: id
        }
      }
    }),
    prisma.pricingTierNovel.deleteMany({
      where: { pricingTierId: id }
    }),
    prisma.pricingTier.delete({ where: { id } })
  ]);

  return successResponse(res, null, '删除成功');
}));

// ===== 分层定价小说配置 =====

// 获取分层定价小说配置列表
router.get('/:id/novels', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { novelId, novelName } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const pricingTier = await prisma.pricingTier.findUnique({ where: { id } });

  if (!pricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  const where: any = { pricingTierId: id };
  
  if (novelId) {
    where.novelId = novelId;
  }
  
  if (novelName) {
    where.novel = {
      OR: [
        { name: { contains: novelName as string } },
        { chineseName: { contains: novelName as string } }
      ]
    };
  }

  const [configs, total] = await Promise.all([
    prisma.pricingTierNovel.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        novel: {
          select: { novelId: true, name: true, chineseName: true }
        },
        ranges: {
          orderBy: { startChapter: 'asc' }
        },
        createdByUser: {
          select: { name: true, email: true }
        }
      }
    }),
    prisma.pricingTierNovel.count({ where }),
  ]);

  // 格式化返回数据
  const data = configs.map(config => ({
    id: config.id,
    novelId: config.novelId,
    novel: config.novel,
    uniformChapterPrice: config.uniformChapterPrice,
    rangeInfo: formatRangeInfo(config.ranges),
    ranges: config.ranges.map(r => ({
      id: r.id,
      startChapter: r.startChapter,
      endChapter: r.endChapter,
      price: r.price,
    })),
    createdBy: config.createdByUser?.name || config.createdByUser?.email || '-',
    createdAt: config.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 新建小说配置
router.post('/:id/novels', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { selectNovel, uniformChapterPrice, ranges } = req.body;

  const pricingTier = await prisma.pricingTier.findUnique({ where: { id } });

  if (!pricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  // 验证必填字段
  if (!selectNovel) {
    return errorResponse(res, 400, '请选择小说');
  }

  // 验证小说是否存在
  const novel = await prisma.novel.findUnique({
    where: { id: selectNovel }
  });

  if (!novel) {
    return errorResponse(res, 400, '所选小说不存在');
  }

  // 检查是否已存在相同配置
  const existingConfig = await prisma.pricingTierNovel.findFirst({
    where: { pricingTierId: id, novelId: selectNovel }
  });

  if (existingConfig) {
    return errorResponse(res, 400, '当前分层配置中已存在该小说，不可重复配置');
  }

  // 校验章节统一定价
  if (!uniformChapterPrice || uniformChapterPrice < 1 || uniformChapterPrice > 9999) {
    return errorResponse(res, 400, '章节价格必须在1-9999之间');
  }

  // 校验范围定价
  if (ranges && ranges.length > 0) {
    if (ranges.length > 5) {
      return errorResponse(res, 400, '最大支持5条范围定价配置');
    }

    // 检查范围是否重复
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (isRangeOverlap(ranges[i], ranges[j])) {
          return errorResponse(res, 400, '范围定价重复，请重新输入');
        }
      }
    }

    // 校验每个范围
    for (const range of ranges) {
      if (!range.startChapter || !range.endChapter || !range.price) {
        return errorResponse(res, 400, '范围定价的起始章节、结束章节和价格都是必填项');
      }

      const start = parseInt(range.startChapter);
      const end = parseInt(range.endChapter);
      const price = parseInt(range.price);

      if (start < 1 || start > 99 || end < 1 || end > 99) {
        return errorResponse(res, 400, '章节序号必须在1-99之间');
      }

      if (end <= start) {
        return errorResponse(res, 400, '结束章节必须大于起始章节');
      }

      if (price < 1 || price > 9999) {
        return errorResponse(res, 400, '范围定价必须在1-9999之间');
      }
    }
  }

  // 创建配置
  const config = await prisma.pricingTierNovel.create({
    data: {
      pricingTierId: id,
      novelId: selectNovel,
      uniformChapterPrice: parseInt(uniformChapterPrice),
      createdBy: req.user!.userId,
    },
  });

  // 创建范围定价
  if (ranges && ranges.length > 0) {
    await prisma.pricingTierNovelRange.createMany({
      data: ranges.map((range: any) => ({
        pricingTierNovelId: config.id,
        startChapter: parseInt(range.startChapter),
        endChapter: parseInt(range.endChapter),
        price: parseInt(range.price),
      })),
    });
  }

  return successResponse(res, { id: config.id }, '创建成功');
}));

// 编辑小说配置
router.put('/:id/novels/:configId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const configId = req.params.configId as string;
  const { uniformChapterPrice, ranges } = req.body;

  const pricingTier = await prisma.pricingTier.findUnique({ where: { id } });

  if (!pricingTier) {
    return errorResponse(res, 404, '分层定价不存在');
  }

  const existingConfig = await prisma.pricingTierNovel.findUnique({
    where: { id: configId }
  });

  if (!existingConfig) {
    return errorResponse(res, 404, '小说配置不存在');
  }

  // 校验章节统一定价
  let newPrice = existingConfig.uniformChapterPrice;
  if (uniformChapterPrice !== undefined) {
    newPrice = parseInt(uniformChapterPrice);
    if (isNaN(newPrice) || newPrice < 1 || newPrice > 9999) {
      return errorResponse(res, 400, '章节价格必须在1-9999之间');
    }
  }

  // 校验范围定价
  if (ranges !== undefined) {
    if (ranges.length > 5) {
      return errorResponse(res, 400, '最大支持5条范围定价配置');
    }

    // 检查范围是否重复
    if (ranges.length > 1) {
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          if (isRangeOverlap(ranges[i], ranges[j])) {
            return errorResponse(res, 400, '范围定价重复，请重新输入');
          }
        }
      }
    }

    // 删除旧的范围定价
    await prisma.pricingTierNovelRange.deleteMany({
      where: { pricingTierNovelId: configId }
    });

    // 创建新的范围定价
    if (ranges.length > 0) {
      await prisma.pricingTierNovelRange.createMany({
        data: ranges.map((range: any) => ({
          pricingTierNovelId: configId,
          startChapter: parseInt(range.startChapter),
          endChapter: parseInt(range.endChapter),
          price: parseInt(range.price),
        })),
      });
    }
  }

  const config = await prisma.pricingTierNovel.update({
    where: { id: configId },
    data: {
      uniformChapterPrice: newPrice,
    },
  });

  return successResponse(res, config, '更新成功');
}));

// 删除小说配置
router.delete('/:id/novels/:configId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const configId = req.params.configId as string;

  const existingConfig = await prisma.pricingTierNovel.findUnique({
    where: { id: configId }
  });

  if (!existingConfig) {
    return errorResponse(res, 404, '小说配置不存在');
  }

  // 删除关联的范围定价和配置
  await prisma.$transaction([
    prisma.pricingTierNovelRange.deleteMany({
      where: { pricingTierNovelId: configId }
    }),
    prisma.pricingTierNovel.delete({
      where: { id: configId }
    })
  ]);

  return successResponse(res, null, '删除成功');
}));

// 辅助函数：格式化范围定价信息显示
function formatRangeInfo(ranges: any[]): string {
  if (!ranges || ranges.length === 0) return '-';
  return ranges.map(r => `${r.startChapter}-${r.endChapter}: ${r.price}分`).join(', ');
}

// 辅助函数：检查范围是否重叠
function isRangeOverlap(range1: any, range2: any): boolean {
  const start1 = parseInt(range1.startChapter);
  const end1 = parseInt(range1.endChapter);
  const start2 = parseInt(range2.startChapter);
  const end2 = parseInt(range2.endChapter);

  return !(end1 < start2 || end2 < start1);
}

export default router;
