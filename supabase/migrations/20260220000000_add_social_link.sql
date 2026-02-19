-- Add social_link column for top 5 players to display a social network URL
ALTER TABLE players ADD COLUMN social_link TEXT DEFAULT NULL;

-- Constrain length to prevent abuse
ALTER TABLE players ADD CONSTRAINT social_link_max_length
  CHECK (social_link IS NULL OR char_length(social_link) <= 512);
