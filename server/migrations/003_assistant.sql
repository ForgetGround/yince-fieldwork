BEGIN;
CREATE TABLE IF NOT EXISTS assistant_conversations (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 id uuid NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 messages jsonb NOT NULL DEFAULT '[]', pending_until timestamptz, scope_key text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id)
);
ALTER TABLE assistant_conversations ADD COLUMN IF NOT EXISTS scope_key text NOT NULL DEFAULT '';
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='assistant_conversations' AND policyname='workspace_scope') THEN
 CREATE POLICY workspace_scope ON assistant_conversations USING(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid) WITH CHECK(workspace_id=nullif(current_setting('app.workspace_id',true),'')::uuid);
END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON assistant_conversations TO yince_app;
COMMIT;
