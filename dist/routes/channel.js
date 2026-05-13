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
// 获取渠道列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, secret, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (name) {
        where.name = { contains: name };
    }
    if (secret) {
        where.secret = secret;
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
    const [channels, total] = await Promise.all([
        prisma_1.default.channel.findMany({
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
        prisma_1.default.channel.count({ where }),
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
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取所有渠道名称（用于下拉选择）
router.get('/names', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const channels = await prisma_1.default.channel.findMany({
        select: {
            name: true,
        },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, channels.map(ch => ch.name));
}));
// 获取单个渠道
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const channel = await prisma_1.default.channel.findUnique({
        where: { id },
        include: {
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!channel) {
        return (0, helpers_1.errorResponse)(res, 404, '渠道不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        secret: channel.secret,
        createdBy: channel.createdByUser?.name || channel.createdByUser?.email || '-',
        createdAt: channel.createdAt,
    });
}));
// 新建渠道
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { channelName, channelSecret } = req.body;
    // 验证必填字段
    if (!channelName || !channelSecret) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 校验长度
    if (channelName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '渠道名称长度不能超过40字符');
    }
    if (channelSecret.length > 80) {
        return (0, helpers_1.errorResponse)(res, 400, '渠道密钥长度不能超过80字符');
    }
    // 检查名称是否重复
    const existing = await prisma_1.default.channel.findFirst({
        where: { name: channelName }
    });
    if (existing) {
        return (0, helpers_1.errorResponse)(res, 400, '该渠道名称已存在');
    }
    // 生成唯一编号
    const count = await prisma_1.default.channel.count();
    const channelId = `CH${String(count + 1).padStart(6, '0')}`;
    const channel = await prisma_1.default.channel.create({
        data: {
            channelId,
            name: channelName,
            secret: channelSecret,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
    }, '创建成功');
}));
// 编辑渠道
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { channelName, channelSecret } = req.body;
    const existingChannel = await prisma_1.default.channel.findUnique({ where: { id } });
    if (!existingChannel) {
        return (0, helpers_1.errorResponse)(res, 404, '渠道不存在');
    }
    // 校验长度
    if (channelName && channelName.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '渠道名称长度不能超过40字符');
    }
    if (channelSecret && channelSecret.length > 80) {
        return (0, helpers_1.errorResponse)(res, 400, '渠道密钥长度不能超过80字符');
    }
    // 检查名称是否重复
    if (channelName && channelName !== existingChannel.name) {
        const existing = await prisma_1.default.channel.findFirst({
            where: { name: channelName }
        });
        if (existing) {
            return (0, helpers_1.errorResponse)(res, 400, '该渠道名称已存在');
        }
    }
    const channel = await prisma_1.default.channel.update({
        where: { id },
        data: {
            name: channelName || existingChannel.name,
            secret: channelSecret || existingChannel.secret,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
    }, '更新成功');
}));
// 删除渠道
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingChannel = await prisma_1.default.channel.findUnique({ where: { id } });
    if (!existingChannel) {
        return (0, helpers_1.errorResponse)(res, 404, '渠道不存在');
    }
    // 检查是否有关联的口令
    const promoCodeCount = await prisma_1.default.promoCode.count({
        where: { channelName: existingChannel.name }
    });
    if (promoCodeCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该渠道下存在${promoCodeCount}个口令，无法删除`);
    }
    await prisma_1.default.channel.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=channel.js.map