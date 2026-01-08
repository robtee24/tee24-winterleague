# Update Louisville Players Winnings Eligibility

This will set all Louisville players to NOT eligible, then set specific players to eligible.

## Option 1: Using SQL (Recommended - Easiest)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy and paste the contents of `update-louisville-winnings-eligible.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Review the results at the bottom to verify the changes

## Option 2: Using TypeScript Script

If you prefer to run it locally:

```bash
npx tsx scripts/update-louisville-winnings-eligible.ts
```

**Note:** Make sure your `.env` file has the correct `DATABASE_URL` pointing to your Supabase database.

## Players Set to Eligible

- BJ Nichols
- Jay Sharp
- TJ Mcnelis
- Matthew Ansert
- Cody Wheeler
- Eric Johnson
- Ben Martin
- Jody Speaks
- Tyler Langdon

All other Louisville players will be set to NOT eligible.

