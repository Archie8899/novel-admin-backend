import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取落地页列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, novelName, mediaChannel, createdBy, startDate, endDate } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  // 构建查询条件
  const where: any = {};
  
  if (name) {
    where.name = { contains: name as string };
  }
  
  if (novelName) {
    where.novel = {
      OR: [
        { name: { contains: novelName as string } },
        { chineseName: { contains: novelName as string } }
      ]
    };
  }
  
  if (mediaChannel && mediaChannel !== 'all') {
    where.mediaChannel = mediaChannel;
  }
  
  if (createdBy) {
    where.createdByUser = {
      OR: [
        { name: { contains: createdBy as string } },
        { email: { contains: createdBy as string } }
      ]
    };
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

  const [landingPages, total] = await Promise.all([
    prisma.landingPage.findMany({
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
    prisma.landingPage.count({ where }),
  ]);

  // 格式化返回数据
  const data = landingPages.map(lp => ({
    id: lp.id,
    name: lp.name,
    novelId: lp.novelId,
    novel: lp.novel,
    os: lp.os,
    openChapter: lp.openChapter,
    mediaChannel: lp.mediaChannel,
    mediaChannelDisplay: formatMediaChannel(lp.mediaChannel),
    language: lp.language,
    createdBy: lp.createdByUser?.name || lp.createdByUser?.email || '-',
    createdAt: lp.createdAt,
  }));

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取单个落地页
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const landingPage = await prisma.landingPage.findUnique({
    where: { id },
    include: {
      novel: true,
      createdByUser: {
        select: { name: true, email: true }
      }
    }
  });

  if (!landingPage) {
    return errorResponse(res, 404, '落地页不存在');
  }

  // 生成预览链接
  const previewUrl = generatePreviewUrl(landingPage);

  return successResponse(res, {
    ...landingPage,
    previewUrl,
  });
}));

// 新建落地页
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, mediaChannel, language = 'english', os, selectNovel, openChapter = 1 } = req.body;

  // 验证必填字段
  if (!name || !mediaChannel || !os || !selectNovel) {
    return errorResponse(res, 400, '请填写必填项');
  }

  // 校验长度
  if (name.length > 40) {
    return errorResponse(res, 400, '名称长度不能超过40字符');
  }

  // 验证小说是否存在
  const novel = await prisma.novel.findUnique({
    where: { id: selectNovel }
  });

  if (!novel) {
    return errorResponse(res, 400, '所选小说不存在');
  }

  // 获取小说章节列表来验证openChapter
  const chapters = await prisma.chapter.findMany({
    where: { novelId: selectNovel },
    orderBy: { chapterNumber: 'asc' }
  });

  if (chapters.length === 0) {
    return errorResponse(res, 400, '所选小说暂无章节，请先添加章节');
  }

  const chapterNum = parseInt(openChapter);
  if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > chapters.length) {
    return errorResponse(res, 400, `打开章节必须在1-${chapters.length}之间`);
  }

  const landingPage = await prisma.landingPage.create({
    data: {
      name,
      mediaChannel,
      language,
      os,
      novelId: selectNovel,
      openChapter: chapterNum,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: landingPage.id,
    name: landingPage.name,
    mediaChannel: landingPage.mediaChannel,
  }, '创建成功');
}));

// 编辑落地页
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, mediaChannel, language, os, selectNovel, openChapter } = req.body;

  const existingLandingPage = await prisma.landingPage.findUnique({ where: { id } });

  if (!existingLandingPage) {
    return errorResponse(res, 404, '落地页不存在');
  }

  // 校验长度
  if (name && name.length > 40) {
    return errorResponse(res, 400, '名称长度不能超过40字符');
  }

  let novelId = existingLandingPage.novelId;
  let chapterNum = existingLandingPage.openChapter;

  if (selectNovel) {
    const novel = await prisma.novel.findUnique({
      where: { id: selectNovel }
    });

    if (!novel) {
      return errorResponse(res, 400, '所选小说不存在');
    }

    novelId = selectNovel;
  }

  // 验证章节
  if (openChapter !== undefined) {
    const chapters = await prisma.chapter.findMany({
      where: { novelId },
      orderBy: { chapterNumber: 'asc' }
    });

    chapterNum = parseInt(openChapter);
    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > chapters.length) {
      return errorResponse(res, 400, `打开章节必须在1-${chapters.length}之间`);
    }
  }

  const landingPage = await prisma.landingPage.update({
    where: { id },
    data: {
      name: name || existingLandingPage.name,
      mediaChannel: mediaChannel || existingLandingPage.mediaChannel,
      language: language || existingLandingPage.language,
      os: os || existingLandingPage.os,
      novelId,
      openChapter: chapterNum,
    },
  });

  return successResponse(res, {
    id: landingPage.id,
    name: landingPage.name,
    mediaChannel: landingPage.mediaChannel,
  }, '更新成功');
}));

// 删除落地页
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const existingLandingPage = await prisma.landingPage.findUnique({ where: { id } });

  if (!existingLandingPage) {
    return errorResponse(res, 404, '落地页不存在');
  }

  await prisma.landingPage.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

// 生成推广链接
router.get('/:id/link', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const landingPage = await prisma.landingPage.findUnique({
    where: { id },
    include: {
      novel: {
        select: { novelId: true }
      }
    }
  });

  if (!landingPage) {
    return errorResponse(res, 404, '落地页不存在');
  }

  // 根据媒体渠道生成utm参数
  const utmSource = getUtmSource(landingPage.mediaChannel);

  const baseUrl = `https://realnovel.serealplus.com/reader`;
  const link = `${baseUrl}?bookId=${landingPage.novel.novelId}&chapter=${landingPage.openChapter}&utm_source=${utmSource}&utm_medium=${landingPage.mediaChannel.toLowerCase()}&utm_campaign=landing_${landingPage.id}`;

  return successResponse(res, {
    link,
    copyText: link,
  });
}));

// 辅助函数：格式化媒体渠道显示
function formatMediaChannel(channel: string): string {
  const channelMap: Record<string, string> = {
    'Google': 'Google',
    'Facebook': 'Facebook',
    'Apple': 'Apple Search Ads',
    'Tiktok': 'TikTok',
    'Applovin': 'AppLovin',
  };
  return channelMap[channel] || channel;
}

// 辅助函数：获取UTM来源
function getUtmSource(channel: string): string {
  const sourceMap: Record<string, string> = {
    'Google': 'google',
    'Facebook': 'fb',
    'Apple': 'apple',
    'Tiktok': 'tiktok',
    'Applovin': 'applovin',
  };
  return sourceMap[channel] || channel.toLowerCase();
}

// 辅助函数：生成预览链接
function generatePreviewUrl(landingPage: any): string {
  const baseUrl = `https://realnovel.serealplus.com/reader`;
  const utmSource = getUtmSource(landingPage.mediaChannel);
  return `${baseUrl}?bookId=${landingPage.novel.novelId}&chapter=${landingPage.openChapter}&utm_source=${utmSource}&utm_medium=${landingPage.mediaChannel.toLowerCase()}&utm_campaign=preview_${landingPage.id}`;
}

export default router;
