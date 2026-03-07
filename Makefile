.PHONY: dev build test sqlc migrate deploy clean

dev:
	@echo "Starting dev environment..."
	cd docker && docker compose up -d plumenote-db plumenote-search
	cd web && npm run dev &
	go run ./cmd/plumenote

build:
	cd web && npm ci && npm run build
	rm -rf cmd/plumenote/static && cp -r web/dist cmd/plumenote/static
	CGO_ENABLED=0 go build -o bin/plumenote ./cmd/plumenote

test:
	go test ./...

sqlc:
	sqlc generate

migrate:
	@echo "Migrations are applied automatically by PostgreSQL via docker-entrypoint-initdb.d"

deploy:
	cd docker && docker compose up -d --build

clean:
	rm -rf bin/ cmd/plumenote/static web/dist web/node_modules
