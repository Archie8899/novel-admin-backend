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
// 获取章节列表（按小说）
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, chapterId, title, isChargeable, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (novelId) {
        where.novelId = novelId;
    }
    if (chapterId) {
        where.chapterId = chapterId;
    }
    if (title) {
        where.title = { contains: title };
    }
    if (isChargeable && isChargeable !== 'all') {
        where.isChargeable = isChargeable === 'true';
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
    const [chapters, total] = await Promise.all([
        prisma_1.default.chapter.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { chapterNumber: 'asc' }, // 按章节数值正序
            include: {
                createdByUser: {
                    select: { name: true, email: true }
                }
            }
        }),
        prisma_1.default.chapter.count({ where }),
    ]);
    // 格式化返回数据
    const data = chapters.map(chapter => ({
        id: chapter.id,
        chapterId: chapter.chapterId,
        novelId: chapter.novelId,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        isChargeable: chapter.isChargeable,
        price: chapter.price,
        priceDisplay: chapter.isChargeable ? `${chapter.price}分` : '-',
        createdBy: chapter.createdByUser?.name || chapter.createdByUser?.email || '-',
        createdAt: chapter.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个章节详情
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const chapter = await prisma_1.default.chapter.findUnique({
        where: { id },
        include: {
            novel: {
                select: { novelId: true, name: true, chineseName: true }
            },
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!chapter) {
        return (0, helpers_1.errorResponse)(res, 404, '章节不存在');
    }
    return (0, helpers_1.successResponse)(res, chapter);
}));
// 新建章节
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, title, chapterNumber, isChargeable = true, price, content } = req.body;
    // 验证必填字段
    if (!novelId || !title || chapterNumber === undefined) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 验证小说是否存在
    const novel = await prisma_1.default.novel.findUnique({ where: { id: novelId } });
    if (!novel) {
        return (0, helpers_1.errorResponse)(res, 400, '所选小说不存在');
    }
    // 校验章节序号
    const chapterNum = parseInt(chapterNumber);
    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > 99) {
        return (0, helpers_1.errorResponse)(res, 400, '章节序号必须在1-99之间');
    }
    // 检查同小说下章节序号是否重复
    const existingChapter = await prisma_1.default.chapter.findFirst({
        where: { novelId, chapterNumber: chapterNum }
    });
    if (existingChapter) {
        return (0, helpers_1.errorResponse)(res, 400, `该小说下章节${chapterNum}已存在，请勿重复创建`);
    }
    // 校验长度
    if (title.length > 120) {
        return (0, helpers_1.errorResponse)(res, 400, '章节标题长度不能超过120字符');
    }
    // 验证收费章节必须有价格
    if (isChargeable && (!price || price < 1 || price > 9999)) {
        return (0, helpers_1.errorResponse)(res, 400, '收费章节价格必须在1-9999之间');
    }
    // 生成唯一编号
    const count = await prisma_1.default.chapter.count();
    const chapterId = `CHP${String(count + 1).padStart(6, '0')}`;
    const chapter = await prisma_1.default.chapter.create({
        data: {
            chapterId,
            novelId,
            title,
            chapterNumber: chapterNum,
            isChargeable,
            price: isChargeable ? parseInt(price) : null,
            content: content || '',
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: chapter.id,
        chapterId: chapter.chapterId,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
    }, '创建成功');
}));
// 编辑章节
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { title, chapterNumber, isChargeable, price, content } = req.body;
    const existingChapter = await prisma_1.default.chapter.findUnique({ where: { id } });
    if (!existingChapter) {
        return (0, helpers_1.errorResponse)(res, 404, '章节不存在');
    }
    // 校验章节序号
    let newChapterNumber = existingChapter.chapterNumber;
    if (chapterNumber !== undefined) {
        newChapterNumber = parseInt(chapterNumber);
        if (isNaN(newChapterNumber) || newChapterNumber < 1 || newChapterNumber > 99) {
            return (0, helpers_1.errorResponse)(res, 400, '章节序号必须在1-99之间');
        }
        // 检查是否与同小说下其他章节重复
        if (newChapterNumber !== existingChapter.chapterNumber) {
            const duplicate = await prisma_1.default.chapter.findFirst({
                where: {
                    novelId: existingChapter.novelId,
                    chapterNumber: newChapterNumber,
                    id: { not: id }
                }
            });
            if (duplicate) {
                return (0, helpers_1.errorResponse)(res, 400, `该小说下章节${newChapterNumber}已存在`);
            }
        }
    }
    // 校验长度
    if (title && title.length > 120) {
        return (0, helpers_1.errorResponse)(res, 400, '章节标题长度不能超过120字符');
    }
    // 验证收费章节必须有价格
    const finalIsChargeable = isChargeable !== undefined ? isChargeable : existingChapter.isChargeable;
    let finalPrice = existingChapter.price;
    if (finalIsChargeable) {
        if (price !== undefined) {
            if (price < 1 || price > 9999) {
                return (0, helpers_1.errorResponse)(res, 400, '章节价格必须在1-9999之间');
            }
            finalPrice = parseInt(price);
        }
        else if (!existingChapter.price) {
            return (0, helpers_1.errorResponse)(res, 400, '收费章节必须有价格');
        }
    }
    else {
        finalPrice = null;
    }
    const chapter = await prisma_1.default.chapter.update({
        where: { id },
        data: {
            title: title || existingChapter.title,
            chapterNumber: newChapterNumber,
            isChargeable: finalIsChargeable,
            price: finalPrice,
            content: content !== undefined ? content : existingChapter.content,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: chapter.id,
        chapterId: chapter.chapterId,
        title: chapter.title,
        chapterNumber: chapter.chapterNumber,
        isChargeable: chapter.isChargeable,
        price: chapter.price,
    }, '更新成功');
}));
// 删除章节
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingChapter = await prisma_1.default.chapter.findUnique({ where: { id } });
    if (!existingChapter) {
        return (0, helpers_1.errorResponse)(res, 404, '章节不存在');
    }
    await prisma_1.default.chapter.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 批量导入章节
router.post('/import', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, chapters } = req.body;
    if (!novelId || !chapters || !Array.isArray(chapters)) {
        return (0, helpers_1.errorResponse)(res, 400, '请提供小说ID和章节数据');
    }
    const novel = await prisma_1.default.novel.findUnique({ where: { id: novelId } });
    if (!novel) {
        return (0, helpers_1.errorResponse)(res, 400, '所选小说不存在');
    }
    const currentCount = await prisma_1.default.chapter.count({ where: { novelId } });
    const successList = [];
    const errorList = [];
    for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        // 检查章节序号是否重复
        const existing = await prisma_1.default.chapter.findFirst({
            where: { novelId, chapterNumber: parseInt(ch.chapterNumber) }
        });
        if (existing) {
            errorList.push({
                row: i + 1,
                chapterNumber: ch.chapterNumber,
                error: `章节${ch.chapterNumber}已存在`
            });
            continue;
        }
        // 生成编号
        const count = await prisma_1.default.chapter.count();
        const chapterId = `CHP${String(count + 1).padStart(6, '0')}`;
        try {
            const chapter = await prisma_1.default.chapter.create({
                data: {
                    chapterId,
                    novelId,
                    title: ch.title || `第${ch.chapterNumber}章`,
                    chapterNumber: parseInt(ch.chapterNumber),
                    isChargeable: ch.isChargeable !== false,
                    price: ch.isChargeable !== false ? (parseInt(ch.price) || 10) : null,
                    content: ch.content || '',
                    createdBy: req.user.userId,
                },
            });
            successList.push(chapter);
        }
        catch (e) {
            errorList.push({
                row: i + 1,
                chapterNumber: ch.chapterNumber,
                error: '创建失败'
            });
        }
    }
    return (0, helpers_1.successResponse)(res, {
        successCount: successList.length,
        errorCount: errorList.length,
        errors: errorList,
    }, `导入完成：成功${successList.length}条，失败${errorList.length}条`);
}));
exports.default = router;
//# sourceMappingURL=chapter.js.map