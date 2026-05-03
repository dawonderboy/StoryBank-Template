import type { VercelRequest, VercelResponse } from '@vercel/node';

// Disable body parsing — we handle multipart/form-data manually as a stream
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Accept Groq key either from request header or from Vercel env var
  const apiKey = (req.headers['x-api-key'] as string) || process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: { message: 'No Groq API key provided' } });
  }

  try {
    // Read the raw body (multipart/form-data with the audio blob)
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    // Forward to Groq, preserving the multipart Content-Type with boundary
    const contentType = req.headers['content-type'] || 'multipart/form-data';

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentType,
      },
      body,
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e: unknown) {
    return res.status(500).json({
      error: { message: e instanceof Error ? e.message : 'Groq proxy failed' }
    });
  }
}
