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
RUN apk add --no-cache ca-certificates tzdata poppler-utils curl python3 py3-pip
# Install official Pandoc binary (full feature set for docx)
RUN curl -L https://github.com/jgm/pandoc/releases/download/3.6.4/pandoc-3.6.4-linux-amd64.tar.gz | tar xz -C /tmp \
    && mv /tmp/pandoc-3.6.4/bin/pandoc /usr/local/bin/pandoc \
    && rm -rf /tmp/pandoc-3.6.4
# Install python-pptx for PPTX conversion
RUN pip3 install --no-cache-dir --break-system-packages python-pptx
COPY scripts/pptx2html.py /usr/local/bin/pptx2html.py
RUN chmod +x /usr/local/bin/pptx2html.py
COPY --from=backend /plumenote /usr/local/bin/plumenote
EXPOSE 8080
ENTRYPOINT ["plumenote"]
