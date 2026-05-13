import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse } from '../utils/helpers';
import { authMiddleware, JwtPayload } from '../middleware/auth';
import { createLoginLog } from '../middleware/operationLog';

const router = Router();

// 获取客户端IP
const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket?.remoteAddress ||
    '';
};

// 登录
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, '请输入邮箱和密码');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // 记录登录失败
    await createLoginLog({
      userId: 'unknown',
      username: email,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'failed',
      message: '用户不存在',
    });
    return errorResponse(res, 401, '用户不存在');
  }

  if (user.status !== 'active') {
    // 记录登录失败
    await createLoginLog({
      userId: user.id,
      username: user.email,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'failed',
      message: '账号已被禁用',
    });
    return errorResponse(res, 401, '账号已被禁用');
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    // 记录登录失败
    await createLoginLog({
      userId: user.id,
      username: user.email,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'failed',
      message: '密码错误',
    });
    return errorResponse(res, 401, '密码错误');
  }

  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.name || user.email,
    role: user.role,
  };

  const signOptions: SignOptions = { expiresIn: '7d' };
  const token = jwt.sign(payload, JWT_SECRET, signOptions);

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { updatedAt: new Date() },
  });

  // 记录登录成功
  await createLoginLog({
    userId: user.id,
    username: user.email,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    status: 'success',
    message: '登录成功',
  });

  return successResponse(res, {
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
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, username } = req.body;

  if (!email || !password) {
    return errorResponse(res, 400, '请输入邮箱和密码');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return errorResponse(res, 400, '该邮箱已被注册');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      role: 'admin',
      username: username || email.split('@')[0],
    },
  });

  return successResponse(res, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }, '注册成功');
}));

// 获取当前用户信息
router.get('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
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
    return errorResponse(res, 404, '用户不存在');
  }

  return successResponse(res, user);
}));

// 修改密码
router.put('/password', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return errorResponse(res, 400, '请输入原密码和新密码');
  }

  if (newPassword.length < 6) {
    return errorResponse(res, 400, '新密码长度不能少于6位');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user) {
    return errorResponse(res, 404, '用户不存在');
  }

  const isValidPassword = await bcrypt.compare(oldPassword, user.password);

  if (!isValidPassword) {
    return errorResponse(res, 400, '原密码错误');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { password: hashedPassword },
  });

  return successResponse(res, null, '密码修改成功');
}));

export default router;
