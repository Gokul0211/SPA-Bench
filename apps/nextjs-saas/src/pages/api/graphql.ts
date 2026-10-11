import type { NextApiRequest, NextApiResponse } from 'next';

const GRAPHQL_BACKEND = process.env.GRAPHQL_BACKEND_URL || 'http://graphql-backend:4002';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'GraphQL endpoint',
      introspection: 'enabled',
    });
  }

  // POST — proxy to Apollo Server
  if (req.method === 'POST') {
    const authHeader = req.headers.authorization || '';
    const response = await fetch(`${GRAPHQL_BACKEND}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
