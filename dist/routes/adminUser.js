"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const helpers_1 = require("../utils/helpers");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// 获取管理员用户列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const where = {};
    if (q.email)
        where.email = { contains: q.email };
    if (q.name)
        where.name = { contains: q.name };
    if (q.status && q.status !== 'all')
        where.status = q.status;
    if (q.deptId)
        where.deptId = q.deptId;
    if (q.roleId)
        where.roleId = q.roleId;
    const [users, total] = await Promise.all([
        prisma_1.default.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { dept: true, userRole: true }
        }),
        prisma_1.default.user.count({ where }),
    ]);
    const data = users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username || '',
        name: u.name || '',
        phone: u.phone || '',
        dept: u.dept,
        role: u.userRole,
        status: u.status,
        statusDisplay: u.status === 'active' ? '正常' : '禁用',
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, 1, 20);
}));
// 获取单个管理员用户
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.default.user.findUnique({
        where: { id: req.params.id },
        include: { dept: true, userRole: true }
    });
    if (!user)
        return (0, helpers_1.errorResponse)(res, 404, '用户不存在');
    return (0, helpers_1.successResponse)(res, user);
}));
// 新建管理员用户
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { username, email, password, name, phone, deptId, roleId, status } = req.body;
    if (!email || !password)
        return (0, helpers_1.errorResponse)(res, 400, '邮箱和密码不能为空');
    const existing = await prisma_1.default.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing)
        return (0, helpers_1.errorResponse)(res, 400, '邮箱或用户名已存在');
    const hashed = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.default.user.create({
        data: { username, email, password: hashed, name, phone, deptId, roleId, status: status || 'active' }
    });
    return (0, helpers_1.successResponse)(res, user, '创建成功');
}));
// 编辑管理员用户
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { username, email, password, name, phone, deptId, roleId, status } = req.body;
    const data = {};
    if (email !== undefined)
        data.email = email;
    if (username !== undefined)
        data.username = username;
    if (name !== undefined)
        data.name = name;
    if (phone !== undefined)
        data.phone = phone;
    if (deptId !== undefined)
        data.deptId = deptId;
    if (roleId !== undefined)
        data.roleId = roleId;
    if (status !== undefined)
        data.status = status;
    if (password)
        data.password = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.default.user.update({ where: { id: req.params.id }, data });
    return (0, helpers_1.successResponse)(res, user, '更新成功');
}));
// 删除管理员用户
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    if (req.params.id === req.user?.userId) {
        return (0, helpers_1.errorResponse)(res, 400, '不能删除自己');
    }
    await prisma_1.default.user.delete({ where: { id: req.params.id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
// 重置密码
router.post('/:id/reset-password', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { password } = req.body;
    if (!password)
        return (0, helpers_1.errorResponse)(res, 400, '密码不能为空');
    const hashed = await bcryptjs_1.default.hash(password, 10);
    await prisma_1.default.user.update({ where: { id: req.params.id }, data: { password: hashed } });
    return (0, helpers_1.successResponse)(res, null, '密码重置成功');
}));
exports.default = router;
//# sourceMappingURL=adminUser.js.map