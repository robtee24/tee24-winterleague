# Tee24 League - Golf Score Submission App

A comprehensive golf league management system for submitting and tracking golf scores.

## Features

### Public Features
- **League Selection**: Choose between different leagues (Louisville, Clarksville)
- **Scorecard Submission**: Multi-step process for submitting scores
  - Select players (1-4 players per scorecard)
  - Select course/week
  - Enter Front 9 scores
  - Enter Back 9 scores
  - Review all 18 holes
  - Upload scorecard photo (optional)
- **Success Confirmation**: Confirmation page after successful submission

### Admin Portal (`/league-manager`)
- **Location Selection**: Choose league to manage
- **Roster Management**: Add players with first and last name
- **Player Detail View**: 
  - View scores by week (1-11, Championship)
  - Edit individual scores
  - Set/manage handicap
  - View scorecard images
- **Scores Chart**: 
  - View unweighted and weighted scores
  - Export to CSV
  - See missing scores highlighted in red
- **Week Detail View**: 
  - Full league scorecard for each week
  - All holes, front 9, back 9, total, weighted score
  - Scorecard images
  - Export to CSV
- **Week Links**: Quick access to weeks 1-11 and championship

### Leaderboard (`/leaderboard`)
- **Public Leaderboard**: 
  - Weighted scores (default) and unweighted scores tabs
  - Sorted by lowest to highest total
  - League selection (if multiple leagues)

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

3. (Optional) Seed initial data:
```bash
# You can create a seed script or manually add leagues through the API
# Example: POST to /api/leagues with { "name": "Louisville" }
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Database Setup

The app uses **PostgreSQL with Supabase** (or any PostgreSQL database). See `SUPABASE_SETUP.md` for detailed setup instructions.

**Quick Setup:**
1. Get your Supabase connection string from your project settings
2. Create a `.env` file with: `DATABASE_URL="your-connection-string"`
3. Run: `npx prisma generate && npx prisma db push`
4. (Optional) Seed data: `npm run seed`

To add initial leagues, you can:
1. Use the API directly: `POST /api/leagues` with `{ "name": "Louisville" }`
2. Or create a seed script in `prisma/seed.ts`

### Adding Courses

Courses need to be added through the API:
```bash
POST /api/courses
{
  "name": "Course Name",
  "week": 1,
  "leagueId": 1
}
```

### File Structure

```
/app
  /api          - API routes
  /league-manager - Admin portal pages
  /leaderboard   - Leaderboard page
  /submit        - Score submission flow
  page.tsx       - Home page
/lib
  prisma.ts     - Prisma client
/prisma
  schema.prisma - Database schema
/public
  /uploads      - Uploaded scorecard images
```

## Usage

### For Players
1. Visit the home page
2. Select your league
3. Follow the submission flow:
   - Select yourself and up to 3 additional players
   - Select the course/week
   - Enter scores for each player (Front 9, then Back 9)
   - Review and confirm scores
   - Upload scorecard photo (optional)
4. Submit and receive confirmation

### For Admins
1. Visit `/league-manager`
2. Select the league to manage
3. Add players to the roster
4. Set player handicaps
5. View and edit scores
6. Export data to CSV
7. View weekly scorecards

### For Viewers
1. Visit `/leaderboard`
2. View weighted or unweighted scores
3. See rankings sorted by total score

## Technical Details

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Supabase
- **File Storage**: Supabase Storage
- **Deployment**: Vercel-ready

## Notes

- Scorecard images are stored in Supabase Storage (bucket: `scorecards`)
- The app is fully compatible with Vercel deployment
- See `VERCEL_SETUP.md` for deployment instructions
- Weighted scores are calculated as: Total Score - Handicap
- All scores are stored per player per week
- Missing scores are highlighted in red in the admin view

