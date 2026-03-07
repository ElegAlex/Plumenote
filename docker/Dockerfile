# Stage 1: Build React frontend
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.26-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./cmd/plumenote/static
RUN CGO_ENABLED=0 go build -o /plumenote ./cmd/plumenote

# Stage 3: Final image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
COPY --from=backend /plumenote /usr/local/bin/plumenote
EXPOSE 8080
ENTRYPOINT ["plumenote"]
