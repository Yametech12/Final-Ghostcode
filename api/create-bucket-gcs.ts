import "dotenv/config";
import { bucket } from './gcs';

async function createBucket() {
  try {
    const [bucketExists] = await bucket.exists();
    if (bucketExists) {
      console.log('Bucket already exists');
      return;
    }

    await bucket.create({
      cors: [
        {
          origin: ['*'], // Adjust origins as needed
          method: ['GET', 'POST', 'PUT', 'DELETE'],
          responseHeader: ['Content-Type'],
          maxAgeSeconds: 3600,
        },
      ],
      versioning: {
        enabled: false,
      },
    });

    console.log('Bucket created successfully');
  } catch (error) {
    console.error('Error creating bucket:', error);
  }
}

createBucket();
