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
// 获取菜单列表（树形结构）
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, status, type } = req.query;
    const where = {};
    if (name)
        where.name = { contains: name };
    if (status && status !== 'all')
        where.status = status;
    if (type)
        where.type = type;
    const menus = await prisma_1.default.menu.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        include: {
            parent: { select: { id: true, name: true } },
            _count: { select: { children: true, permissions: true } }
        }
    });
    // 转换为树形结构
    const buildTree = (items, parentId = null) => {
        return items
            .filter(item => item.parentId === parentId)
            .map(item => ({
            id: item.id,
            menuId: item.menuId,
            name: item.name,
            path: item.path,
            icon: item.icon,
            component: item.component,
            parent: item.parent,
            sort: item.sort,
            type: item.type,
            typeDisplay: item.type === 'menu' ? '菜单' : '按钮',
            status: item.status,
            statusDisplay: item.status === 'active' ? '正常' : '禁用',
            children: buildTree(items, item.id),
        }));
    };
    const treeData = buildTree(menus);
    return (0, helpers_1.successResponse)(res, treeData);
}));
// 获取所有菜单（扁平列表，用于下拉选择和权限配置）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const menus = await prisma_1.default.menu.findMany({
        where: { status: 'active', type: 'menu' },
        select: { id: true, menuId: true, name: true, path: true, parentId: true, type: true },
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    });
    return (0, helpers_1.successResponse)(res, menus);
}));
// 获取单个菜单
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const menu = await prisma_1.default.menu.findUnique({
        where: { id },
        include: {
            parent: { select: { id: true, name: true } },
            children: {
                where: { type: 'button' },
                select: { id: true, name: true, permission: true }
            },
        }
    });
    if (!menu) {
        return (0, helpers_1.errorResponse)(res, 404, '菜单不存在');
    }
    // 获取按钮权限
    const buttons = await prisma_1.default.menu.findMany({
        where: { parentId: id, type: 'button' },
        select: { id: true, name: true, permission: true }
    });
    return (0, helpers_1.successResponse)(res, {
        id: menu.id,
        menuId: menu.menuId,
        name: menu.name,
        path: menu.path,
        icon: menu.icon,
        component: menu.component,
        parentId: menu.parentId,
        parent: menu.parent,
        sort: menu.sort,
        type: menu.type,
        status: menu.status,
        buttons,
        createdAt: menu.createdAt,
    });
}));
// 新建菜单
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, path, icon, component, parentId, sort = 0, type = 'menu', status = 'active', buttons = [] } = req.body;
    if (!name) {
        return (0, helpers_1.errorResponse)(res, 400, '菜单名称不能为空');
    }
    // 生成菜单ID
    const count = await prisma_1.default.menu.count();
    const menuId = `MENU${String(count + 1).padStart(4, '0')}`;
    // 创建菜单
    const menu = await prisma_1.default.menu.create({
        data: {
            menuId,
            name,
            path,
            icon,
            component,
            parentId,
            sort,
            type,
            status,
            createdBy: req.user.userId,
        },
    });
    // 如果有按钮权限，一并创建
    if (type === 'menu' && buttons && buttons.length > 0) {
        await prisma_1.default.menu.createMany({
            data: buttons.map((btn) => ({
                menuId: `${menuId}-BTN${btn.code}`,
                name: btn.name,
                parentId: menu.id,
                type: 'button',
                permission: btn.code,
                sort: btn.sort || 0,
                status: 'active',
                createdBy: req.user.userId,
            })),
        });
    }
    return (0, helpers_1.successResponse)(res, {
        id: menu.id,
        menuId: menu.menuId,
        name: menu.name,
        status: menu.status,
    }, '创建成功');
}));
// 编辑菜单
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, path, icon, component, parentId, sort, status, buttons } = req.body;
    const existingMenu = await prisma_1.default.menu.findUnique({ where: { id } });
    if (!existingMenu) {
        return (0, helpers_1.errorResponse)(res, 404, '菜单不存在');
    }
    // 不能将自己设为自己的父级
    if (parentId === id) {
        return (0, helpers_1.errorResponse)(res, 400, '不能将菜单设为自己的子菜单');
    }
    const menu = await prisma_1.default.menu.update({
        where: { id },
        data: {
            name: name !== undefined ? name : existingMenu.name,
            path: path !== undefined ? path : existingMenu.path,
            icon: icon !== undefined ? icon : existingMenu.icon,
            component: component !== undefined ? component : existingMenu.component,
            parentId: parentId !== undefined ? parentId : existingMenu.parentId,
            sort: sort !== undefined ? sort : existingMenu.sort,
            status: status || existingMenu.status,
        },
    });
    // 更新按钮权限
    if (buttons !== undefined && existingMenu.type === 'menu') {
        // 删除旧的按钮
        await prisma_1.default.menu.deleteMany({ where: { parentId: id, type: 'button' } });
        // 创建新的按钮
        if (buttons && buttons.length > 0) {
            await prisma_1.default.menu.createMany({
                data: buttons.map((btn) => ({
                    menuId: `${existingMenu.menuId}-BTN${btn.code}`,
                    name: btn.name,
                    parentId: id,
                    type: 'button',
                    permission: btn.code,
                    sort: btn.sort || 0,
                    status: 'active',
                    createdBy: req.user.userId,
                })),
            });
        }
    }
    return (0, helpers_1.successResponse)(res, {
        id: menu.id,
        menuId: menu.menuId,
        name: menu.name,
        status: menu.status,
    }, '更新成功');
}));
// 删除菜单
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const menu = await prisma_1.default.menu.findUnique({
        where: { id },
        include: { _count: { select: { children: true } } }
    });
    if (!menu) {
        return (0, helpers_1.errorResponse)(res, 404, '菜单不存在');
    }
    if (menu._count.children > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该菜单下有${menu._count.children}个子菜单/按钮，请先删除`);
    }
    // 删除角色权限关联
    await prisma_1.default.rolePermission.deleteMany({ where: { menuId: id } });
    await prisma_1.default.menu.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=menu.js.map