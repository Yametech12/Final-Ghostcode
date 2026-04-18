# 🚀 DEPLOYMENT ENVIRONMENT SETUP

## 📋 Pre-Deployment Checklist

### ✅ CRITICAL SECURITY STEPS (DO FIRST)

1. **🔴 GENERATE NEW SUPABASE SERVICE ROLE KEY**
   ```
   Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
   - Click "Generate new secret" under service_role
   - Copy the new key IMMEDIATELY
   - Update SUPABASE_SERVICE_ROLE_KEY in .env (backend only, NEVER prefix with VITE_)
   - NEVER use the old hardcoded key again!
   ```

2. **🔴 VERIFY ALL SECRETS ARE SECURE**
   - [ ] No .env files in version control
   - [ ] Different keys for staging/production
   - [ ] API keys have proper restrictions
   - [ ] Service role key is newly generated

### ✅ Environment Variables Setup

Copy `.env.example` to `.env` and fill in these values:

#### **Required for Basic Functionality:**
```bash
# App
APP_URL=https://epimetheusproject.vercel.app

# Supabase (CRITICAL - get from dashboard)
VITE_SUPABASE_URL=https://cuinkiyozecqkskmufgo.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[NEWLY-GENERATED-service-key]

# AI API
OPENROUTER_API_KEY=[your-openrouter-key]
OPENROUTER_REFERER=https://epimetheus.ai
OPENROUTER_TITLE=Epimetheus

# Email
GMAIL_USER=epimetheus.support@gmail.com
GMAIL_APP_PASSWORD=[gmail-app-password]
```

#### **Optional (for file uploads):**
```bash
# GCP Configuration
GCP_PROJECT_ID=project-627c02f7-938c-4eb2-a8e
GCP_PROJECT_NUMBER=480545372219
GCP_SERVICE_ACCOUNT_EMAIL=[your-service-account]
GCP_BUCKET_NAME=epimetheusproject-user-files
GCP_WORKLOAD_IDENTITY_POOL_ID=epimetheus-pool
GCP_WORKLOAD_IDENTITY_PROVIDER_ID=vercel-provider
```

## 🌍 DEPLOYMENT PLATFORMS

### **Vercel Deployment**
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add all variables from your `.env` file
3. **Important**: Set `NODE_ENV=production` for production builds
4. Redeploy after adding variables

### **Environment-Specific Variables**
```bash
# Development
NODE_ENV=development
APP_URL=http://localhost:5173

# Staging
NODE_ENV=production
APP_URL=https://epimetheus-staging.vercel.app

# Production
NODE_ENV=production
APP_URL=https://epimetheusproject.vercel.app
```

## 🔍 VERIFICATION CHECKS

### **After Deployment, Test These:**

1. **Session Loading**:
   ```javascript
   // In browser console at your deployed URL
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   console.log('Session test...');
   ```

2. **API Endpoints**:
   - Visit: `https://your-domain.com/api/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

3. **Database Connection**:
   - Check Supabase dashboard for active connections
   - Verify RLS policies are applied

4. **Authentication**:
   - Try login/signup flow
   - Check if email verification works

## 🚨 COMMON DEPLOYMENT ISSUES

### **Issue: Session timeouts after deployment**
**Fix**: Check environment variables are set in Vercel dashboard

### **Issue: API calls fail with CORS**
**Fix**: Verify APP_URL matches your deployment domain exactly

### **Issue: Database operations fail**
**Fix**: Ensure service role key is set and RLS policies are correct

### **Issue: Email not sending**
**Fix**: Verify Gmail app password and 2FA is enabled

## 📊 MONITORING

### **Post-Deployment Checks:**
- [ ] Browser console shows no Supabase errors
- [ ] Login/logout works reliably
- [ ] API endpoints respond correctly
- [ ] No session timeout errors in logs
- [ ] Email verification emails are received

### **Supabase Dashboard Monitoring:**
- [ ] Check for unusual error rates
- [ ] Monitor API usage
- [ ] Verify database performance
- [ ] Check for failed auth attempts

## 🔐 SECURITY VERIFICATION

- [ ] No sensitive keys in browser console logs
- [ ] Service role key is not exposed in frontend
- [ ] Environment variables are properly scoped
- [ ] API keys have usage limits configured

---

## 🎯 FINAL CHECKLIST

**Before going live:**
- [ ] ✅ New service role key generated and deployed
- [ ] ✅ All environment variables set in deployment platform
- [ ] ✅ Database schema applied (supabase-schema.sql)
- [ ] ✅ Storage policies configured (supabase-storage-setup.sql)
- [ ] ✅ Test login/logout flow works
- [ ] ✅ Test AI chat functionality
- [ ] ✅ Test email verification
- [ ] ✅ Monitor for 24 hours after deployment

**🚀 Ready for production!**