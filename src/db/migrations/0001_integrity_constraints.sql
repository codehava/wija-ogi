-- ═══════════════════════════════════════════════════════════════════════════════
-- WIJA - Database Integrity Constraints & Triggers
-- Round 3 Hardening: Enforce data integrity at the database level
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. AUTO-UPDATE `updated_at` TRIGGER
-- Automatically sets updated_at = NOW() on every UPDATE
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_trees
    BEFORE UPDATE ON trees
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_persons
    BEFORE UPDATE ON persons
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_relationships
    BEFORE UPDATE ON relationships
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. CHECK CONSTRAINTS — Enforce valid enum values at DB level
-- ─────────────────────────────────────────────────────────────────────────────────

-- Gender must be a valid value
ALTER TABLE persons
    ADD CONSTRAINT chk_persons_gender
    CHECK (gender IN ('male', 'female', 'other', 'unknown'));

-- Tree member role must be valid
ALTER TABLE tree_members
    ADD CONSTRAINT chk_tree_members_role
    CHECK (role IN ('superadmin', 'owner', 'admin', 'editor', 'viewer'));

-- Invitation status must be valid
ALTER TABLE invitations
    ADD CONSTRAINT chk_invitations_status
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired'));

-- Invitation role must be valid
ALTER TABLE invitations
    ADD CONSTRAINT chk_invitations_role
    CHECK (role IN ('superadmin', 'owner', 'admin', 'editor', 'viewer'));

-- Relationship type must be valid
ALTER TABLE relationships
    ADD CONSTRAINT chk_relationships_type
    CHECK (type IN ('spouse', 'parent-child'));

-- Marriage status must be valid (when present)
ALTER TABLE relationships
    ADD CONSTRAINT chk_relationships_marriage_status
    CHECK (marriage_status IS NULL OR marriage_status IN ('married', 'divorced', 'widowed'));

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. CROSS-TABLE INTEGRITY — Relationships must reference persons in same tree
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_relationship_tree_consistency()
RETURNS TRIGGER AS $$
DECLARE
    p1_tree uuid;
    p2_tree uuid;
BEGIN
    -- Get tree IDs for both persons
    SELECT tree_id INTO p1_tree FROM persons WHERE id = NEW.person1_id;
    SELECT tree_id INTO p2_tree FROM persons WHERE id = NEW.person2_id;

    -- Both persons must exist
    IF p1_tree IS NULL THEN
        RAISE EXCEPTION 'person1_id % does not exist', NEW.person1_id;
    END IF;
    IF p2_tree IS NULL THEN
        RAISE EXCEPTION 'person2_id % does not exist', NEW.person2_id;
    END IF;

    -- Both persons must belong to the same tree as the relationship
    IF p1_tree != NEW.tree_id OR p2_tree != NEW.tree_id THEN
        RAISE EXCEPTION 'Persons must belong to the same tree as the relationship (tree_id=%)', NEW.tree_id;
    END IF;

    -- Cannot relate a person to themselves
    IF NEW.person1_id = NEW.person2_id THEN
        RAISE EXCEPTION 'Cannot create a relationship between a person and themselves';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_relationship_tree
    BEFORE INSERT OR UPDATE ON relationships
    FOR EACH ROW
    EXECUTE FUNCTION check_relationship_tree_consistency();

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. PREVENT DUPLICATE RELATIONSHIPS
-- ─────────────────────────────────────────────────────────────────────────────────

-- A pair of persons should not have duplicate relationships of the same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_relationship
    ON relationships (tree_id, type, LEAST(person1_id, person2_id), GREATEST(person1_id, person2_id));
