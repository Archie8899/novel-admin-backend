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
// 获取小说列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, name, categoryId, copyrightName, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (novelId) {
        where.novelId = novelId;
    }
    if (name) {
        where.OR = [
            { name: { contains: name } },
            { chineseName: { contains: name } }
        ];
    }
    if (categoryId) {
        where.categoryId = categoryId;
    }
    if (copyrightName) {
        where.copyrightCompany = { name: { contains: copyrightName } };
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
    const [novels, total] = await Promise.all([
        prisma_1.default.novel.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                category: {
                    select: { categoryId: true, name: true, chineseName: true }
                },
                copyrightCompany: {
                    select: { companyId: true, name: true }
                },
                createdByUser: {
                    select: { name: true, email: true }
                },
                chapters: {
                    select: { id: true }
                }
            }
        }),
        prisma_1.default.novel.count({ where }),
    ]);
    // 格式化返回数据
    const data = novels.map(novel => ({
        id: novel.id,
        novelId: novel.novelId,
        name: novel.name,
        chineseName: novel.chineseName,
        language: novel.language,
        chapterCount: novel.chapters.length,
        views: (0, helpers_1.formatViews)(novel.views),
        viewsRaw: novel.views,
        category: novel.category,
        copyrightCompany: novel.copyrightCompany,
        isChargeable: novel.isChargeable,
        status: novel.status,
        createdBy: novel.createdByUser?.name || novel.createdByUser?.email || '-',
        createdAt: novel.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个小说详情
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const novel = await prisma_1.default.novel.findUnique({
        where: { id },
        include: {
            category: true,
            copyrightCompany: true,
            createdByUser: {
                select: { name: true, email: true }
            },
            chapters: {
                orderBy: { chapterNumber: 'asc' }
            }
        }
    });
    if (!novel) {
        return (0, helpers_1.errorResponse)(res, 404, '小说不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        ...novel,
        viewsFormatted: (0, helpers_1.formatViews)(novel.views),
    });
}));
// 新建小说
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, chineseName, categoryId, language = 'english', author, copyrightCompanyId, description, authTimeRange, coverImage, isChargeable = true, wordCount, views, status = 'offline' } = req.body;
    // 验证必填字段
    if (!name || !chineseName || !categoryId || !copyrightCompanyId || !coverImage) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 校验分类和版权方是否存在
    const [category, copyrightCompany] = await Promise.all([
        prisma_1.default.category.findUnique({ where: { id: categoryId } }),
        prisma_1.default.copyrightCompany.findUnique({ where: { id: copyrightCompanyId } })
    ]);
    if (!category) {
        return (0, helpers_1.errorResponse)(res, 400, '所选分类不存在');
    }
    if (!copyrightCompany) {
        return (0, helpers_1.errorResponse)(res, 400, '所选版权方不存在');
    }
    // 校验长度
    if (name.length > 120 || chineseName.length > 120) {
        return (0, helpers_1.errorResponse)(res, 400, '小说名称长度不能超过120字符');
    }
    if (author && author.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '作者名称长度不能超过40字符');
    }
    if (description && description.length > 200) {
        return (0, helpers_1.errorResponse)(res, 400, '简介长度不能超过200字符');
    }
    // 生成唯一编号
    const count = await prisma_1.default.novel.count();
    const novelId = `NOV${String(count + 1).padStart(6, '0')}`;
    const novel = await prisma_1.default.novel.create({
        data: {
            novelId,
            name,
            chineseName,
            categoryId,
            language,
            author,
            copyrightCompanyId,
            description,
            authStartTime: authTimeRange?.start ? new Date(authTimeRange.start) : null,
            authEndTime: authTimeRange?.end ? new Date(authTimeRange.end) : null,
            coverImage,
            isChargeable,
            wordCount: wordCount ? parseInt(wordCount) : null,
            views: views ? parseInt(views) : 0,
            manualViews: views ? parseInt(views) : 0,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: novel.id,
        novelId: novel.novelId,
        name: novel.name,
        chineseName: novel.chineseName,
        status: novel.status,
        createdAt: novel.createdAt,
    }, '创建成功');
}));
// 编辑小说
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const existingNovel = await prisma_1.default.novel.findUnique({ where: { id } });
    if (!existingNovel) {
        return (0, helpers_1.errorResponse)(res, 404, '小说不存在');
    }
    // 验证分类和版权方
    if (updateData.categoryId) {
        const category = await prisma_1.default.category.findUnique({ where: { id: updateData.categoryId } });
        if (!category) {
            return (0, helpers_1.errorResponse)(res, 400, '所选分类不存在');
        }
    }
    if (updateData.copyrightCompanyId) {
        const copyrightCompany = await prisma_1.default.copyrightCompany.findUnique({
            where: { id: updateData.copyrightCompanyId }
        });
        if (!copyrightCompany) {
            return (0, helpers_1.errorResponse)(res, 400, '所选版权方不存在');
        }
    }
    // 校验长度
    if (updateData.name && updateData.name.length > 120) {
        return (0, helpers_1.errorResponse)(res, 400, '小说名称长度不能超过120字符');
    }
    if (updateData.author && updateData.author.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '作者名称长度不能超过40字符');
    }
    if (updateData.description && updateData.description.length > 200) {
        return (0, helpers_1.errorResponse)(res, 400, '简介长度不能超过200字符');
    }
    // 处理浏览量：录入值 + 自然量
    let newManualViews = existingNovel.manualViews;
    if (updateData.views !== undefined) {
        newManualViews = parseInt(updateData.views) || 0;
    }
    const novel = await prisma_1.default.novel.update({
        where: { id },
        data: {
            name: updateData.name,
            chineseName: updateData.chineseName,
            categoryId: updateData.categoryId,
            language: updateData.language,
            author: updateData.author,
            copyrightCompanyId: updateData.copyrightCompanyId,
            description: updateData.description,
            authStartTime: updateData.authTimeRange?.start ? new Date(updateData.authTimeRange.start) : undefined,
            authEndTime: updateData.authTimeRange?.end ? new Date(updateData.authTimeRange.end) : undefined,
            coverImage: updateData.coverImage,
            isChargeable: updateData.isChargeable,
            wordCount: updateData.wordCount ? parseInt(updateData.wordCount) : undefined,
            manualViews: newManualViews,
            views: existingNovel.views - existingNovel.manualViews + newManualViews, // 保持自然量不变
            status: updateData.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: novel.id,
        novelId: novel.novelId,
        name: novel.name,
        chineseName: novel.chineseName,
        status: novel.status,
        views: (0, helpers_1.formatViews)(novel.views),
    }, '更新成功');
}));
// 删除小说
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingNovel = await prisma_1.default.novel.findUnique({ where: { id } });
    if (!existingNovel) {
        return (0, helpers_1.errorResponse)(res, 404, '小说不存在');
    }
    // 删除小说及其关联的章节
    await prisma_1.default.$transaction([
        prisma_1.default.chapter.deleteMany({ where: { novelId: id } }),
        prisma_1.default.novel.delete({ where: { id } })
    ]);
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 批量更新状态
router.put('/batch/status', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择要操作的小说');
    }
    if (!['online', 'offline'].includes(status)) {
        return (0, helpers_1.errorResponse)(res, 400, '状态值无效');
    }
    await prisma_1.default.novel.updateMany({
        where: { id: { in: ids } },
        data: { status },
    });
    return (0, helpers_1.successResponse)(res, null, `已更新${ids.length}本小说的状态`);
}));
// 导出小说数据
router.get('/export/data', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate, categoryId, status } = req.query;
    // 构建查询条件（限制导出时间范围为3个月）
    const where = {};
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    where.createdAt = { gte: threeMonthsAgo };
    if (startDate) {
        const start = new Date(startDate);
        if (start > threeMonthsAgo) {
            where.createdAt.gte = start;
        }
    }
    if (endDate) {
        where.createdAt.lte = new Date(endDate);
    }
    if (categoryId) {
        where.categoryId = categoryId;
    }
    if (status) {
        where.status = status;
    }
    const novels = await prisma_1.default.novel.findMany({
        where,
        include: {
            category: { select: { name: true, chineseName: true } },
            copyrightCompany: { select: { name: true } },
            chapters: { select: { chapterNumber: true, title: true, price: true, isChargeable: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    // 转换为导出格式
    const exportData = novels.map(novel => ({
        novelId: novel.novelId,
        name: novel.name,
        chineseName: novel.chineseName,
        category: novel.category.name,
        chineseCategory: novel.category.chineseName,
        copyrightCompany: novel.copyrightCompany.name,
        author: novel.author || '',
        language: novel.language,
        isChargeable: novel.isChargeable ? '是' : '否',
        status: novel.status === 'online' ? '上架' : '下架',
        wordCount: novel.wordCount || 0,
        views: novel.views,
        chapterCount: novel.chapters.length,
        chapters: novel.chapters.map(ch => `${ch.chapterNumber}. ${ch.title} (${ch.isChargeable ? `收费${ch.price}分` : '免费'})`).join('; '),
        createdAt: novel.createdAt.toISOString(),
    }));
    return (0, helpers_1.successResponse)(res, exportData, `共${exportData.length}条数据`);
}));
exports.default = router;
//# sourceMappingURL=novel.js.map