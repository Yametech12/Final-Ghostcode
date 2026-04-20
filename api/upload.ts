import { bucket } from './gcs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileName, contentType, userId } = req.body;

  if (!fileName || !contentType || !userId) {
    return res.status(400).json({ error: 'Missing required fields: fileName, contentType, userId' });
  }

  try {
    // Ensure user uploads to their own folder
    const filePath = `${userId}/${fileName}`;

    const file = bucket.file(filePath);

    const [url] = await file.generateSignedPostPolicyV4({
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      conditions: [
        ['eq', '$Content-Type', contentType],
        ['content-length-range', 0, 5242880], // 5MB max
      ],
      fields: {
        'Content-Type': contentType,
      },
    });

    res.status(200).json({ url, fields: url.fields });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}