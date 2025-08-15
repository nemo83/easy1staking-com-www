import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { txHash } = req.query;

  if (!txHash || typeof txHash !== 'string') {
    return res.status(400).json({ error: 'Transaction hash is required' });
  }

  try {
    const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
    if (!blockfrostApiKey) {
      return res.status(500).json({ error: 'Blockfrost API key not configured' });
    }

    const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/txs/${txHash}`, {
      headers: {
        'project_id': blockfrostApiKey
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.status(200).json({ confirmed: true, data });
    } else if (response.status === 404) {
      res.status(404).json({ confirmed: false, error: 'Transaction not found' });
    } else {
      const error = await response.text();
      res.status(response.status).json({ confirmed: false, error });
    }
  } catch (error) {
    console.error('Transaction verification error:', error);
    res.status(500).json({ confirmed: false, error: 'Internal server error' });
  }
}