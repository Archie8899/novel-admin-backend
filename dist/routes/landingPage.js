"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../utils/prisma"));
const helpers_1 = require("../utils/helpers");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 获取落地页列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, novelName, mediaChannel, createdBy, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (name) {
        where.name = { contains: name };
    }
    if (novelName) {
        where.novel = {
            OR: [
                { name: { contains: novelName } },
                { chineseName: { contains: novelName } }
            ]
        };
    }
    if (mediaChannel && mediaChannel !== 'all') {
        where.mediaChannel = mediaChannel;
    }
    if (createdBy) {
        where.createdByUser = {
            OR: [
                { name: { contains: createdBy } },
                { email: { contains: createdBy } }
            ]
        };
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
    const [landingPages, total] = await Promise.all([
        prisma_1.default.landingPage.findMany({
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
        prisma_1.default.landingPage.count({ where }),
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
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个落地页
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const landingPage = await prisma_1.default.landingPage.findUnique({
        where: { id },
        include: {
            novel: true,
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!landingPage) {
        return (0, helpers_1.errorResponse)(res, 404, '落地页不存在');
    }
    // 生成预览链接
    const previewUrl = generatePreviewUrl(landingPage);
    return (0, helpers_1.successResponse)(res, {
        ...landingPage,
        previewUrl,
    });
}));
// 新建落地页
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, mediaChannel, language = 'english', os, selectNovel, openChapter = 1 } = req.body;
    // 验证必填字段
    if (!name || !mediaChannel || !os || !selectNovel) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 校验长度
    if (name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '名称长度不能超过40字符');
    }
    // 验证小说是否存在
    const novel = await prisma_1.default.novel.findUnique({
        where: { id: selectNovel }
    });
    if (!novel) {
        return (0, helpers_1.errorResponse)(res, 400, '所选小说不存在');
    }
    // 获取小说章节列表来验证openChapter
    const chapters = await prisma_1.default.chapter.findMany({
        where: { novelId: selectNovel },
        orderBy: { chapterNumber: 'asc' }
    });
    if (chapters.length === 0) {
        return (0, helpers_1.errorResponse)(res, 400, '所选小说暂无章节，请先添加章节');
    }
    const chapterNum = parseInt(openChapter);
    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > chapters.length) {
        return (0, helpers_1.errorResponse)(res, 400, `打开章节必须在1-${chapters.length}之间`);
    }
    const landingPage = await prisma_1.default.landingPage.create({
        data: {
            name,
            mediaChannel,
            language,
            os,
            novelId: selectNovel,
            openChapter: chapterNum,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: landingPage.id,
        name: landingPage.name,
        mediaChannel: landingPage.mediaChannel,
    }, '创建成功');
}));
// 编辑落地页
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, mediaChannel, language, os, selectNovel, openChapter } = req.body;
    const existingLandingPage = await prisma_1.default.landingPage.findUnique({ where: { id } });
    if (!existingLandingPage) {
        return (0, helpers_1.errorResponse)(res, 404, '落地页不存在');
    }
    // 校验长度
    if (name && name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '名称长度不能超过40字符');
    }
    let novelId = existingLandingPage.novelId;
    let chapterNum = existingLandingPage.openChapter;
    if (selectNovel) {
        const novel = await prisma_1.default.novel.findUnique({
            where: { id: selectNovel }
        });
        if (!novel) {
            return (0, helpers_1.errorResponse)(res, 400, '所选小说不存在');
        }
        novelId = selectNovel;
    }
    // 验证章节
    if (openChapter !== undefined) {
        const chapters = await prisma_1.default.chapter.findMany({
            where: { novelId },
            orderBy: { chapterNumber: 'asc' }
        });
        chapterNum = parseInt(openChapter);
        if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > chapters.length) {
            return (0, helpers_1.errorResponse)(res, 400, `打开章节必须在1-${chapters.length}之间`);
        }
    }
    const landingPage = await prisma_1.default.landingPage.update({
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
    return (0, helpers_1.successResponse)(res, {
        id: landingPage.id,
        name: landingPage.name,
        mediaChannel: landingPage.mediaChannel,
    }, '更新成功');
}));
// 删除落地页
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingLandingPage = await prisma_1.default.landingPage.findUnique({ where: { id } });
    if (!existingLandingPage) {
        return (0, helpers_1.errorResponse)(res, 404, '落地页不存在');
    }
    await prisma_1.default.landingPage.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 生成推广链接
router.get('/:id/link', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const landingPage = await prisma_1.default.landingPage.findUnique({
        where: { id },
        include: {
            novel: {
                select: { novelId: true }
            }
        }
    });
    if (!landingPage) {
        return (0, helpers_1.errorResponse)(res, 404, '落地页不存在');
    }
    // 根据媒体渠道生成utm参数
    const utmSource = getUtmSource(landingPage.mediaChannel);
    const baseUrl = `https://realnovel.serealplus.com/reader`;
    const link = `${baseUrl}?bookId=${landingPage.novel.novelId}&chapter=${landingPage.openChapter}&utm_source=${utmSource}&utm_medium=${landingPage.mediaChannel.toLowerCase()}&utm_campaign=landing_${landingPage.id}`;
    return (0, helpers_1.successResponse)(res, {
        link,
        copyText: link,
    });
}));
// 辅助函数：格式化媒体渠道显示
function formatMediaChannel(channel) {
    const channelMap = {
        'Google': 'Google',
        'Facebook': 'Facebook',
        'Apple': 'Apple Search Ads',
        'Tiktok': 'TikTok',
        'Applovin': 'AppLovin',
    };
    return channelMap[channel] || channel;
}
// 辅助函数：获取UTM来源
function getUtmSource(channel) {
    const sourceMap = {
        'Google': 'google',
        'Facebook': 'fb',
        'Apple': 'apple',
        'Tiktok': 'tiktok',
        'Applovin': 'applovin',
    };
    return sourceMap[channel] || channel.toLowerCase();
}
// 辅助函数：生成预览链接
function generatePreviewUrl(landingPage) {
    const baseUrl = `https://realnovel.serealplus.com/reader`;
    const utmSource = getUtmSource(landingPage.mediaChannel);
    return `${baseUrl}?bookId=${landingPage.novel.novelId}&chapter=${landingPage.openChapter}&utm_source=${utmSource}&utm_medium=${landingPage.mediaChannel.toLowerCase()}&utm_campaign=preview_${landingPage.id}`;
}
exports.default = router;
//# sourceMappingURL=landingPage.js.map