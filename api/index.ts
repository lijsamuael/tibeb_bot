import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'ok',
    message: 'Tibeb Bot is running',
    endpoints: {
      webhook: '/api/commands',
      health: '/api/index'
    },
    timestamp: new Date().toISOString()
  });
}
