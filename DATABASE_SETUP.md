# Database Setup Guide

## Overview

This project uses Supabase as the database backend. The schema has been updated to fix foreign key mismatches and RLS policy issues.

## Schema Files

- `supabase-schema-v2.sql` – **MASTER SCHEMA** (use this)
- `supabase-storage-setup.sql` – optional storage bucket creation (separate step)

## Schema Changes from v1 → v2

### Critical Fix: `users` Table Primary Key

**Before (broken)**:
- `id` – UUID primary key (random, not used)
- `uid` – TEXT field that stored auth user ID
- Child tables referenced `users.id`, but app inserted into `uid` → **FK violations**

**After**:
- `id` – TEXT primary key that stores the Supabase auth UID (UUID)
- `uid` column **removed**
- All child tables reference `users.id` correctly

### Admin RLS Function Fixed

`is_admin()` now reads from `users` table directly via `SECURITY DEFINER` instead of relying on JWT app_metadata (which is not automatically synced).

## Deployment Steps

### 1. Backup Existing Data (if applicable)

If you have existing data you want to preserve:

```sql
-- Backup users table
CREATE TABLE users_backup AS SELECT * FROM users;

-- Backup all other tables
CREATE TABLE calibrations_backup AS SELECT * FROM calibrations;
-- ... repeat for all tables
```

### 2. Apply New Schema

**Option A: Fresh Database (Recommended for Development)**

If this is a dev environment and you can reset:

1. In Supabase SQL Editor, run:
   ```sql
   -- Drop all tables CASCADE
   DROP TABLE IF EXISTS verification_codes CASCADE;
   DROP TABLE IF EXISTS assessment_results CASCADE;
   DROP TABLE IF EXISTS advisor_messages CASCADE;
   DROP TABLE IF EXISTS advisor_sessions CASCADE;
   DROP TABLE IF EXISTS dossiers CASCADE;
   DROP TABLE IF EXISTS favorites CASCADE;
   DROP TABLE IF EXISTS field_report_comments CASCADE;
   DROP TABLE IF EXISTS report_likes CASCADE;
   DROP TABLE IF EXISTS field_reports CASCADE;
   DROP TABLE IF EXISTS feedback CASCADE;
   DROP TABLE IF EXISTS oracle_analyses CASCADE;
   DROP TABLE IF EXISTS calibrations CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS public_config CASCADE;
   DROP TABLE IF EXISTS private_config CASCADE;
   
   -- DROP functions/triggers
   DROP FUNCTION IF EXISTS is_admin() CASCADE;
   DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
   ```

2. Run `supabase-schema-v2.sql` in the SQL Editor.

3. Create storage bucket:
   - In Supabase Dashboard → Storage → Buckets → New Bucket
   - Name: `user-uploads`
   - Public: ✓ enabled
   - Max file size: 5 MB
   - Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

**Option B: Migrate Existing Database (Production)**

If you have live data and cannot drop tables:

1. Run `supabase-schema-v2.sql` directly.
   - The script uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... DROP COLUMN IF EXISTS`
   - It will alter the existing `users` table to drop the `uid` column
   - Foreign keys will point to `users.id` (which currently contains random UUIDs)
2. **Problem**: Existing users have random `id` values, not their auth UIDs.
3. **Fix**: Run this data migration:
   ```sql
   -- Update users.id to match auth.uid() for each user
   UPDATE users u
   SET id = auth.uid()
   FROM auth.users au
   WHERE u.id != au.id AND u.email = au.email;
   ```
   *Note:* This requires the `auth.users` table to be accessible. You may need to run as superuser or use a service role key.
4. After migration, verify:
   ```sql
   SELECT u.id, u.email, au.id as auth_id 
   FROM users u 
   JOIN auth.users au ON u.email = au.email 
   LIMIT 5;
   ```
   The `id` and `auth_id` should match.
5. If the above doesn't work, consider manually copying data:
   - Export user data
   - Delete from `users`
   - Re-insert with correct `id = auth_uid`

### 3. Verify RLS Policies

After schema application, test with these queries:

```sql
-- Test is_admin() function (should return false for non-admin)
SELECT public.is_admin();

-- Check if RLS is enabled
SELECT tablename, rowsecurityenabled 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'feedback', 'field_reports');
```

### 4. Create an Admin User

To create an admin user, update the `users` table:

```sql
UPDATE users 
SET role = 'admin' 
WHERE id = 'your-auth-user-uuid-here';
```

To get your auth UID:
- Sign in to the app
- Check browser console: `supabase.auth.getUser()` or inspect the JWT token
- Or query: `SELECT id FROM auth.users WHERE email = 'your-email@example.com';`

## Testing After Deployment

1. **Sign Up a New User**
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"SecurePass123"}'
   ```
   - Should create user in `auth.users` AND `public.users`
   - `public.users.id` should equal `auth.users.id`
   - No foreign key errors

2. **Login**
   - Should fetch `userData` successfully via `loadUserData(user.id)`
   - No "No profile record found" errors (unless first login)

3. **Create Advisor Session**
   ```bash
   curl -X POST http://localhost:3000/api/advisor/session \
     -H "Content-Type: application/json" \
     -d '{"userId":"your-uuid","title":"Test"}'
   ```
   - Should insert into `advisor_sessions` without error

4. **Admin Dashboard**
   - Log in as admin user
   - Navigate to `/admin`
   - Should see all users
   - Should be able to change roles and delete users

5. **Feedback Submission**
   - Submit feedback from UI
   - Should appear in `feedback` table
   - Admin should be able to delete it

## Troubleshooting

### Error: "insert or update on table 'users' violates foreign key constraint"
- The `id` being inserted doesn't exist in `auth.users`
- Fix: Ensure signup code uses `id: data.user.id` (already fixed in codebase)

### Error: "new row violates row-level security policy"
- RLS policy blocking the operation
- Check that `auth.uid()` matches `user_id` in your request
- Verify policies are loaded: `SELECT * FROM pg_policies WHERE tablename = 'users';`

### Admin can't see all users
- `is_admin()` returning false
- Verify admin role: `SELECT role FROM users WHERE id = auth.uid();`
- Check that function exists: `SELECT * FROM pg_proc WHERE proname = 'is_admin';`

### Feedback table is empty/no policies
- Check policies exist:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'feedback';
  ```
- If missing, re-run `supabase-schema-v2.sql`

## Environment Variables

Ensure `.env` has:
```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Required for bucket creation
OPENROUTER_API_KEY=sk-or...
VITE_RECAPTCHA_SITE_KEY=...       # Optional but recommended
```

The app validates these on startup.

## Additional Notes

- Storage bucket `user-uploads` must be created separately in Storage tab
- GCS integration uses Workload Identity Federation (Vercel only)
- `advisor_sessions.updated_at` auto-updates via trigger
- All timestamps are `TIMESTAMPTZ` (UTC)
