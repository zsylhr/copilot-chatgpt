import { NowRequest, NowResponse } from '@vercel/node';

export default (req: NowRequest, res: NowResponse) => {
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    // 在这里处理接收到的请求
    console.log('接收到请求：', req.body);

    // 返回响应
    res.json({ message: '请求已接收' });
  } else {
    res.status(404).json({ error: '未找到该路由' });
  }
};
