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
// 获取商品列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, price, os, type, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (name) {
        where.name = { contains: name };
    }
    if (price) {
        where.price = parseInt(price);
    }
    if (os && os !== 'all') {
        where.os = os;
    }
    if (type && type !== 'all') {
        where.type = type;
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
    const [products, total] = await Promise.all([
        prisma_1.default.product.findMany({
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
        prisma_1.default.product.count({ where }),
    ]);
    // 格式化返回数据
    const data = products.map(product => ({
        id: product.id,
        productId: product.productId,
        name: product.name,
        os: product.os,
        type: product.type,
        typeDisplay: product.type === 'recharge' ? '充值' : '订阅',
        durationOrCoins: product.type === 'recharge'
            ? `${product.coins}金币`
            : formatDuration(product.subscriptionDuration),
        price: `$${(product.price / 100).toFixed(2)}`,
        priceRaw: product.price,
        status: product.status,
        statusDisplay: product.status === 'active' ? '有效' : '无效',
        createdBy: product.createdByUser?.name || product.createdByUser?.email || '-',
        createdAt: product.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取有效商品列表（用于下拉选择）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { os, type } = req.query;
    const where = { status: 'active' };
    if (os && os !== 'all') {
        where.os = os;
    }
    if (type) {
        where.type = type;
    }
    const products = await prisma_1.default.product.findMany({
        where,
        select: {
            id: true,
            productId: true,
            name: true,
            os: true,
            type: true,
            price: true,
            coins: true,
            subscriptionDuration: true,
        },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, products);
}));
// 获取单个商品
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const product = await prisma_1.default.product.findUnique({
        where: { id },
        include: {
            createdByUser: {
                select: { name: true, email: true }
            }
        }
    });
    if (!product) {
        return (0, helpers_1.errorResponse)(res, 404, '商品不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        ...product,
        priceDisplay: `$${(product.price / 100).toFixed(2)}`,
    });
}));
// 新建商品
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, type = 'recharge', os = 'H5', price, coins, subscriptionDuration, productId: productIdExternal, status = 'active' } = req.body;
    // 验证必填字段
    if (!name || !price) {
        return (0, helpers_1.errorResponse)(res, 400, '请填写必填项');
    }
    // 校验长度
    if (name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '商品名称长度不能超过40字符');
    }
    // 校验价格（分）
    const priceInCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceInCents) || priceInCents < 1 || priceInCents > 999900) {
        return (0, helpers_1.errorResponse)(res, 400, '商品价格必须在$0.01-$9999之间');
    }
    // 校验类型特定字段
    if (type === 'recharge') {
        if (!coins || coins < 1 || coins > 9999) {
            return (0, helpers_1.errorResponse)(res, 400, '金币数量必须在1-9999之间');
        }
    }
    else {
        if (!subscriptionDuration) {
            return (0, helpers_1.errorResponse)(res, 400, '订阅时长为必填项');
        }
    }
    // 校验iOS/Android时的商品ID
    if ((os === 'iOS' || os === 'Android') && !productIdExternal) {
        return (0, helpers_1.errorResponse)(res, 400, `${os}平台需要提供商品ID`);
    }
    // 生成唯一编号
    const count = await prisma_1.default.product.count();
    const productId = `PRD${String(count + 1).padStart(6, '0')}`;
    const product = await prisma_1.default.product.create({
        data: {
            productId,
            name,
            type,
            os,
            price: priceInCents,
            coins: type === 'recharge' ? parseInt(coins) : null,
            subscriptionDuration: type === 'subscription' ? subscriptionDuration : null,
            productIdExternal,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: product.id,
        productId: product.productId,
        name: product.name,
        type: product.type,
        price: `$${(product.price / 100).toFixed(2)}`,
    }, '创建成功');
}));
// 编辑商品
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    const existingProduct = await prisma_1.default.product.findUnique({ where: { id } });
    if (!existingProduct) {
        return (0, helpers_1.errorResponse)(res, 404, '商品不存在');
    }
    // 校验长度
    if (updateData.name && updateData.name.length > 40) {
        return (0, helpers_1.errorResponse)(res, 400, '商品名称长度不能超过40字符');
    }
    // 校验价格
    let newPrice = existingProduct.price;
    if (updateData.price !== undefined) {
        newPrice = Math.round(parseFloat(updateData.price) * 100);
        if (isNaN(newPrice) || newPrice < 1 || newPrice > 999900) {
            return (0, helpers_1.errorResponse)(res, 400, '商品价格必须在$0.01-$9999之间');
        }
    }
    const product = await prisma_1.default.product.update({
        where: { id },
        data: {
            name: updateData.name || existingProduct.name,
            type: updateData.type || existingProduct.type,
            os: updateData.os || existingProduct.os,
            price: newPrice,
            coins: updateData.type === 'recharge'
                ? (updateData.coins ? parseInt(updateData.coins) : existingProduct.coins)
                : null,
            subscriptionDuration: updateData.type === 'subscription'
                ? (updateData.subscriptionDuration || existingProduct.subscriptionDuration)
                : null,
            productIdExternal: updateData.productId !== undefined
                ? updateData.productId
                : existingProduct.productIdExternal,
            status: updateData.status || existingProduct.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: product.id,
        productId: product.productId,
        name: product.name,
        price: `$${(product.price / 100).toFixed(2)}`,
    }, '更新成功');
}));
// 删除商品
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const existingProduct = await prisma_1.default.product.findUnique({ where: { id } });
    if (!existingProduct) {
        return (0, helpers_1.errorResponse)(res, 404, '商品不存在');
    }
    // 检查是否有关联的支付墙商品配置
    const configCount = await prisma_1.default.paymentWallProduct.count({
        where: { productId: id }
    });
    if (configCount > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该商品已在${configCount}个支付墙中配置，无法删除`);
    }
    await prisma_1.default.product.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 辅助函数：格式化订阅时长
function formatDuration(duration) {
    if (!duration)
        return '-';
    const durationMap = {
        '1week': '1周',
        '1month': '1个月',
        '3months': '3个月',
        '6months': '6个月',
        '12months': '12个月',
    };
    return durationMap[duration] || duration;
}
exports.default = router;
//# sourceMappingURL=product.js.map