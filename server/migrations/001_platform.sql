CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL,
 password_hash text, demo boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workspaces (
 id uuid PRIMARY KEY, name text NOT NULL, demo boolean NOT NULL DEFAULT false,
 expires_at timestamptz, revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','supervisor','manager','reviewer','viewer')),
 active boolean NOT NULL DEFAULT true, PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf text NOT NULL, demo_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['products','customers','rules','strategies','briefs','communications','visits','tasks','reviews','notifications','audit'] LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I (workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, id text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,id))',name);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',name);
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename=name AND policyname='workspace_scope') THEN
   EXECUTE format('CREATE POLICY workspace_scope ON %I USING (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid) WITH CHECK (workspace_id = nullif(current_setting(''app.workspace_id'',true),'''')::uuid)',name);
  END IF;
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS customer_owner ON customers(workspace_id,(payload->>'ownerId'));
CREATE INDEX IF NOT EXISTS task_customer ON tasks(workspace_id,(payload->>'customerId'));
CREATE INDEX IF NOT EXISTS review_status ON reviews(workspace_id,(payload->>'status'));
CREATE INDEX IF NOT EXISTS audit_created ON audit(workspace_id,created_at DESC);
-- The runtime role receives no DDL, ownership, BYPASSRLS or superuser privileges.
GRANT CONNECT ON DATABASE yince TO yince_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO yince_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON users,workspaces,memberships,sessions,app_settings TO yince_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON products,customers,rules,strategies,briefs,communications,visits,tasks,reviews,notifications TO yince_app;
GRANT SELECT,INSERT ON audit TO yince_app;
