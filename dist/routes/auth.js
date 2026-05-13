"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const helpers_1 = require("../utils/helpers");
const auth_1 = require("../middleware/auth");
const operationLog_1 = require("../middleware/operationLog");
const router = (0, express_1.Router)();
// 获取客户端IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        '';
};
// 登录
router.post('/login', (0, helpers_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return (0, helpers_1.errorResponse)(res, 400, '请输入邮箱和密码');
    }
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    if (!user) {
        // 记录登录失败
        await (0, operationLog_1.createLoginLog)({
            userId: 'unknown',
            username: email,
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'failed',
            message: '用户不存在',
        });
        return (0, helpers_1.errorResponse)(res, 401, '用户不存在');
    }
    if (user.status !== 'active') {
        // 记录登录失败
        await (0, operationLog_1.createLoginLog)({
            userId: user.id,
            username: user.email,
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'failed',
            message: '账号已被禁用',
        });
        return (0, helpers_1.errorResponse)(res, 401, '账号已被禁用');
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
    if (!isValidPassword) {
        // 记录登录失败
        await (0, operationLog_1.createLoginLog)({
            userId: user.id,
            username: user.email,
            ip: getClientIp(req),
            userAgent: req.headers['user-agent'],
            status: 'failed',
            message: '密码错误',
        });
        return (0, helpers_1.errorResponse)(res, 401, '密码错误');
    }
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const payload = {
        userId: user.id,
        email: user.email,
        username: user.name || user.email,
        role: user.role,
    };
    const signOptions = { expiresIn: '7d' };
    const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, signOptions);
    // 更新最后登录时间
    await prisma_1.default.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
    });
    // 记录登录成功
    await (0, operationLog_1.createLoginLog)({
        userId: user.id,
        username: user.email,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: 'success',
        message: '登录成功',
    });
    return (0, helpers_1.successResponse)(res, {
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
    }, '登录成功');
}));
// 注册
router.post('/register', (0, helpers_1.asyncHandler)(async (req, res) => {
    const { email, password, name, username } = req.body;
    if (!email || !password) {
        return (0, helpers_1.errorResponse)(res, 400, '请输入邮箱和密码');
    }
    const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
    if (existingUser) {
        return (0, helpers_1.errorResponse)(res, 400, '该邮箱已被注册');
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.default.user.create({
        data: {
            email,
            password: hashedPassword,
            name: name || email.split('@')[0],
            role: 'admin',
            username: username || email.split('@')[0],
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    }, '注册成功');
}));
// 获取当前用户信息
router.get('/me', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { id: req.user.userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            createdAt: true,
        },
    });
    if (!user) {
        return (0, helpers_1.errorResponse)(res, 404, '用户不存在');
    }
    return (0, helpers_1.successResponse)(res, user);
}));
// 修改密码
router.put('/password', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return (0, helpers_1.errorResponse)(res, 400, '请输入原密码和新密码');
    }
    if (newPassword.length < 6) {
        return (0, helpers_1.errorResponse)(res, 400, '新密码长度不能少于6位');
    }
    const user = await prisma_1.default.user.findUnique({
        where: { id: req.user.userId },
    });
    if (!user) {
        return (0, helpers_1.errorResponse)(res, 404, '用户不存在');
    }
    const isValidPassword = await bcryptjs_1.default.compare(oldPassword, user.password);
    if (!isValidPassword) {
        return (0, helpers_1.errorResponse)(res, 400, '原密码错误');
    }
    const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.default.user.update({
        where: { id: req.user.userId },
        data: { password: hashedPassword },
    });
    return (0, helpers_1.successResponse)(res, null, '密码修改成功');
}));
exports.default = router;
//# sourceMappingURL=auth.js.map