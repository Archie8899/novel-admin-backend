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
// 获取订单列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { orderId, userId, productName, productType, promoCode, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    // 构建查询条件
    const where = {};
    if (orderId) {
        where.orderId = orderId;
    }
    if (userId) {
        where.userId = userId;
    }
    if (productName) {
        where.productName = { contains: productName };
    }
    if (productType && productType !== 'all') {
        where.productType = productType;
    }
    if (promoCode) {
        where.promoCode = promoCode;
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
    const [orders, total] = await Promise.all([
        prisma_1.default.order.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.default.order.count({ where }),
    ]);
    // 格式化返回数据
    const data = orders.map(order => ({
        id: order.id,
        orderId: order.orderId,
        storeOrderId: order.storeOrderId || '-',
        userId: order.userId,
        productType: order.productType,
        productTypeDisplay: order.productType === 'recharge' ? '充值' : '订阅',
        productName: order.productName,
        productPrice: `$${(order.productPrice / 100).toFixed(2)}`,
        paymentMethod: order.paymentMethod || '-',
        status: order.status,
        statusDisplay: formatOrderStatus(order.status),
        promoCode: order.promoCode || '-',
        createdAt: order.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个订单
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const order = await prisma_1.default.order.findUnique({
        where: { id },
        include: {
            user: {
                select: { userId: true, email: true, os: true }
            }
        }
    });
    if (!order) {
        return (0, helpers_1.errorResponse)(res, 404, '订单不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        ...order,
        productPriceDisplay: `$${(order.productPrice / 100).toFixed(2)}`,
        statusDisplay: formatOrderStatus(order.status),
    });
}));
// 导出订单
router.get('/export/data', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { orderId, userId, productType, status, startDate, endDate } = req.query;
    // 构建查询条件
    const where = {};
    if (orderId) {
        where.orderId = orderId;
    }
    if (userId) {
        where.userId = userId;
    }
    if (productType) {
        where.productType = productType;
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
    const orders = await prisma_1.default.order.findMany({
        where,
        include: {
            user: {
                select: { userId: true, email: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    // 转换为导出格式
    const exportData = orders.map(order => ({
        orderId: order.orderId,
        storeOrderId: order.storeOrderId || '',
        userId: order.userId,
        userEmail: order.user?.email || '',
        productType: order.productType === 'recharge' ? '充值' : '订阅',
        productName: order.productName,
        productPrice: `$${(order.productPrice / 100).toFixed(2)}`,
        paymentMethod: order.paymentMethod || '',
        status: formatOrderStatus(order.status),
        promoCode: order.promoCode || '',
        createdAt: order.createdAt.toISOString(),
    }));
    return (0, helpers_1.successResponse)(res, exportData, `共${exportData.length}条数据`);
}));
// 辅助函数：格式化订单状态
function formatOrderStatus(status) {
    const statusMap = {
        'pending': '待支付',
        'paid': '已支付',
        'failed': '支付失败',
        'closed': '支付关闭',
    };
    return statusMap[status] || status;
}
exports.default = router;
//# sourceMappingURL=order.js.map