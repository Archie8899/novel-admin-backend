import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Helper to safely get string query param
const getStringParam = (query: any, key: string): string | undefined => {
  const val = query[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return undefined;
};

// 获取分类列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, skip } = parsePaginationParams(req.query);
  const query = req.query as any;

  const where: any = {};
  
  const categoryId = getStringParam(query, 'categoryId');
  const categoryName = getStringParam(query, 'categoryName');
  const status = getStringParam(query, 'status');
  const startDate = getStringParam(query, 'startDate');
  const endDate = getStringParam(query, 'endDate');
  
  if (categoryId) {
    where.categoryId = categoryId;
  }
  
  if (categoryName) {
    where.name = { contains: categoryName };
  }
  
  if (status && status !== 'all') {
    where.status = status;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.count({ where }),
  ]);

  const data = categories.map(cat => ({
    id: cat.id,
    categoryId: cat.categoryId,
    name: cat.name,
    chineseName: cat.chineseName,
    status: cat.status,
    createdBy: cat.createdBy || '-',
    createdAt: cat.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取有效分类列表
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      categoryId: true,
      name: true,
      chineseName: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(res, categories);
}));

// 获取单个分类
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    return errorResponse(res, 404, '分类不存在');
  }

  return successResponse(res, {
    id: category.id,
    categoryId: category.categoryId,
    name: category.name,
    chineseName: category.chineseName,
    status: category.status,
    createdBy: category.createdBy || '-',
    createdAt: category.createdAt,
  });
}));

// 新建分类
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { categoryName, chineseName, status = 'active' } = req.body;

  if (!categoryName || !chineseName) {
    return errorResponse(res, 400, '分类名称和中文名称为必填项');
  }

  if (categoryName.length > 40 || chineseName.length > 40) {
    return errorResponse(res, 400, '名称长度不能超过40字符');
  }

  const count = await prisma.category.count();
  const newCategoryId = `CAT${String(count + 1).padStart(6, '0')}`;

  const category = await prisma.category.create({
    data: {
      categoryId: newCategoryId,
      name: categoryName,
      chineseName,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: category.id,
    categoryId: category.categoryId,
    name: category.name,
    chineseName: category.chineseName,
    status: category.status,
    createdAt: category.createdAt,
  }, '创建成功');
}));

// 编辑分类
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { categoryName, chineseName, status } = req.body;

  const existingCategory = await prisma.category.findUnique({ where: { id } });

  if (!existingCategory) {
    return errorResponse(res, 404, '分类不存在');
  }

  if (categoryName && categoryName.length > 40) {
    return errorResponse(res, 400, '分类名称长度不能超过40字符');
  }
  if (chineseName && chineseName.length > 40) {
    return errorResponse(res, 400, '中文名称长度不能超过40字符');
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: categoryName || existingCategory.name,
      chineseName: chineseName || existingCategory.chineseName,
      status: status || existingCategory.status,
    },
  });

  return successResponse(res, {
    id: category.id,
    categoryId: category.categoryId,
    name: category.name,
    chineseName: category.chineseName,
    status: category.status,
    createdAt: category.createdAt,
  }, '更新成功');
}));

// 删除分类
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingCategory = await prisma.category.findUnique({ where: { id } });

  if (!existingCategory) {
    return errorResponse(res, 404, '分类不存在');
  }

  const novelCount = await prisma.novel.count({ where: { categoryId: id } });

  if (novelCount > 0) {
    return errorResponse(res, 400, `该分类下存在${novelCount}本小说，无法删除`);
  }

  await prisma.category.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

export default router;
