// @ts-nocheck
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse, paginatedResponse } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取管理员用户列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as any;
  const where: any = {};
  if (q.email) where.email = { contains: q.email };
  if (q.name) where.name = { contains: q.name };
  if (q.status && q.status !== 'all') where.status = q.status;
  if (q.deptId) where.deptId = q.deptId;
  if (q.roleId) where.roleId = q.roleId;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { dept: true, userRole: true }
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u: any) => ({
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

  return paginatedResponse(res, data, total, 1, 20);
}));

// 获取单个管理员用户
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { dept: true, userRole: true }
  });
  if (!user) return errorResponse(res, 404, '用户不存在');
  return successResponse(res, user);
}));

// 新建管理员用户
router.post('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, name, phone, deptId, roleId, status } = req.body;
  if (!email || !password) return errorResponse(res, 400, '邮箱和密码不能为空');

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) return errorResponse(res, 400, '邮箱或用户名已存在');

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashed, name, phone, deptId, roleId, status: status || 'active' }
  });
  return successResponse(res, user, '创建成功');
}));

// 编辑管理员用户
router.put('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, name, phone, deptId, roleId, status } = req.body;
  const data: any = {};
  if (email !== undefined) data.email = email;
  if (username !== undefined) data.username = username;
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (deptId !== undefined) data.deptId = deptId;
  if (roleId !== undefined) data.roleId = roleId;
  if (status !== undefined) data.status = status;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  return successResponse(res, user, '更新成功');
}));

// 删除管理员用户
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === (req as any).user?.userId) {
    return errorResponse(res, 400, '不能删除自己');
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  return successResponse(res, null, '删除成功');
}));

// 重置密码
router.post('/:id/reset-password', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) return errorResponse(res, 400, '密码不能为空');
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
  return successResponse(res, null, '密码重置成功');
}));

export default router;
