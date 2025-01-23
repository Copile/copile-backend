# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o /go/bin/server ./cmd/server

# Final stage
FROM alpine:3.19

WORKDIR /app

# Copy binary from builder
COPY --from=builder /go/bin/server .
COPY config/config.yaml ./config/

# Run as non-root user
RUN adduser -D -g '' appuser
USER appuser

# Set environment variables
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run the application
CMD ["./server"] 