import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取版权方列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { companyId, companyName, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (companyId) {
    where.companyId = companyId;
  }
  
  if (companyName) {
    where.name = { contains: companyName as string };
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

  const [companies, total] = await Promise.all([
    prisma.copyrightCompany.findMany({
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
    prisma.copyrightCompany.count({ where }),
  ]);

  // 格式化返回数据
  const data = companies.map(company => ({
    id: company.id,
    companyId: company.companyId,
    name: company.name,
    status: company.status,
    createdBy: company.createdByUser?.name || company.createdByUser?.email || '-',
    createdAt: company.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取有效版权方列表（用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const companies = await prisma.copyrightCompany.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      companyId: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(res, companies);
}));

// 获取单个版权方
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const company = await prisma.copyrightCompany.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!company) {
    return errorResponse(res, 404, '版权方不存在');
  }

  return successResponse(res, {
    id: company.id,
    companyId: company.companyId,
    name: company.name,
    status: company.status,
    createdBy: company.createdByUser?.name || company.createdByUser?.email || '-',
    createdAt: company.createdAt,
  });
}));

// 新建版权方
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { companyName, status = 'active' } = req.body;

  // 验证必填字段
  if (!companyName) {
    return errorResponse(res, 400, '公司名称为必填项');
  }

  // 校验长度
  if (companyName.length > 40) {
    return errorResponse(res, 400, '公司名称长度不能超过40字符');
  }

  // 检查名称是否重复
  const existing = await prisma.copyrightCompany.findFirst({
    where: { name: companyName }
  });

  if (existing) {
    return errorResponse(res, 400, '该公司名称已存在');
  }

  // 生成唯一编号
  const count = await prisma.copyrightCompany.count();
  const companyId = `CPY${String(count + 1).padStart(6, '0')}`;

  const company = await prisma.copyrightCompany.create({
    data: {
      companyId,
      name: companyName,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: company.id,
    companyId: company.companyId,
    name: company.name,
    status: company.status,
    createdAt: company.createdAt,
  }, '创建成功');
}));

// 编辑版权方
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyName, status } = req.body;

  const existingCompany = await prisma.copyrightCompany.findUnique({ where: { id } });

  if (!existingCompany) {
    return errorResponse(res, 404, '版权方不存在');
  }

  // 校验长度
  if (companyName && companyName.length > 40) {
    return errorResponse(res, 400, '公司名称长度不能超过40字符');
  }

  // 检查名称是否重复
  if (companyName && companyName !== existingCompany.name) {
    const existing = await prisma.copyrightCompany.findFirst({
      where: { name: companyName }
    });

    if (existing) {
      return errorResponse(res, 400, '该公司名称已存在');
    }
  }

  const company = await prisma.copyrightCompany.update({
    where: { id },
    data: {
      name: companyName || existingCompany.name,
      status: status || existingCompany.status,
    },
  });

  return successResponse(res, {
    id: company.id,
    companyId: company.companyId,
    name: company.name,
    status: company.status,
    createdAt: company.createdAt,
  }, '更新成功');
}));

// 删除版权方
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingCompany = await prisma.copyrightCompany.findUnique({ where: { id } });

  if (!existingCompany) {
    return errorResponse(res, 404, '版权方不存在');
  }

  // 检查是否有关联的小说
  const novelCount = await prisma.novel.count({ where: { copyrightCompanyId: id } });

  if (novelCount > 0) {
    return errorResponse(res, 400, `该版权方下存在${novelCount}本小说，无法删除`);
  }

  await prisma.copyrightCompany.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

export default router;
