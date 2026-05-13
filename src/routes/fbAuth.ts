import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler, successResponse, errorResponse } from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 获取FB授权列表
router.get('/', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.fBAuthorization.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.fBAuthorization.count(),
  ]);

  return successResponse(res, { data, total, page, pageSize });
}));

// 删除FB授权
router.delete('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const auth = await prisma.fBAuthorization.findUnique({ where: { id } });
  if (!auth) {
    return errorResponse(res, 404, '授权记录不存在');
  }

  await prisma.fBAuthorization.delete({ where: { id } });
  return successResponse(res, null, '删除成功');
}));

// FB OAuth 授权登录（重定向到Facebook）
router.get('/facebook', (req: Request, res: Response) => {
  // 这里需要配置Facebook OAuth
  // 重定向到Facebook授权页面
  const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your_facebook_app_id';
  const REDIRECT_URI = encodeURIComponent(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/facebook/callback`);
  const FACEBOOK_AUTH_URL = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=ads_management,ads_read`;

  res.redirect(FACEBOOK_AUTH_URL);
});

// FB OAuth 回调
router.get('/facebook/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return errorResponse(res, 400, '授权失败：未获取到授权码');
  }

  try {
    // 使用code换取access_token
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || 'your_facebook_app_id';
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'your_facebook_app_secret';

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}&redirect_uri=${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/facebook/callback`
    );
    const tokenData = await tokenResponse.json() as { access_token?: string };

    if (!tokenData.access_token) {
      return errorResponse(res, 400, '获取Access Token失败');
    }

    // 获取用户ID
    const userResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${tokenData.access_token}`
    );
    const userData = await userResponse.json() as { id?: string };

    // 获取广告账号列表
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${userData.id}/adaccounts?access_token=${tokenData.access_token}`
    );
    const accountsData = await accountsResponse.json() as { data?: any[] };

    // 计算token过期时间（假设90天后过期）
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 90);

    // 保存到数据库
    const auth = await prisma.fBAuthorization.create({
      data: {
        userId: userData.id,
        tokenExpiry,
        adAccounts: JSON.stringify(accountsData.data || []),
        createdBy: (req as any).user?.userId,
      },
    });

    // 重定向到前端页面，并传递token
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendURL}/login?token=${tokenData.access_token}&user=${encodeURIComponent(JSON.stringify({ id: auth.id, userId: auth.userId }))}`);
  } catch (error) {
    console.error('FB OAuth callback error:', error);
    return errorResponse(res, 500, '授权回调处理失败');
  }
}));

export default router;
