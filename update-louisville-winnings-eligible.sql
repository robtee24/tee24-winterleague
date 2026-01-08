-- Update Louisville players winnings eligibility
-- Step 1: Set all Louisville players to NOT eligible
UPDATE "Player"
SET "winningsEligible" = false
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville');

-- Step 2: Set specific players to eligible
-- Uses case-insensitive matching and allows for variations in names
UPDATE "Player"
SET "winningsEligible" = true
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
  AND (
    (LOWER("firstName") LIKE 'bj%' AND LOWER("lastName") LIKE 'nichols%') OR
    (LOWER("firstName") LIKE 'jay%' AND LOWER("lastName") LIKE 'sharp%') OR
    (LOWER("firstName") LIKE 'tj%' AND LOWER("lastName") LIKE 'mcnelis%') OR
    (LOWER("firstName") LIKE 'matthew%' AND LOWER("lastName") LIKE 'ansert%') OR
    (LOWER("firstName") LIKE 'cody%' AND LOWER("lastName") LIKE 'wheeler%') OR
    (LOWER("firstName") LIKE 'eric%' AND LOWER("lastName") LIKE 'johnson%') OR
    (LOWER("firstName") LIKE 'ben%' AND LOWER("lastName") LIKE 'martin%') OR
    (LOWER("firstName") LIKE 'jody%' AND LOWER("lastName") LIKE 'speaks%') OR
    (LOWER("firstName") LIKE 'tyler%' AND LOWER("lastName") LIKE 'langdon%')
  );

-- Verify the changes
SELECT 
  "firstName",
  "lastName",
  "winningsEligible"
FROM "Player"
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
ORDER BY "winningsEligible" DESC, "firstName", "lastName";

