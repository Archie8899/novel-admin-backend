import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取栏目列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, terminal, language, style, recommendMode, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (terminal && terminal !== 'all') {
    // 根据终端筛选（terminal是JSON数组）
    where.terminal = {
      contains: terminal
    };
  }
  
  if (language && language !== 'all') {
    where.language = language;
  }
  
  if (style && style !== 'all') {
    where.style = style;
  }
  
  if (recommendMode && recommendMode !== 'all') {
    where.recommendMode = recommendMode;
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

  const [columns, total] = await Promise.all([
    prisma.column.findMany({
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
    prisma.column.count({ where }),
  ]);

  // 格式化返回数据
  const data = columns.map(column => ({
    id: column.id,
    columnId: column.columnId,
    name: JSON.parse(column.name || '{}'),
    nameDisplay: formatColumnName(column.name),
    terminal: JSON.parse(column.terminal || '[]'),
    language: column.language,
    style: column.style,
    recommendMode: column.recommendMode,
    status: column.status,
    statusDisplay: column.status === 'active' ? '启用' : '禁用',
    createdBy: column.createdByUser?.name || column.createdByUser?.email || '-',
    createdAt: column.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取有效栏目列表（用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { terminal, language } = req.query;
  
  const where: any = { status: 'active' };
  
  if (terminal) {
    // 筛选同终端的栏目
    where.terminal = {
      contains: terminal
    };
  }
  
  if (language) {
    where.language = language;
  }
  
  const columns = await prisma.column.findMany({
    where,
    select: {
      id: true,
      columnId: true,
      name: true,
      terminal: true,
      language: true,
    },
    orderBy: { name: 'asc' },
  });

  // 格式化返回数据
  const data = columns.map(column => ({
    id: column.id,
    columnId: column.columnId,
    name: JSON.parse(column.name || '{}'),
    nameDisplay: formatColumnName(column.name),
    terminal: JSON.parse(column.terminal || '[]'),
    language: column.language,
  }));

  return successResponse(res, data);
}));

// 获取单个栏目
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const column = await prisma.column.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!column) {
    return errorResponse(res, 404, '栏目不存在');
  }

  return successResponse(res, {
    ...column,
    name: JSON.parse(column.name || '{}'),
    terminal: JSON.parse(column.terminal || '[]'),
    recommendRules: column.recommendRules ? JSON.parse(column.recommendRules) : null,
  });
}));

// 新建栏目
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, terminal, language, style, recommendMode, recommendRules, status = 'active' } = req.body;

  // 验证必填字段
  if (!name) {
    return errorResponse(res, 400, '栏目名称为必填项');
  }

  // 验证终端
  if (!terminal || !Array.isArray(terminal) || terminal.length === 0) {
    return errorResponse(res, 400, '请选择至少一个终端');
  }

  // 验证语言
  if (!language) {
    return errorResponse(res, 400, '请选择语言');
  }

  // 验证样式
  if (!style) {
    return errorResponse(res, 400, '请选择样式');
  }

  // 验证推荐模式
  if (!recommendMode) {
    return errorResponse(res, 400, '请选择推荐模式');
  }

  // 生成唯一编号
  const count = await prisma.column.count();
  const columnId = `COL${String(count + 1).padStart(6, '0')}`;

  const column = await prisma.column.create({
    data: {
      columnId,
      name: typeof name === 'string' ? name : JSON.stringify(name),
      terminal: JSON.stringify(terminal),
      language,
      style,
      recommendMode,
      recommendRules: recommendRules ? JSON.stringify(recommendRules) : null,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: column.id,
    columnId: column.columnId,
    name: JSON.parse(column.name),
    status: column.status,
  }, '创建成功');
}));

// 编辑栏目
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, terminal, language, style, recommendMode, recommendRules, status } = req.body;

  const existingColumn = await prisma.column.findUnique({ where: { id } });

  if (!existingColumn) {
    return errorResponse(res, 404, '栏目不存在');
  }

  // 构建更新数据
  const updateData: any = {};
  
  if (name !== undefined) {
    updateData.name = typeof name === 'string' ? name : JSON.stringify(name);
  }
  
  if (terminal !== undefined) {
    if (!Array.isArray(terminal) || terminal.length === 0) {
      return errorResponse(res, 400, '请选择至少一个终端');
    }
    updateData.terminal = JSON.stringify(terminal);
  }
  
  if (language !== undefined) {
    updateData.language = language;
  }
  
  if (style !== undefined) {
    updateData.style = style;
  }
  
  if (recommendMode !== undefined) {
    updateData.recommendMode = recommendMode;
  }
  
  if (recommendRules !== undefined) {
    updateData.recommendRules = recommendRules ? JSON.stringify(recommendRules) : null;
  }
  
  if (status !== undefined) {
    updateData.status = status;
  }

  const column = await prisma.column.update({
    where: { id },
    data: updateData,
  });

  return successResponse(res, {
    id: column.id,
    columnId: column.columnId,
    name: JSON.parse(column.name),
    status: column.status,
  }, '更新成功');
}));

// 删除栏目
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingColumn = await prisma.column.findUnique({ where: { id } });

  if (!existingColumn) {
    return errorResponse(res, 404, '栏目不存在');
  }

  // 检查是否有关联的首页策略
  const strategyColumnCount = await prisma.homepageStrategyColumn.count({
    where: { columnId: id }
  });

  if (strategyColumnCount > 0) {
    return errorResponse(res, 400, `该栏目已被${strategyColumnCount}个首页策略使用，无法删除`);
  }

  // 检查是否有关联的小说
  const columnNovelCount = await prisma.columnNovel.count({
    where: { columnId: id }
  });

  // 删除栏目（会级联删除关联的columnNovels）
  await prisma.column.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 批量更新栏目状态
router.put('/batch/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 400, '请选择至少一个栏目');
  }

  if (!status || (status !== 'active' && status !== 'inactive')) {
    return errorResponse(res, 400, '状态值无效');
  }

  await prisma.column.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return successResponse(res, null, '批量更新成功');
}));

// 获取栏目小说列表
router.get('/:id/novels', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const column = await prisma.column.findUnique({ where: { id } });

  if (!column) {
    return errorResponse(res, 404, '栏目不存在');
  }

  const [columnNovels, total] = await Promise.all([
    prisma.columnNovel.findMany({
      where: { columnId: id },
      skip,
      take: pageSize,
      orderBy: { sort: 'asc' },
      include: {
        novel: {
          select: {
            id: true,
            novelId: true,
            name: true,
            author: true,
            language: true,
            status: true,
            coverImage: true,
          }
        }
      }
    }),
    prisma.columnNovel.count({ where: { columnId: id } }),
  ]);

  // 格式化返回数据
  const data = columnNovels.map(cn => ({
    id: cn.id,
    columnId: cn.columnId,
    novelId: cn.novelId,
    sort: cn.sort,
    novel: {
      id: cn.novel.id,
      novelId: cn.novel.novelId,
      name: cn.novel.name,
      author: cn.novel.author,
      language: cn.novel.language,
      status: cn.novel.status,
      statusDisplay: cn.novel.status === 'online' ? '上架' : '下架',
      coverImage: cn.novel.coverImage,
    }
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 添加小说到栏目
router.post('/:id/novels', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { novelId, sort } = req.body;

  const column = await prisma.column.findUnique({ where: { id } });

  if (!column) {
    return errorResponse(res, 404, '栏目不存在');
  }

  // 检查小说是否存在
  const novel = await prisma.novel.findUnique({ where: { id: novelId } });

  if (!novel) {
    return errorResponse(res, 404, '小说不存在');
  }

  // 检查是否已经添加
  const existing = await prisma.columnNovel.findUnique({
    where: { columnId_novelId: { columnId: id, novelId } }
  });

  if (existing) {
    return errorResponse(res, 400, '该小说已添加到此栏目');
  }

  const columnNovel = await prisma.columnNovel.create({
    data: {
      columnId: id,
      novelId,
      sort: sort || 0,
    },
  });

  return successResponse(res, {
    id: columnNovel.id,
    columnId: columnNovel.columnId,
    novelId: columnNovel.novelId,
    sort: columnNovel.sort,
  }, '添加成功');
}));

// 更新栏目小说排序
router.put('/:id/novels/:novelId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const novelId = req.params.novelId as string;
  const { sort } = req.body;

  const columnNovel = await prisma.columnNovel.findUnique({
    where: { columnId_novelId: { columnId: id, novelId } }
  });

  if (!columnNovel) {
    return errorResponse(res, 404, '栏目小说关联不存在');
  }

  const updated = await prisma.columnNovel.update({
    where: { columnId_novelId: { columnId: id, novelId } },
    data: { sort },
  });

  return successResponse(res, {
    id: updated.id,
    sort: updated.sort,
  }, '更新成功');
}));

// 从栏目移除小说
router.delete('/:id/novels/:novelId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const novelId = req.params.novelId as string;

  const columnNovel = await prisma.columnNovel.findUnique({
    where: { columnId_novelId: { columnId: id, novelId } }
  });

  if (!columnNovel) {
    return errorResponse(res, 404, '栏目小说关联不存在');
  }

  await prisma.columnNovel.delete({
    where: { columnId_novelId: { columnId: id, novelId } },
  });

  return successResponse(res, null, '移除成功');
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
