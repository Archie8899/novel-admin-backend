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
// 获取部门列表（树形结构）
router.get('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, status } = req.query;
    const where = {};
    if (name)
        where.name = { contains: name };
    if (status && status !== 'all')
        where.status = status;
    const departments = await prisma_1.default.department.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        include: {
            parent: { select: { id: true, name: true } },
            _count: { select: { users: true, children: true } }
        }
    });
    // 转换为树形结构
    const buildTree = (items, parentId = null) => {
        return items
            .filter(item => item.parentId === parentId)
            .map(item => ({
            id: item.id,
            deptId: item.deptId,
            name: item.name,
            parent: item.parent,
            sort: item.sort,
            status: item.status,
            statusDisplay: item.status === 'active' ? '正常' : '禁用',
            userCount: item._count.users,
            children: buildTree(items, item.id),
        }));
    };
    const treeData = buildTree(departments);
    return (0, helpers_1.successResponse)(res, treeData);
}));
// 获取所有部门（扁平列表，用于下拉选择）
router.get('/options', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const departments = await prisma_1.default.department.findMany({
        where: { status: 'active' },
        select: { id: true, deptId: true, name: true, parentId: true },
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
    });
    return (0, helpers_1.successResponse)(res, departments);
}));
// 获取单个部门
router.get('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const dept = await prisma_1.default.department.findUnique({
        where: { id },
        include: {
            parent: { select: { id: true, name: true } },
            children: { select: { id: true, name: true } },
            _count: { select: { users: true } }
        }
    });
    if (!dept) {
        return (0, helpers_1.errorResponse)(res, 404, '部门不存在');
    }
    return (0, helpers_1.successResponse)(res, {
        id: dept.id,
        deptId: dept.deptId,
        name: dept.name,
        parentId: dept.parentId,
        parent: dept.parent,
        sort: dept.sort,
        status: dept.status,
        userCount: dept._count.users,
        children: dept.children,
        createdAt: dept.createdAt,
    });
}));
// 新建部门
router.post('/', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const { name, parentId, sort = 0, status = 'active' } = req.body;
    if (!name) {
        return (0, helpers_1.errorResponse)(res, 400, '部门名称不能为空');
    }
    // 生成部门ID
    const count = await prisma_1.default.department.count();
    const deptId = `DEPT${String(count + 1).padStart(4, '0')}`;
    const dept = await prisma_1.default.department.create({
        data: {
            deptId,
            name,
            parentId,
            sort,
            status,
            createdBy: req.user.userId,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: dept.id,
        deptId: dept.deptId,
        name: dept.name,
        status: dept.status,
    }, '创建成功');
}));
// 编辑部门
router.put('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { name, parentId, sort, status } = req.body;
    const existingDept = await prisma_1.default.department.findUnique({ where: { id } });
    if (!existingDept) {
        return (0, helpers_1.errorResponse)(res, 404, '部门不存在');
    }
    // 不能将自己设为自己的父级
    if (parentId === id) {
        return (0, helpers_1.errorResponse)(res, 400, '不能将部门设为自己的子部门');
    }
    // 检查循环引用
    if (parentId) {
        let currentParent = await prisma_1.default.department.findUnique({ where: { id: parentId } });
        while (currentParent?.parentId) {
            if (currentParent.parentId === id) {
                return (0, helpers_1.errorResponse)(res, 400, '不能创建循环引用');
            }
            currentParent = await prisma_1.default.department.findUnique({ where: { id: currentParent.parentId } });
        }
    }
    const dept = await prisma_1.default.department.update({
        where: { id },
        data: {
            name: name !== undefined ? name : existingDept.name,
            parentId: parentId !== undefined ? parentId : existingDept.parentId,
            sort: sort !== undefined ? sort : existingDept.sort,
            status: status || existingDept.status,
        },
    });
    return (0, helpers_1.successResponse)(res, {
        id: dept.id,
        deptId: dept.deptId,
        name: dept.name,
        status: dept.status,
    }, '更新成功');
}));
// 删除部门
router.delete('/:id', auth_1.authMiddleware, (0, helpers_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const dept = await prisma_1.default.department.findUnique({
        where: { id },
        include: { _count: { select: { users: true, children: true } } }
    });
    if (!dept) {
        return (0, helpers_1.errorResponse)(res, 404, '部门不存在');
    }
    if (dept._count.users > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该部门下有${dept._count.users}个用户，无法删除`);
    }
    if (dept._count.children > 0) {
        return (0, helpers_1.errorResponse)(res, 400, `该部门下有${dept._count.children}个子部门，无法删除`);
    }
    await prisma_1.default.department.delete({ where: { id } });
    return (0, helpers_1.successResponse)(res, null, '删除成功');
}));
exports.default = router;
//# sourceMappingURL=department.js.map