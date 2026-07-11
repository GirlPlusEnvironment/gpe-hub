
-- Add type column to posts if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'type') THEN 
        ALTER TABLE posts ADD COLUMN type text DEFAULT 'text'; 
    END IF; 
END $$;

-- Create poll_options table
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create poll_votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  poll_option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(post_id, user_id)
);

-- Add RLS policies
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Poll Options policies
CREATE POLICY "Poll options are viewable by everyone" 
  ON poll_options FOR SELECT 
  USING (true);

CREATE POLICY "Users can create poll options for their posts" 
  ON poll_options FOR INSERT 
  WITH CHECK (auth.uid() IN (SELECT user_id FROM posts WHERE id = post_id));

-- Poll Votes policies
CREATE POLICY "Poll votes are viewable by everyone" 
  ON poll_votes FOR SELECT 
  USING (true);

CREATE POLICY "Users can vote once per poll" 
  ON poll_votes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their vote" 
  ON poll_votes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote" 
  ON poll_votes FOR DELETE 
  USING (auth.uid() = user_id);
