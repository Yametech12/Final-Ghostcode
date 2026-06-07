-- Add reaction column to advisor_messages for thumbs up/down feedback
-- This lets users mark helpful/unhelpful responses, and the data persists
-- across sessions (unlike the current local-state-only implementation).

ALTER TABLE advisor_messages
ADD COLUMN IF NOT EXISTS reaction TEXT CHECK (reaction IN ('like', 'dislike'));

-- Index for analytics queries (e.g., "what % of responses get thumbs up?")
CREATE INDEX IF NOT EXISTS idx_advisor_messages_reaction
ON advisor_messages(reaction) WHERE reaction IS NOT NULL;

-- RLS: users can only update reactions on their own messages
ALTER TABLE advisor_messages ENABLE ROW LEVEL SECURITY;

-- Policy already exists for read (via session ownership check), but we need
-- an explicit update policy for the reaction column. Users can only update
-- messages in sessions they own.
CREATE POLICY advisor_messages_update_reaction ON advisor_messages
FOR UPDATE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM advisor_sessions
    WHERE advisor_sessions.id = advisor_messages.session_id
    AND advisor_sessions.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM advisor_sessions
    WHERE advisor_sessions.id = advisor_messages.session_id
    AND advisor_sessions.user_id = auth.uid()
  )
);
