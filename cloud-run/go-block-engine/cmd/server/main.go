package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"cloud.google.com/go/firestore"
	"go.uber.org/zap"

	"github.com/copile/go-block-engine/config"
	"github.com/copile/go-block-engine/internal/engine"
	"github.com/copile/go-block-engine/internal/server"
)

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Sync()

	// Initialize Firestore client
	ctx := context.Background()
	firestoreClient, err := firestore.NewClient(ctx, cfg.ProjectID)
	if err != nil {
		logger.Fatal("Failed to create Firestore client", zap.Error(err))
	}
	defer firestoreClient.Close()

	// Initialize block predictor
	predictor, err := engine.NewBlockPredictor(cfg.SolanaRPC, cfg.JitoRPC, logger)
	if err != nil {
		logger.Fatal("Failed to create block predictor", zap.Error(err))
	}

	// Start block prediction
	if err := predictor.Start(ctx); err != nil {
		logger.Fatal("Failed to start block predictor", zap.Error(err))
	}

	// Initialize and start HTTP server
	srv := server.NewServer(predictor, logger, firestoreClient)
	go func() {
		if err := srv.Start(cfg.Port); err != nil {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	logger.Info("Server started",
		zap.Int("port", cfg.Port),
		zap.String("solana_rpc", cfg.SolanaRPC),
		zap.String("jito_rpc", cfg.JitoRPC),
	)

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutting down server...")
}
