-- Update Week 4 course name for Louisville league to "Dale Hallow"
UPDATE "Course"
SET "name" = 'Dale Hallow'
WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
  AND "week" = 4;

-- If the course doesn't exist, create it
INSERT INTO "Course" ("name", "week", "leagueId", "createdAt", "updatedAt")
SELECT 'Dale Hallow', 4, id, NOW(), NOW()
FROM "League"
WHERE name = 'Louisville'
  AND NOT EXISTS (
    SELECT 1 FROM "Course" 
    WHERE "leagueId" = (SELECT id FROM "League" WHERE name = 'Louisville')
      AND "week" = 4
  );

-- Verify the change
SELECT 
  c."name" as course_name,
  c."week" as week_number,
  l."name" as league_name
FROM "Course" c
JOIN "League" l ON c."leagueId" = l.id
WHERE l."name" = 'Louisville'
  AND c."week" = 4;

