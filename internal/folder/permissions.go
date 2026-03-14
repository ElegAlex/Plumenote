package folder

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MaxFolderDepth is the maximum allowed nesting depth (0 = root).
const MaxFolderDepth = 10

// FolderRole represents the permission level a user has on a folder.
type FolderRole string

const (
	RoleReader  FolderRole = "reader"
	RoleEditor  FolderRole = "editor"
	RoleManager FolderRole = "manager"
)

var roleOrder = map[FolderRole]int{
	RoleReader:  1,
	RoleEditor:  2,
	RoleManager: 3,
}

// RoleAtLeast reports whether role meets or exceeds the minimum level.
func RoleAtLeast(role, minimum FolderRole) bool {
	return roleOrder[role] >= roleOrder[minimum]
}

// dbQuerier is a minimal interface satisfied by both *pgxpool.Pool and pgx.Tx.
type dbQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ResolveUserRole walks from folderID up to the root via a recursive CTE and
// returns the first explicit folder_permissions entry found. Admins always
// receive RoleManager. Returns ("", nil) when no permission is found.
func ResolveUserRole(ctx context.Context, db *pgxpool.Pool, folderID, userID, userRole string) (FolderRole, error) {
	return resolveRole(ctx, db, folderID, userID, userRole)
}

// ResolveUserRoleTx is the same as ResolveUserRole but operates inside a transaction.
func ResolveUserRoleTx(ctx context.Context, tx pgx.Tx, folderID, userID, userRole string) (FolderRole, error) {
	return resolveRole(ctx, tx, folderID, userID, userRole)
}

func resolveRole(ctx context.Context, q dbQuerier, folderID, userID, userRole string) (FolderRole, error) {
	if userRole == "admin" {
		return RoleManager, nil
	}
	if userID == "" {
		return "", nil
	}

	// Walk the ancestor chain with a recursive CTE, find the first explicit
	// permission for this user on any folder in the chain (nearest first).
	const query = `
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 0 AS depth
    FROM folders
    WHERE id = $1
  UNION ALL
    SELECT f.id, f.parent_id, a.depth + 1
    FROM folders f
    JOIN ancestors a ON f.id = a.parent_id
)
SELECT fp.role
FROM ancestors a
JOIN folder_permissions fp ON fp.folder_id = a.id AND fp.user_id = $2
ORDER BY a.depth ASC
LIMIT 1
`
	var role string
	err := q.QueryRow(ctx, query, folderID, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return FolderRole(role), nil
}

// BatchResolveRoles returns a map of folderID -> FolderRole for all folders
// in domainID where userID has an explicit permission entry. The caller is
// responsible for inferring inherited roles for folders not in the map.
func BatchResolveRoles(ctx context.Context, db *pgxpool.Pool, domainID, userID string) (map[string]FolderRole, error) {
	const query = `
SELECT fp.folder_id::text, fp.role::text
FROM folder_permissions fp
JOIN folders f ON f.id = fp.folder_id
WHERE f.domain_id = $1 AND fp.user_id = $2
`
	rows, err := db.Query(ctx, query, domainID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]FolderRole)
	for rows.Next() {
		var fid, role string
		if err := rows.Scan(&fid, &role); err != nil {
			return nil, err
		}
		result[fid] = FolderRole(role)
	}
	return result, rows.Err()
}

// FolderDepth returns the depth of folderID in the tree (0 for a root folder).
func FolderDepth(ctx context.Context, db *pgxpool.Pool, folderID string) (int, error) {
	const query = `
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, 0 AS depth
    FROM folders
    WHERE id = $1
  UNION ALL
    SELECT f.id, f.parent_id, a.depth + 1
    FROM folders f
    JOIN ancestors a ON f.id = a.parent_id
)
SELECT MAX(depth) FROM ancestors
`
	var depth int
	err := db.QueryRow(ctx, query, folderID).Scan(&depth)
	return depth, err
}

// MaxDescendantDepth returns the maximum depth among all descendants of
// folderID (inclusive). Returns 0 when there are no descendants.
func MaxDescendantDepth(ctx context.Context, db *pgxpool.Pool, folderID string) (int, error) {
	const query = `
WITH RECURSIVE descendants AS (
    SELECT id, parent_id, 0 AS depth
    FROM folders
    WHERE id = $1
  UNION ALL
    SELECT f.id, f.parent_id, d.depth + 1
    FROM folders f
    JOIN descendants d ON f.parent_id = d.id
)
SELECT COALESCE(MAX(depth), 0) FROM descendants
`
	var depth int
	err := db.QueryRow(ctx, query, folderID).Scan(&depth)
	return depth, err
}

// IsDescendant reports whether folderID is a descendant of candidateAncestorID
// (or equal to it), used to detect move cycles.
func IsDescendant(ctx context.Context, db *pgxpool.Pool, folderID, candidateAncestorID string) (bool, error) {
	if folderID == candidateAncestorID {
		return true, nil
	}
	const query = `
WITH RECURSIVE ancestors AS (
    SELECT id, parent_id
    FROM folders
    WHERE id = $1
  UNION ALL
    SELECT f.id, f.parent_id
    FROM folders f
    JOIN ancestors a ON f.id = a.parent_id
)
SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = $2)
`
	var exists bool
	err := db.QueryRow(ctx, query, folderID, candidateAncestorID).Scan(&exists)
	return exists, err
}
