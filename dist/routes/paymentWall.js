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
// 获取支付墙列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, userSegmentName, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (name) {
        where.name = { contains: name };
    }
    if (userSegmentName) {
        where.userSegment = { name: { contains: userSegmentName } };
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
    const [paymentWalls, total] = await Promise.all([
        prisma_1.default.paymentWall.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [
                { sort: 'asc' }, // 按排序正序
                { createdAt: 'desc' } // 相同则按创建时间倒序
            ],
            include: {
                userSegment: {
                    select: { segmentId: true, name: true }
                },
                createdByUser: {
                    select: { name: true, email: true }
                },
                _count: {
                    select: { products: true }
                }
            }
        }),
        prisma_1.default.paymentWall.count({ where }),
    ]);
    // 格式化返回数据
    const data = paymentWalls.map(pw => ({
        id: pw.id,
        paymentWallId: pw.paymentWallId,
        name: pw.name,
        userSegment: pw.userSegment,
        sort: pw.sort,
        status: pw.status,
        statusDisplay: pw.status === 'active' ? '有效' : '无效',
        productCount: pw._count.products,
        createdBy: pw.createdByUser?.name || pw.createdByUser?.email || '-',
        createdAt: pw.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个支付墙详情
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const paymentWall = await prisma_1.default.paymentWall.findUnique({
        where: { id },
        include: {
            userSegment: true,
            createdByUser: {
                select: { name: true, email: true }
            },
            products: {
                include: {
                    product: true
                }
            }
        }
    });
    if (!paymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    return (0, helpers_1.successResponse)(res, paymentWall);
}));
// 新建支付墙
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, userSegmentId, sort = 0, status = 'active' } = req.body;
    // 验证必填字段
    if (!name || !userSegmentId) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 校验长度
    if (name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '支付墙名称长度不能超过40字符');
    }
    // 校验排序值
    const sortNum = parseInt(sort);
    if (isNaN(sortNum) || sortNum < 0 || sortNum > 999) {
        return (0, helpers_1.errorResponse)(res, 400, '排序值必须在0-999之间');
    }
    // 验证用户分层是否存在
    const userSegment = await prisma_1.default.userSegment.findUnique({
        where: { id: userSegmentId }
    });
    if (!userSegment) {
        return (0, helpers_1.errorResponse)(res, 400, '所选用户分层不存在');
    }
    // 生成唯一编号
    const count = await prisma_1.default.paymentWall.count();
    const paymentWallId = `PW${String(count + 1).padStart(6, '0')}`;
    const paymentWall = await prisma_1.default.paymentWall.create({
        data: {
            paymentWallId,
            name,
            userSegmentId,
            sort: sortNum,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: paymentWall.id,
        paymentWallId: paymentWall.paymentWallId,
        name: paymentWall.name,
        sort: paymentWall.sort,
        status: paymentWall.status,
    }, '创建成功');
}));
// 编辑支付墙
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, userSegmentId, sort, status } = req.body;
    const existingPaymentWall = await prisma_1.default.paymentWall.findUnique({ where: { id } });
    if (!existingPaymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    // 校验长度
    if (name && name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '支付墙名称长度不能超过40字符');
    }
    // 校验排序值
    let newSort = existingPaymentWall.sort;
    if (sort !== undefined) {
        newSort = parseInt(sort);
        if (isNaN(newSort) || newSort < 0 || newSort > 999) {
            return (0, helpers_1.errorResponse)(res, 400, '排序值必须在0-999之间');
        }
    }
    // 验证用户分层是否存在
    if (userSegmentId) {
        const userSegment = await prisma_1.default.userSegment.findUnique({
            where: { id: userSegmentId }
        });
        if (!userSegment) {
            return (0, helpers_1.errorResponse)(res, 400, '所选用户分层不存在');
        }
    }
    const paymentWall = await prisma_1.default.paymentWall.update({
        where: { id },
        data: {
            name: name || existingPaymentWall.name,
            userSegmentId: userSegmentId || existingPaymentWall.userSegmentId,
            sort: newSort,
            status: status || existingPaymentWall.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: paymentWall.id,
        paymentWallId: paymentWall.paymentWallId,
        name: paymentWall.name,
        sort: paymentWall.sort,
        status: paymentWall.status,
    }, '更新成功');
}));
// 删除支付墙
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingPaymentWall = await prisma_1.default.paymentWall.findUnique({ where: { id } });
    if (!existingPaymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    // 删除关联的商品配置
    await prisma_1.default.$transaction([
        prisma_1.default.paymentWallProduct.deleteMany({ where: { paymentWallId: id } }),
        prisma_1.default.paymentWall.delete({ where: { id } })
    ]);
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// ===== 支付墙商品配置 =====
// 获取支付墙商品列表
router.get('/:id/products', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { type } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    const paymentWall = await prisma_1.default.paymentWall.findUnique({ where: { id } });
    if (!paymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    const where = { paymentWallId: id };
    if (type) {
        where.type = type;
    }
    const [products, total] = await Promise.all([
        prisma_1.default.paymentWallProduct.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [
                { sort: 'asc' },
                { createdAt: 'desc' }
            ],
            include: {
                product: true,
                createdByUser: {
                    select: { name: true, email: true }
                }
            }
        }),
        prisma_1.default.paymentWallProduct.count({ where }),
    ]);
    // 格式化返回数据
    const data = products.map(pwp => ({
        id: pwp.id,
        paymentWallId: pwp.paymentWallId,
        sort: pwp.sort,
        product: {
            id: pwp.product.id,
            productId: pwp.product.productId,
            name: pwp.product.name,
            os: pwp.product.os,
            price: `$${(pwp.product.price / 100).toFixed(2)}`,
            coins: pwp.product.coins,
            subscriptionDuration: pwp.product.subscriptionDuration,
        },
        bonusCoins: pwp.bonusCoins,
        isDefaultSelected: pwp.isDefaultSelected,
        showBadge: pwp.showBadge,
        marketingText: pwp.marketingText,
        subscriptionText: pwp.subscriptionText,
        createdBy: pwp.createdByUser?.name || pwp.createdByUser?.email || '-',
        createdAt: pwp.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 新建支付墙商品配置
router.post('/:id/products', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { productId, bonusCoins, isDefaultSelected = false, showBadge = false, marketingText, subscriptionText, sort = 0 } = req.body;
    const paymentWall = await prisma_1.default.paymentWall.findUnique({ where: { id } });
    if (!paymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    // 验证必填字段
    if (!productId) {
        return (0, helpers_1.errorResponse)(res, 400, '请选择商品');
    }
    const product = await prisma_1.default.product.findUnique({ where: { id: productId } });
    if (!product) {
        return (0, helpers_1.errorResponse)(res, 400, '所选商品不存在');
    }
    // 检查商品类型与支付墙是否匹配
    // （这里可以添加类型检查逻辑）
    // 校验唯一默认勾选
    if (isDefaultSelected) {
        const existingDefault = await prisma_1.default.paymentWallProduct.findFirst({
            where: { paymentWallId: id, isDefaultSelected: true }
        });
        if (existingDefault) {
            return (0, helpers_1.errorResponse)(res, 400, '已有默认勾选商品，请先取消');
        }
    }
    // 校验营销文案长度
    if (showBadge) {
        const text = product.type === 'subscription' ? subscriptionText : marketingText;
        if (!text || text.length > 10) {
            return (0, helpers_1.errorResponse)(res, 400, '营销文案长度不能超过10字符');
        }
    }
    // 检查是否已存在相同商品配置
    const existingProduct = await prisma_1.default.paymentWallProduct.findFirst({
        where: { paymentWallId: id, productId }
    });
    if (existingProduct) {
        return (0, helpers_1.errorResponse)(res, 400, '该商品已在支付墙中配置');
    }
    const paymentWallProduct = await prisma_1.default.paymentWallProduct.create({
        data: {
            paymentWallId: id,
            productId,
            type: product.type,
            bonusCoins: product.type === 'recharge' ? (bonusCoins ? parseInt(bonusCoins) : null) : null,
            isDefaultSelected,
            showBadge,
            marketingText: product.type === 'recharge' ? marketingText : null,
            subscriptionText: product.type === 'subscription' ? subscriptionText : null,
            sort: parseInt(sort) || 0,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, paymentWallProduct, '创建成功');
}));
// 编辑支付墙商品配置
router.put('/:id/products/:productConfigId', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const productConfigId = req.params.productConfigId;
    const updateData = req.body;
    const paymentWall = await prisma_1.default.paymentWall.findUnique({ where: { id } });
    if (!paymentWall) {
        return (0, helpers_1.errorResponse)(res, 404, '支付墙不存在');
    }
    const existingConfig = await prisma_1.default.paymentWallProduct.findUnique({
        where: { id: productConfigId }
    });
    if (!existingConfig) {
        return (0, helpers_1.errorResponse)(res, 404, '商品配置不存在');
    }
    // 校验唯一默认勾选
    if (updateData.isDefaultSelected === true) {
        const existingDefault = await prisma_1.default.paymentWallProduct.findFirst({
            where: {
                paymentWallId: id,
                isDefaultSelected: true,
                id: { not: productConfigId }
            }
        });
        if (existingDefault) {
            return (0, helpers_1.errorResponse)(res, 400, '已有默认勾选商品，请先取消');
        }
    }
    const paymentWallProduct = await prisma_1.default.paymentWallProduct.update({
        where: { id: productConfigId },
        data: {
            bonusCoins: updateData.bonusCoins !== undefined
                ? (updateData.bonusCoins ? parseInt(updateData.bonusCoins) : null)
                : existingConfig.bonusCoins,
            isDefaultSelected: updateData.isDefaultSelected !== undefined
                ? updateData.isDefaultSelected
                : existingConfig.isDefaultSelected,
            showBadge: updateData.showBadge !== undefined
                ? updateData.showBadge
                : existingConfig.showBadge,
            marketingText: updateData.marketingText !== undefined
                ? updateData.marketingText
                : existingConfig.marketingText,
            subscriptionText: updateData.subscriptionText !== undefined
                ? updateData.subscriptionText
                : existingConfig.subscriptionText,
            sort: updateData.sort !== undefined
                ? (parseInt(updateData.sort) || 0)
                : existingConfig.sort,
        },
    });
    return (0, helpers_1.successResponse)(res, paymentWallProduct, '更新成功');
}));
// 删除支付墙商品配置
router.delete('/:id/products/:productConfigId', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const productConfigId = req.params.productConfigId;
    const existingConfig = await prisma_1.default.paymentWallProduct.findUnique({
        where: { id: productConfigId }
    });
    if (!existingConfig) {
        return (0, helpers_1.errorResponse)(res, 404, '商品配置不存在');
    }
    await prisma_1.default.paymentWallProduct.delete({ where: { id: productConfigId } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=paymentWall.js.map