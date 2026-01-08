-- Update Louisville players winnings eligibility
-- Step 1: Set all Louisville players to NOT eligible
UPDATE "Player"
SET "winningsEligible" = false
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville');

-- Step 2: Set specific players to eligible
-- Note: Adjust names if they don't match exactly in the database
UPDATE "Player"
SET "winningsEligible" = true
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
  AND (
    ("firstName" = 'BJ' AND "lastName" = 'Nichols') OR
    ("firstName" = 'Jay' AND "lastName" = 'Sharp') OR
    ("firstName" = 'TJ' AND "lastName" = 'Mcnelis') OR
    ("firstName" = 'Matthew' AND "lastName" = 'Ansert') OR
    ("firstName" = 'Cody' AND "lastName" = 'Wheeler') OR
    ("firstName" = 'Eric' AND "lastName" = 'Johnson') OR
    ("firstName" = 'Ben' AND "lastName" = 'Martin') OR
    ("firstName" = 'Jody' AND "lastName" = 'Speaks') OR
    ("firstName" = 'Tyler' AND "lastName" = 'Langdon')
  );

-- Verify the changes
SELECT 
  "firstName",
  "lastName",
  "winningsEligible"
FROM "Player"
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
ORDER BY "winningsEligible" DESC, "firstName", "lastName";

