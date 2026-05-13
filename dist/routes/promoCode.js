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
// 获取口令列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, channelName, code, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (novelId) {
        where.novelId = novelId;
    }
    if (channelName) {
        where.channelName = { contains: channelName };
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
            where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
            where.createdAt.lte = new Date(endDate);
        }
    }
    const [promoCodes, total] = await Promise.all([
        prisma_1.default.promoCode.findMany({
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
        prisma_1.default.promoCode.count({ where }),
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
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 新建口令
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { selectNovel, channelName, quantity = 1 } = req.body;
    // 验证必填字段
    if (!selectNovel || !channelName) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 验证小说是否存在
    const novel = await prisma_1.default.novel.findUnique({
        where: { id: selectNovel }
    });
    if (!novel) {
        return (0, helpers_1.errorResponse)(res, 400, '所选小说不存在');
    }
    // 校验数量
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 99) {
        return (0, helpers_1.errorResponse)(res, 400, '生成数量必须在1-99之间');
    }
    // 生成口令
    const createdCodes = [];
    const currentCount = await prisma_1.default.promoCode.count();
    for (let i = 0; i < qty; i++) {
        const codeId = `PC${String(currentCount + i + 1).padStart(6, '0')}`;
        const code = generatePromoCode();
        const promoCode = await prisma_1.default.promoCode.create({
            data: {
                codeId,
                novelId: selectNovel,
                channelName,
                code,
                status: 'active',
                createdBy: req.user.userId,
            },
        });
        createdCodes.push(promoCode);
    }
    return (0, helpers_1.successResponse)(res, {
        count: createdCodes.length,
        codes: createdCodes.map(c => ({
            codeId: c.codeId,
            code: c.code,
        })),
    }, `成功生成${createdCodes.length}个口令`);
}));
// 批量更新口令状态
router.put('/batch/status', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择要操作的口令');
    }
    if (!['active', 'inactive'].includes(status)) {
        return (0, helpers_1.errorResponse)(res, 400, '状态值无效');
    }
    await prisma_1.default.promoCode.updateMany({
        where: { id: { in: ids } },
        data: { status },
    });
    return (0, helpers_1.successResponse)(res, null, `已更新${ids.length}个口令的状态`);
}));
// 删除口令
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingPromoCode = await prisma_1.default.promoCode.findUnique({ where: { id } });
    if (!existingPromoCode) {
        return (0, helpers_1.errorResponse)(res, 404, '口令不存在');
    }
    await prisma_1.default.promoCode.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 导出口令
router.get('/export/data', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { novelId, channelName, status, startDate, endDate } = req.query;
    // 构建查询条件
    const where = {};
    if (novelId) {
        where.novelId = novelId;
    }
    if (channelName) {
        where.channelName = { contains: channelName };
    }
    if (status) {
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
    const promoCodes = await prisma_1.default.promoCode.findMany({
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
    return (0, helpers_1.successResponse)(res, exportData, `共${exportData.length}条数据`);
}));
// 辅助函数：生成随机口令
function generatePromoCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
exports.default = router;
//# sourceMappingURL=promoCode.js.map