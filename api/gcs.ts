import { Storage } from '@google-cloud/storage';
import { ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

const projectId = process.env.GCP_PROJECT_ID;
const projectNumber = process.env.GCP_PROJECT_NUMBER;
const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const bucketName = process.env.GCP_BUCKET_NAME;
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

const storage = new Storage({
  projectId,
  authClient: authClient as any,
});

const bucket = storage.bucket(bucketName);

export { storage, bucket };