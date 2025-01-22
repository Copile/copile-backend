package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"golang-engine/pkg"
	"github.com/gagliardetto/solana-go"
)

func main() {
	// Load configuration from environment
	jitoEndpoint := mustGetenv("JITO_GRPC_ENDPOINT")
	jitoApiKey := mustGetenv("JITO_API_KEY")
	rpcEndpoint := mustGetenv("SOLANA_RPC_ENDPOINT")
	privateKeyBytes := mustGetenv("WALLET_PRIVATE_KEY")

	// Parse private key
	privateKey, err := solana.PrivateKeyFromBase58(privateKeyBytes)
	if err != nil {
		log.Fatalf("Failed to parse private key: %v", err)
	}

	// Create engine
	engine, err := pkg.NewEngine(jitoEndpoint, jitoApiKey, rpcEndpoint, privateKey)
	if err != nil {
		log.Fatalf("Failed to create engine: %v", err)
	}

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\nShutting down gracefully...")
		cancel()
	}()

	// Run engine
	if err := engine.Run(ctx); err != nil {
		log.Fatalf("Engine error: %v", err)
	}
}

func mustGetenv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Environment variable %s is required", key)
	}
	return value
}
