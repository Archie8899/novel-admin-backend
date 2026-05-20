import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取首页策略列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, terminal, userSegmentId, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (terminal && terminal !== 'all') {
    where.terminal = terminal;
  }
  
  if (userSegmentId && userSegmentId !== 'all') {
    where.userSegmentId = userSegmentId;
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

  const [strategies, total] = await Promise.all([
    prisma.homepageStrategy.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        userSegment: {
          select: { id: true, segmentId: true, name: true }
        },
        createdByUser: {
          select: { name: true, email: true }
        },
        strategyColumns: {
          include: {
            column: {
              select: { id: true, columnId: true, name: true, terminal: true, language: true }
            }
          }
        }
      }
    }),
    prisma.homepageStrategy.count({ where }),
  ]);

  // 格式化返回数据
  const data = strategies.map(strategy => ({
    id: strategy.id,
    strategyId: strategy.strategyId,
    name: strategy.name,
    terminal: strategy.terminal,
    userSegmentId: strategy.userSegmentId,
    userSegment: strategy.userSegment ? {
      id: strategy.userSegment.id,
      segmentId: strategy.userSegment.segmentId,
      name: strategy.userSegment.name,
    } : null,
    userSegmentName: strategy.userSegment ? strategy.userSegment.name : '-',
    priority: strategy.priority,
    status: strategy.status,
    statusDisplay: strategy.status === 'active' ? '启用' : '禁用',
    columnsCount: strategy.strategyColumns.length,
    createdBy: strategy.createdByUser?.name || strategy.createdByUser?.email || '-',
    createdAt: strategy.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个首页策略
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const strategy = await prisma.homepageStrategy.findUnique({
    where: { id },
    include: {
      userSegment: {
        select: { id: true, segmentId: true, name: true }
      },
      createdByUser: {
        select: { name: true, email: true }
      },
      strategyColumns: {
        orderBy: { sort: 'asc' },
        include: {
          column: {
            select: { id: true, columnId: true, name: true, terminal: true, language: true, style: true, recommendMode: true, status: true }
          }
        }
      }
    }
  });

  if (!strategy) {
    return errorResponse(res, 404, '首页策略不存在');
  }

  // 格式化返回数据
  const data = {
    ...strategy,
    userSegment: strategy.userSegment ? {
      id: strategy.userSegment.id,
      segmentId: strategy.userSegment.segmentId,
      name: strategy.userSegment.name,
    } : null,
    columns: strategy.strategyColumns.map(sc => ({
      id: sc.id,
      strategyId: sc.strategyId,
      columnId: sc.columnId,
      sort: sc.sort,
      column: sc.column ? {
        id: sc.column.id,
        columnId: sc.column.columnId,
        name: JSON.parse(sc.column.name || '{}'),
        nameDisplay: formatColumnName(sc.column.name),
        terminal: JSON.parse(sc.column.terminal || '[]'),
        language: sc.column.language,
        style: sc.column.style,
        recommendMode: sc.column.recommendMode,
        status: sc.column.status,
      } : null,
    })),
  };

  return successResponse(res, data);
}));

// 新建首页策略
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, terminal, userSegmentId, priority = 0, status = 'active', columns = [] } = req.body;

  // 验证必填字段
  if (!name) {
    return errorResponse(res, 400, '策略名称为必填项');
  }

  if (!terminal) {
    return errorResponse(res, 400, '请选择终端');
  }

  if (!userSegmentId) {
    return errorResponse(res, 400, '请选择用户分层');
  }

  // 验证用户分层是否存在
  const userSegment = await prisma.userSegment.findUnique({ where: { id: userSegmentId } });

  if (!userSegment) {
    return errorResponse(res, 404, '用户分层不存在');
  }

  // 生成唯一编号
  const count = await prisma.homepageStrategy.count();
  const strategyId = `HPS${String(count + 1).padStart(6, '0')}`;

  // 创建策略及关联的栏目
  const strategy = await prisma.$transaction(async (tx) => {
    // 创建策略
    const newStrategy = await tx.homepageStrategy.create({
      data: {
        strategyId,
        name,
        terminal,
        userSegmentId,
        priority,
        status,
        createdBy: req.user!.userId,
      },
    });

    // 创建策略栏目关联
    if (columns && Array.isArray(columns) && columns.length > 0) {
      for (const col of columns) {
        await tx.homepageStrategyColumn.create({
          data: {
            strategyId: newStrategy.id,
            columnId: col.columnId,
            sort: col.sort || 0,
          },
        });
      }
    }

    return newStrategy;
  });

  return successResponse(res, {
    id: strategy.id,
    strategyId: strategy.strategyId,
    name: strategy.name,
    status: strategy.status,
  }, '创建成功');
}));

// 编辑首页策略
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, terminal, userSegmentId, priority, status, columns } = req.body;

  const existingStrategy = await prisma.homepageStrategy.findUnique({ where: { id } });

  if (!existingStrategy) {
    return errorResponse(res, 404, '首页策略不存在');
  }

  // 构建更新数据
  const updateData: any = {};
  
  if (name !== undefined) {
    updateData.name = name;
  }
  
  if (terminal !== undefined) {
    updateData.terminal = terminal;
  }
  
  if (userSegmentId !== undefined) {
    // 验证用户分层是否存在
    const userSegment = await prisma.userSegment.findUnique({ where: { id: userSegmentId } });
    if (!userSegment) {
      return errorResponse(res, 404, '用户分层不存在');
    }
    updateData.userSegmentId = userSegmentId;
  }
  
  if (priority !== undefined) {
    updateData.priority = priority;
  }
  
  if (status !== undefined) {
    updateData.status = status;
  }

  // 更新策略及关联的栏目
  const strategy = await prisma.$transaction(async (tx) => {
    // 更新策略
    const updatedStrategy = await tx.homepageStrategy.update({
      where: { id },
      data: updateData,
    });

    // 如果提供了columns，则更新策略栏目关联
    if (columns !== undefined) {
      // 删除现有关联
      await tx.homepageStrategyColumn.deleteMany({
        where: { strategyId: id },
      });

      // 创建新关联
      if (Array.isArray(columns) && columns.length > 0) {
        for (const col of columns) {
          await tx.homepageStrategyColumn.create({
            data: {
              strategyId: id,
              columnId: col.columnId,
              sort: col.sort || 0,
            },
          });
        }
      }
    }

    return updatedStrategy;
  });

  return successResponse(res, {
    id: strategy.id,
    strategyId: strategy.strategyId,
    name: strategy.name,
    status: strategy.status,
  }, '更新成功');
}));

// 删除首页策略
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingStrategy = await prisma.homepageStrategy.findUnique({ where: { id } });

  if (!existingStrategy) {
    return errorResponse(res, 404, '首页策略不存在');
  }

  // 删除策略（会级联删除关联的strategyColumns）
  await prisma.homepageStrategy.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 批量更新首页策略状态
router.put('/batch/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 400, '请选择至少一个策略');
  }

  if (!status || (status !== 'active' && status !== 'inactive')) {
    return errorResponse(res, 400, '状态值无效');
  }

  await prisma.homepageStrategy.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return successResponse(res, null, '批量更新成功');
}));

// 辅助函数：格式化栏目名称显示
function formatColumnName(nameJson: string): string {
  try {
    const nameObj = JSON.parse(nameJson || '{}');
    // 优先显示英文名称，如果没有则显示第一个可用的名称
    if (nameObj.en) return nameObj.en;
    if (nameObj.zh) return nameObj.zh;
    const firstKey = Object.keys(nameObj)[0];
    return firstKey ? nameObj[firstKey] : '-';
  } catch {
    return nameJson || '-';
  }
}

export default router;
