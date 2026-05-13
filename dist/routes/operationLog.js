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
// 获取登录日志列表
router.get('/login', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { username, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    const where = {};
    if (username)
        where.username = { contains: username };
    if (status && status !== 'all')
        where.status = status;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = new Date(startDate);
        if (endDate)
            where.createdAt.lte = new Date(endDate);
    }
    const [logs, total] = await Promise.all([
        prisma_1.default.loginLog.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } }
            }
        }),
        prisma_1.default.loginLog.count({ where }),
    ]);
    const data = logs.map(log => ({
        id: log.id,
        userId: log.userId,
        username: log.username,
        user: log.user,
        ip: log.ip,
        userAgent: log.userAgent,
        status: log.status,
        statusDisplay: log.status === 'success' ? '成功' : '失败',
        message: log.message,
        createdAt: log.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取操作日志列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { username, module, action, status, startDate, endDate } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    const where = {};
    if (username)
        where.username = { contains: username };
    if (module)
        where.module = { contains: module };
    if (action)
        where.action = { contains: action };
    if (status && status !== 'all')
        where.status = status;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = new Date(startDate);
        if (endDate)
            where.createdAt.lte = new Date(endDate);
    }
    const [logs, total] = await Promise.all([
        prisma_1.default.operationLog.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } }
            }
        }),
        prisma_1.default.operationLog.count({ where }),
    ]);
    const data = logs.map(log => ({
        id: log.id,
        userId: log.userId,
        username: log.username,
        user: log.user,
        module: log.module,
        action: log.action,
        method: log.method,
        url: log.url,
        params: log.params,
        ip: log.ip,
        userAgent: log.userAgent,
        status: log.status,
        statusDisplay: log.status === 'success' ? '成功' : '失败',
        errorMsg: log.errorMsg,
        createdAt: log.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取单个操作日志
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const log = await prisma_1.default.operationLog.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, name: true, email: true } }
        }
    });
    if (!log) {
        return res.status(404).json({ success: false, message: '日志不存在' });
    }
    return (0, helpers_1.successResponse)(res, {
        id: log.id,
        userId: log.userId,
        username: log.username,
        user: log.user,
        module: log.module,
        action: log.action,
        method: log.method,
        url: log.url,
        params: log.params,
        ip: log.ip,
        userAgent: log.userAgent,
        status: log.status,
        errorMsg: log.errorMsg,
        createdAt: log.createdAt,
    });
}));
exports.default = router;
//# sourceMappingURL=operationLog.js.map