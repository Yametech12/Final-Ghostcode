import { Storage } from '@google-cloud/storage';
import { ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

const projectId = process.env.GCP_PROJECT_ID;
const bucketName = process.env.GCP_BUCKET_NAME;

// For Vercel deployment
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

let storage: Storage;

if (isVercel) {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID;

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken(),
    },
  });

  storage = new Storage({
    projectId,
    authClient: authClient as any,
  });
} else {
  // For local development, use service account key
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCP_SERVICE_ACCOUNT_KEY_PATH;
  storage = new Storage({
    projectId,
    keyFilename,
  });
}

const bucket = storage.bucket(bucketName);

export { storage, bucket };
