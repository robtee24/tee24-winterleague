# Vercel Environment Variables Checklist

Use this checklist to verify all environment variables in Vercel match your local setup.

## Your Local Environment Variables

Here are the exact values from your `.env.local` file:

### 1. DATABASE_URL
```
postgresql://postgres:CarolAnneBensopn123$@db.uotzgzpeqstouinlwbxr.supabase.co:5432/postgres
```

### 2. NEXT_PUBLIC_SUPABASE_URL
```
https://uotzgzpeqstouinlwbxr.supabase.co
```

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdHpnenBlcXN0b3Vpbmx3YnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MTIzODksImV4cCI6MjA4MTE4ODM4OX0._Ua4air1NwcFDk2u_eScrC7xTP9IShTc3AX8xfDvWWU
```

### 4. SUPABASE_SERVICE_ROLE_KEY
```
sb_secret_Dy179FVEikV9qUD9CMgCmw_iQRnbqHO
```

---

## How to Verify in Vercel

1. Go to: https://vercel.com/dashboard
2. Click on your project: `tee24-winterleague`
3. Go to: **Settings** → **Environment Variables**
4. Verify each variable below matches exactly

### ✅ Checklist

- [ ] **DATABASE_URL**
  - Value: `postgresql://postgres:CarolAnneBensopn123$@db.uotzgzpeqstouinlwbxr.supabase.co:5432/postgres`
  - Environments: Production, Preview, Development (all three)
  
- [ ] **NEXT_PUBLIC_SUPABASE_URL**
  - Value: `https://uotzgzpeqstouinlwbxr.supabase.co`
  - Environments: Production, Preview, Development (all three)
  
- [ ] **NEXT_PUBLIC_SUPABASE_ANON_KEY**
  - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvdHpnenBlcXN0b3Vpbmx3YnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MTIzODksImV4cCI6MjA4MTE4ODM4OX0._Ua4air1NwcFDk2u_eScrC7xTP9IShTc3AX8xfDvWWU`
  - Environments: Production, Preview, Development (all three)
  
- [ ] **SUPABASE_SERVICE_ROLE_KEY**
  - Value: `sb_secret_Dy179FVEikV9qUD9CMgCmw_iQRnbqHO`
  - Environments: Production, Preview, Development (all three)

---

## Important Notes

1. **Copy exactly** - Make sure there are no extra spaces, line breaks, or quotes
2. **All environments** - Each variable should be set for Production, Preview, AND Development
3. **After updating** - You'll need to redeploy for changes to take effect
4. **No quotes needed** - Vercel handles quotes automatically, don't add them

---

## After Updating

1. Click **Save** after updating each variable
2. Go to **Deployments** tab
3. Click **Redeploy** on the latest deployment (or it will auto-redeploy)
4. Wait 1-2 minutes for deployment to complete
5. Refresh your site - leagues should appear!


