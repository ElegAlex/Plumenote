package feed

import (
	"github.com/alexmusic/plumenote/internal/model"
	"testing"
)

func setupDeps(t *testing.T) *model.Deps {
	t.Helper()
	return &model.Deps{JWTSecret: "test-secret"}
}
