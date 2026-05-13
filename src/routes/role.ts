import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse, parsePaginationParams } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取角色列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, code, status } = req.query;
  const { page, pageSize, skip } = parsePaginationParams(req.query);

  const where: any = {};
  
  if (name) where.name = { contains: name as string };
  if (code) where.code = { contains: code as string };
  if (status && status !== 'all') where.status = status;

  const [roles, total] = await Promise.all([
    prisma.role.findMany({
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
    prisma.role.count({ where }),
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

  return paginatedResponse(res, data, total, page, pageSize);
}));

// 获取所有角色（用于下拉选择）
router.get('/options', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const roles = await prisma.role.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
  return successResponse(res, roles);
}));

// 获取单个角色
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { menu: true }
      }
    }
  });

  if (!role) {
    return errorResponse(res, 404, '角色不存在');
  }

  // 整理权限数据
  const menus = role.permissions.map(p => ({
    menuId: p.menuId,
    permission: p.permission,
  }));

  return successResponse(res, {
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
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, code, description, status = 'active', menus = [] } = req.body;

  // 验证必填字段
  if (!name) return errorResponse(res, 400, '角色名称不能为空');
  if (!code) return errorResponse(res, 400, '角色编码不能为空');

  // 检查编码唯一性
  const existingRole = await prisma.role.findFirst({ where: { code } });
  if (existingRole) {
    return errorResponse(res, 400, '角色编码已存在');
  }

  // 生成角色ID
  const count = await prisma.role.count();
  const roleId = `ROLE${String(count + 1).padStart(4, '0')}`;

  // 创建角色并关联权限
  const role = await prisma.role.create({
    data: {
      roleId,
      name,
      code,
      description,
      status,
      createdBy: req.user!.userId,
      permissions: {
        create: menus.map((m: any) => ({
          menuId: m.menuId,
          permission: m.permission,
        })),
      },
    },
    include: { permissions: true }
  });

  return successResponse(res, {
    id: role.id,
    roleId: role.roleId,
    name: role.name,
    status: role.status,
  }, '创建成功');
}));

// 编辑角色
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, code, description, status, menus = [] } = req.body;

  const existingRole = await prisma.role.findUnique({ where: { id } });
  if (!existingRole) {
    return errorResponse(res, 404, '角色不存在');
  }

  // 检查编码唯一性
  if (code && code !== existingRole.code) {
    const conflictRole = await prisma.role.findFirst({ where: { code, id: { not: id } } });
    if (conflictRole) {
      return errorResponse(res, 400, '角色编码已存在');
    }
  }

  // 更新角色基本信息
  await prisma.role.update({
    where: { id },
    data: {
      name: name || existingRole.name,
      code: code || existingRole.code,
      description,
      status: status || existingRole.status,
    },
  });

  // 更新权限
  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  
  if (menus && menus.length > 0) {
    await prisma.rolePermission.createMany({
      data: menus.map((m: any) => ({
        roleId: id,
        menuId: m.menuId,
        permission: m.permission,
      })),
    });
  }

  return successResponse(res, {
    id: existingRole.id,
    roleId: existingRole.roleId,
    name: name || existingRole.name,
    status: status || existingRole.status,
  }, '更新成功');
}));

// 删除角色
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const role = await prisma.role.findUnique({ 
    where: { id },
    include: { _count: { select: { users: true } } }
  });
  
  if (!role) {
    return errorResponse(res, 404, '角色不存在');
  }

  if (role._count.users > 0) {
    return errorResponse(res, 400, `该角色已被${role._count.users}个用户使用，无法删除`);
  }

  // 删除角色权限关联
  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  
  await prisma.role.delete({ where: { id } });

  return successResponse(res, null, '删除成功');
}));

export default router;
