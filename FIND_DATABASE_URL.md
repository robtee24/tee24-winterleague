# How to Find Your Database Connection String

## Option 1: From Supabase Dashboard

1. Go to your Supabase project dashboard
2. Click **Settings** (gear icon) in the left sidebar
3. Click **Database** in the settings menu
4. Scroll down to **Connection string** section
5. Look for **URI** tab
6. Copy the connection string - it will look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.uotzgzpeqstouinlwbxr.supabase.co:5432/postgres
   ```

## Option 2: If You Don't See the Password

If the password is hidden with `[YOUR-PASSWORD]`:

1. In the same Database settings page
2. Look for **Database password** section
3. You can either:
   - **Reset password** (if you forgot it) - Click "Reset database password"
   - **Use existing password** - If you set one during project creation

## Option 3: Construct It Manually

If you know your database password, the format is:
```
postgresql://postgres:[YOUR-PASSWORD]@db.uotzgzpeqstouinlwbxr.supabase.co:5432/postgres
```

Just replace `[YOUR-PASSWORD]` with your actual password.

## After You Have It

1. Open `.env.local` file
2. Replace `[YOUR-PASSWORD]` in the `DATABASE_URL` with your actual password
3. Save the file
4. Then run: `npx prisma db push`




