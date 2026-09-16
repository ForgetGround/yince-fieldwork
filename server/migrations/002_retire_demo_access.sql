-- Reversible access retirement: preserve historical mock records for rollback.
BEGIN;
UPDATE sessions SET expires_at=LEAST(expires_at,now())
 WHERE demo_workspace_id IS NOT NULL OR user_id IN (SELECT id FROM users WHERE demo);
UPDATE memberships SET active=false
 WHERE user_id IN (SELECT id FROM users WHERE demo)
    OR workspace_id IN (SELECT id FROM workspaces WHERE demo);
UPDATE users SET active=false WHERE demo;
UPDATE workspaces SET expires_at=LEAST(COALESCE(expires_at,now()),now()) WHERE demo;
COMMIT;
