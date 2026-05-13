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
// 获取角色列表
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, code, status } = req.query;
    const { page, pageSize, skip } = (0, helpers_1.parsePaginationParams)(req.query);
    const where = {};
    if (name)
        where.name = { contains: name };
    if (code)
        where.code = { contains: code };
    if (status && status !== 'all')
        where.status = status;
    const [roles, total] = await Promise.all([
        prisma_1.default.role.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                permissions: {
                    include: { menu: { select: { id: true, name: true, path: true } } }
                },
                _count: { select: { users: true } }
            }
        }),
        prisma_1.default.role.count({ where }),
    ]);
    const data = roles.map(role => ({
        id: role.id,
        roleId: role.roleId,
        name: role.name,
        code: role.code,
        description: role.description,
        status: role.status,
        statusDisplay: role.status === 'active' ? '正常' : '禁用',
        menuCount: role.permissions.length,
        userCount: role._count.users,
        createdAt: role.createdAt,
    }));
    return (0, helpers_1.paginatedResponse)(res, data, total, page, pageSize);
}));
// 获取所有角色（用于下拉选择）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const roles = await prisma_1.default.role.findMany({
        where: { status: 'active' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
    });
    return (0, helpers_1.successResponse)(res, roles);
}));
// 获取单个角色
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const role = await prisma_1.default.role.findUnique({
        where: { id },
        include: {
            permissions: {
                include: { menu: true }
            }
        }
    });
    if (!role) {
        return (0, helpers_1.errorResponse)(res, 404, '角色不存在');
    }
    // 整理权限数据
    const menus = role.permissions.map(p => ({
        menuId: p.menuId,
        permission: p.permission,
    }));
    return (0, helpers_1.successResponse)(res, {
        id: role.id,
        roleId: role.roleId,
        name: role.name,
        code: role.code,
        description: role.description,
        status: role.status,
        menus,
        createdAt: role.createdAt,
    });
}));
// 新建角色
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, code, description, status = 'active', menus = [] } = req.body;
    // 验证必填字段
    if (!name)
        return (0, helpers_1.errorResponse)(res, 400, '角色名称不能为空');
    if (!code)
        return (0, helpers_1.errorResponse)(res, 400, '角色编码不能为空');
    // 检查编码唯一性
    const existingRole = await prisma_1.default.role.findFirst({ where: { code } });
    if (existingRole) {
        return (0, helpers_1.errorResponse)(res, 400, '角色编码已存在');
    }
    // 生成角色ID
    const count = await prisma_1.default.role.count();
    const roleId = `ROLE${String(count + 1).padStart(4, '0')}`;
    // 创建角色并关联权限
    const role = await prisma_1.default.role.create({
        data: {
            roleId,
            name,
            code,
            description,
            status,
            createdBy: req.user.userId,
            permissions: {
                create: menus.map((m) => ({
                    menuId: m.menuId,
                    permission: m.permission,
                })),
            },
        },
        include: { permissions: true }
    });
    return (0, helpers_1.successResponse)(res, {
        id: role.id,
        roleId: role.roleId,
        name: role.name,
        status: role.status,
    }, '创建成功');
}));
// 编辑角色
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, code, description, status, menus = [] } = req.body;
    const existingRole = await prisma_1.default.role.findUnique({ where: { id } });
    if (!existingRole) {
        return (0, helpers_1.errorResponse)(res, 404, '角色不存在');
    }
    // 检查编码唯一性
    if (code && code !== existingRole.code) {
        const conflictRole = await prisma_1.default.role.findFirst({ where: { code, id: { not: id } } });
        if (conflictRole) {
            return (0, helpers_1.errorResponse)(res, 400, '角色编码已存在');
        }
    }
    // 更新角色基本信息
    await prisma_1.default.role.update({
        where: { id },
        data: {
            name: name || existingRole.name,
            code: code || existingRole.code,
            description,
            status: status || existingRole.status,
        },
    });
    // 更新权限
    await prisma_1.default.rolePermission.deleteMany({ where: { roleId: id } });
    if (menus && menus.length > 0) {
        await prisma_1.default.rolePermission.createMany({
            data: menus.map((m) => ({
                roleId: id,
                menuId: m.menuId,
                permission: m.permission,
            })),
        });
    }
    return (0, helpers_1.successResponse)(res, {
        id: existingRole.id,
        roleId: existingRole.roleId,
        name: name || existingRole.name,
        status: status || existingRole.status,
    }, '更新成功');
}));
// 删除角色
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const role = await prisma_1.default.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } }
    });
    if (!role) {
        return (0, helpers_1.errorResponse)(res, 404, '角色不存在');
    }
    if (role._count.users > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该角色已被${role._count.users}个用户使用，无法删除`);
    }
    // 删除角色权限关联
    await prisma_1.default.rolePermission.deleteMany({ where: { roleId: id } });
    await prisma_1.default.role.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=role.js.map