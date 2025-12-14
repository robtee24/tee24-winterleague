# Quick Supabase Setup Steps

## Step 1: Create Storage Bucket

1. Go to your Supabase project dashboard
2. Click **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Name: `scorecards` (exactly this name)
5. **Make it Public** (toggle ON)
6. Click **Create bucket**

## Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → This is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Go to **Settings** → **Database**
4. Find **Connection string** → **URI**
5. Copy the connection string → This is `DATABASE_URL`
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
   - Replace `[YOUR-PASSWORD]` with your actual database password

## Step 3: Create .env.local File

Create a file named `.env.local` in the root directory with:

```env
DATABASE_URL="your-database-connection-string-here"
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-here"
```

## Step 4: Run Setup Commands

After creating `.env.local`, run:
```bash
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```



