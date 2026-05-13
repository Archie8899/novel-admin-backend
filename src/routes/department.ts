import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取部门列表（树形结构）
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, status } = req.query;

  const where: any = {};
  if (name) where.name = { contains: name as string };
  if (status && status !== 'all') where.status = status;

  const departments = await prisma.department.findMany({
    where,
    orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { users: true, children: true } }
    }
  });

  // 转换为树形结构
  const buildTree = (items: any[], parentId: string | null = null): any[] => {
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

  return successResponse(res, treeData);
}));

// 获取所有部门（扁平列表，用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const departments = await prisma.department.findMany({
    where: { status: 'active' },
    select: { id: true, deptId: true, name: true, parentId: true },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  });
  return successResponse(res, departments);
}));

// 获取单个部门
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: { select: { id: true, name: true } },
      _count: { select: { users: true } }
    }
  });

  if (!dept) {
    return errorResponse(res, 404, '部门不存在');
  }

  return successResponse(res, {
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
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, parentId, sort = 0, status = 'active' } = req.body;

  if (!name) {
    return errorResponse(res, 400, '部门名称不能为空');
  }

  // 生成部门ID
  const count = await prisma.department.count();
  const deptId = `DEPT${String(count + 1).padStart(4, '0')}`;

  const dept = await prisma.department.create({
    data: {
      deptId,
      name,
      parentId,
      sort,
      status,
      createdBy: req.user!.userId,
    },
  });

  return successResponse(res, {
    id: dept.id,
    deptId: dept.deptId,
    name: dept.name,
    status: dept.status,
  }, '创建成功');
}));

// 编辑部门
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, parentId, sort, status } = req.body;

  const existingDept = await prisma.department.findUnique({ where: { id } });
  if (!existingDept) {
    return errorResponse(res, 404, '部门不存在');
  }

  // 不能将自己设为自己的父级
  if (parentId === id) {
    return errorResponse(res, 400, '不能将部门设为自己的子部门');
  }

  // 检查循环引用
  if (parentId) {
    let currentParent = await prisma.department.findUnique({ where: { id: parentId } });
    while (currentParent?.parentId) {
      if (currentParent.parentId === id) {
        return errorResponse(res, 400, '不能创建循环引用');
      }
      currentParent = await prisma.department.findUnique({ where: { id: currentParent.parentId } });
    }
  }

  const dept = await prisma.department.update({
    where: { id },
    data: {
      name: name !== undefined ? name : existingDept.name,
      parentId: parentId !== undefined ? parentId : existingDept.parentId,
      sort: sort !== undefined ? sort : existingDept.sort,
      status: status || existingDept.status,
    },
  });

  return successResponse(res, {
    id: dept.id,
    deptId: dept.deptId,
    name: dept.name,
    status: dept.status,
  }, '更新成功');
}));

// 删除部门
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const dept = await prisma.department.findUnique({ 
    where: { id },
    include: { _count: { select: { users: true, children: true } } }
  });
  
  if (!dept) {
    return errorResponse(res, 404, '部门不存在');
  }

  if (dept._count.users > 0) {
    return errorResponse(res, 400, `该部门下有${dept._count.users}个用户，无法删除`);
  }

  if (dept._count.children > 0) {
    return errorResponse(res, 400, `该部门下有${dept._count.children}个子部门，无法删除`);
  }

  await prisma.department.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

export default router;
