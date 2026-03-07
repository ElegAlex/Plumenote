package auth

import "context"

type ctxKey int

const claimsKey ctxKey = iota

// UserFromContext extracts auth claims from the request context.
// Returns nil if no claims are present.
func UserFromContext(ctx context.Context) *Claims {
	c, _ := ctx.Value(claimsKey).(*Claims)
	return c
}

func withClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsKey, c)
}
