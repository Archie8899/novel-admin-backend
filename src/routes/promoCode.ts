import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取口令列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { novelId, channelName, code, status, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (novelId) {
    where.novelId = novelId;
  }
  
  if (channelName) {
    where.channelName = { contains: channelName as string };
  }
  
  if (code) {
    where.code = code;
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

  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        novel: {
          select: { novelId: true, name: true, chineseName: true }
        },
        createdByUser: {
          select: { name: true, email: true }
        }
      }
    }),
    prisma.promoCode.count({ where }),
  ]);

  // 格式化返回数据
  const data = promoCodes.map(pc => ({
    id: pc.id,
    codeId: pc.codeId,
    novelId: pc.novelId,
    novel: pc.novel,
    channelName: pc.channelName,
    code: pc.code,
    status: pc.status,
    statusDisplay: pc.status === 'active' ? '有效' : '无效',
    createdBy: pc.createdByUser?.name || pc.createdByUser?.email || '-',
    createdAt: pc.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 新建口令
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { selectNovel, channelName, quantity = 1 } = req.body;

  // 验证必填字段
  if (!selectNovel || !channelName) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 验证小说是否存在
  const novel = await prisma.novel.findUnique({
    where: { id: selectNovel }
  });

  if (!novel) {
    return errorResponse(res, 400, '所选小说不存在');
  }

  // 校验数量
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty < 1 || qty > 99) {
    return errorResponse(res, 400, '生成数量必须在1-99之间');
  }

  // 生成口令
  const createdCodes = [];
  const currentCount = await prisma.promoCode.count();
  
  for (let i = 0; i < qty; i++) {
    const codeId = `PC${String(currentCount + i + 1).padStart(6, '0')}`;
    const code = generatePromoCode();

    const promoCode = await prisma.promoCode.create({
      data: {
        codeId,
        novelId: selectNovel,
        channelName,
        code,
        status: 'active',
        createdBy: req.user!.userId,
      },
    });

    createdCodes.push(promoCode);
  }

  return successResponse(res, {
    count: createdCodes.length,
    codes: createdCodes.map(c => ({
      codeId: c.codeId,
      code: c.code,
    })),
  }, `成功生成${createdCodes.length}个口令`);
}));

// 批量更新口令状态
router.put('/batch/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 400, '请选择要操作的口令');
  }

  if (!['active', 'inactive'].includes(status)) {
    return errorResponse(res, 400, '状态值无效');
  }

  await prisma.promoCode.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return successResponse(res, null, `已更新${ids.length}个口令的状态`);
}));

// 删除口令
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingPromoCode = await prisma.promoCode.findUnique({ where: { id } });

  if (!existingPromoCode) {
    return errorResponse(res, 404, '口令不存在');
  }

  await prisma.promoCode.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 导出口令
router.get('/export/data', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { novelId, channelName, status, startDate, endDate } = req.query;

  // 构建查询条件
  const where: any = {};
  
  if (novelId) {
    where.novelId = novelId;
  }
  
  if (channelName) {
    where.channelName = { contains: channelName as string };
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

  const promoCodes = await prisma.promoCode.findMany({
    where,
    include: {
      novel: {
        select: { novelId: true, name: true }
      },
      createdByUser: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  // 转换为导出格式
  const exportData = promoCodes.map(pc => ({
    codeId: pc.codeId,
    novelId: pc.novel.novelId,
    novelName: pc.novel.name,
    channelName: pc.channelName,
    code: pc.code,
    status: pc.status === 'active' ? '有效' : '无效',
    createdBy: pc.createdByUser?.name || '-',
    createdAt: pc.createdAt.toISOString(),
  }));

  return successResponse(res, exportData, `共${exportData.length}条数据`);
}));

// 辅助函数：生成随机口令
function generatePromoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default router;
