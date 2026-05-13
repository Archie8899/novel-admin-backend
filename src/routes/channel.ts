import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取渠道列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, secret, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (secret) {
    where.secret = secret;
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

  const [channels, total] = await Promise.all([
    prisma.channel.findMany({
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
    prisma.channel.count({ where }),
  ]);

  // 格式化返回数据
  const data = channels.map(ch => ({
    id: ch.id,
    channelId: ch.channelId,
    name: ch.name,
    secret: ch.secret,
    createdBy: ch.createdByUser?.name || ch.createdByUser?.email || '-',
    createdAt: ch.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取所有渠道名称（用于下拉选择）
router.get('/names', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const channels = await prisma.channel.findMany({
    select: {
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  return successResponse(res, channels.map(ch => ch.name));
}));

// 获取单个渠道
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!channel) {
    return errorResponse(res, 404, '渠道不存在');
  }

  return successResponse(res, {
    id: channel.id,
    channelId: channel.channelId,
    name: channel.name,
    secret: channel.secret,
    createdBy: channel.createdByUser?.name || channel.createdByUser?.email || '-',
    createdAt: channel.createdAt,
  });
}));

// 新建渠道
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { channelName, channelSecret } = req.body;

  // 验证必填字段
  if (!channelName || !channelSecret) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 校验长度
  if (channelName.length > 40) {
    return errorResponse(res, 400, '渠道名称长度不能超过40字符');
  }

  if (channelSecret.length > 80) {
    return errorResponse(res, 400, '渠道密钥长度不能超过80字符');
  }

  // 检查名称是否重复
  const existing = await prisma.channel.findFirst({
    where: { name: channelName }
  });

  if (existing) {
    return errorResponse(res, 400, '该渠道名称已存在');
  }

  // 生成唯一编号
  const count = await prisma.channel.count();
  const channelId = `CH${String(count + 1).padStart(6, '0')}`;

  const channel = await prisma.channel.create({
    data: {
      channelId,
      name: channelName,
      secret: channelSecret,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: channel.id,
    channelId: channel.channelId,
    name: channel.name,
  }, '创建成功');
}));

// 编辑渠道
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { channelName, channelSecret } = req.body;

  const existingChannel = await prisma.channel.findUnique({ where: { id } });

  if (!existingChannel) {
    return errorResponse(res, 404, '渠道不存在');
  }

  // 校验长度
  if (channelName && channelName.length > 40) {
    return errorResponse(res, 400, '渠道名称长度不能超过40字符');
  }

  if (channelSecret && channelSecret.length > 80) {
    return errorResponse(res, 400, '渠道密钥长度不能超过80字符');
  }

  // 检查名称是否重复
  if (channelName && channelName !== existingChannel.name) {
    const existing = await prisma.channel.findFirst({
      where: { name: channelName }
    });

    if (existing) {
      return errorResponse(res, 400, '该渠道名称已存在');
    }
  }

  const channel = await prisma.channel.update({
    where: { id },
    data: {
      name: channelName || existingChannel.name,
      secret: channelSecret || existingChannel.secret,
    },
  });

  return successResponse(res, {
    id: channel.id,
    channelId: channel.channelId,
    name: channel.name,
  }, '更新成功');
}));

// 删除渠道
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingChannel = await prisma.channel.findUnique({ where: { id } });

  if (!existingChannel) {
    return errorResponse(res, 404, '渠道不存在');
  }

  // 检查是否有关联的口令
  const promoCodeCount = await prisma.promoCode.count({
    where: { channelName: existingChannel.name }
  });

  if (promoCodeCount > 0) {
    return errorResponse(res, 400, `该渠道下存在${promoCodeCount}个口令，无法删除`);
  }

  await prisma.channel.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

export default router;
