# Quick Setup Guide

## Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Seed initial leagues (optional):**
   ```bash
   npm run seed
   ```
   This will create "Louisville" and "Clarksville" leagues.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Adding Initial Data

### Add a Course

You can add courses through the API or create a simple script. For example:

```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pebble Beach",
    "week": 1,
    "leagueId": 1
  }'
```

Or use the browser console on the admin page (you'll need to add this functionality).

### Add Players

Players can be added through the admin portal at `/league-manager`:
1. Select a league
2. Click "Add a member"
3. Enter first and last name
4. Click "Add Player"

### Set Handicaps

1. Go to `/league-manager`
2. Select a league
3. Click on a player's name
4. Enter their handicap
5. Click "Update Handicap"

## First Time Usage

1. **As Admin:**
   - Go to `/league-manager`
   - Add players to your league
   - Set up courses for each week
   - Set player handicaps

2. **As Player:**
   - Go to the home page
   - Select your league
   - Start submitting scores!

## Notes

- The database file is created at `prisma/dev.db`
- Uploaded images are stored in `public/uploads`
- Make sure the `public/uploads` directory exists and is writable




