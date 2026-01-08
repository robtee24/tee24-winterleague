# ✅ Pre-Deployment Checklist

Use this checklist to ensure everything is ready before deploying.

## Code Preparation

- [x] All members and scores deleted from database
- [ ] Code committed to Git
- [ ] Code pushed to GitHub repository
- [ ] `.env` file is in `.gitignore` (should not be committed)
- [ ] No sensitive data in code

## Supabase Setup

- [ ] Supabase project created
- [ ] Database password saved securely
- [ ] Storage bucket `scorecards` created
- [ ] Storage bucket set to **Public**
- [ ] Database connection string copied
- [ ] Supabase API keys copied:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`

## GitHub Setup

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Repository is accessible

## Vercel Setup

- [ ] Vercel account created/accessed
- [ ] Project imported from GitHub
- [ ] Environment variables added:
  - [ ] `DATABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Build settings verified
- [ ] Initial deployment successful

## Domain Setup

- [ ] Domain `league.tee24.golf` added in Vercel
- [ ] DNS records configured
- [ ] DNS propagation verified (can take 24-48 hours)
- [ ] SSL certificate active (automatic via Vercel)

## Database Setup

- [ ] Database schema pushed (`npx prisma db push`)
- [ ] Initial leagues seeded (Clarksville, Louisville)
- [ ] Test data added (optional)

## Testing

- [ ] Home page loads
- [ ] League selection works
- [ ] Score submission flow works
- [ ] Image upload works (check Supabase Storage)
- [ ] Admin portal accessible (`/league-manager`)
- [ ] Password protection works
- [ ] Leaderboard displays correctly
- [ ] All pages load without errors

## Security

- [ ] Admin password set: `CABenson123$`
- [ ] Directory password set: `WinterLeague`
- [ ] Environment variables are secure (not in code)
- [ ] Service role key is kept secret

## Post-Deployment

- [ ] Add initial players
- [ ] Add courses for each week
- [ ] Test full submission flow
- [ ] Verify scorecard images upload correctly
- [ ] Check leaderboard updates correctly

---

## Quick Commands Reference

```bash
# Initialize Git (if not done)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/tee24-league.git
git push -u origin main

# Run database migrations (after deployment)
npx prisma db push

# Seed initial data
npm run seed
```

---

## Support Resources

- **Full Deployment Guide**: See `DEPLOYMENT_GUIDE.md`
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs


