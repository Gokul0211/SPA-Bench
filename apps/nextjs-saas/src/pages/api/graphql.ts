/**
 * SPABench App E — Next.js GraphQL API route
 *
 * EP-E-001: GRAPHQL http://localhost:3005/graphql
 * technique: graphql_endpoint_heuristic (TC-P4-001)
 * phase: 4
 *
 * This Next.js API route forwards to the shared graphql-backend (port 4002).
 * On GET it returns a JSON indicator (TC-P4-001 probes for this).
 * On POST it proxies the GraphQL operation to apollo-server.
 *
 * All 17 resolver signatures (EP-E-GQL-001 through EP-E-GQL-017) are
 * exclusively discoverable via introspection (TC-P4-002) against this endpoint.
 * Zero competitor tools attempted introspection in the paper evaluation.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

const GRAPHQL_BACKEND = process.env.GRAPHQL_BACKEND_URL || 'http://graphql-backend:4002';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TC-P4-001 (graphql_endpoint_heuristic):
  // GET /graphql → 200 with JSON playground indicator
  // Tools probe common GraphQL paths and check for this response pattern.
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'SPABench GraphQL endpoint',
      introspection: 'enabled',
      playground: '/graphql',
      version: '17 resolvers (8 Query, 6 Mutation, 3 Subscription)',
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
