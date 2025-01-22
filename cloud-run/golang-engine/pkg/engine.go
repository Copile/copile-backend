package pkg

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"golang-engine/grpc"
	
	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"github.com/gagliardetto/solana-go/rpc/ws"
	token "github.com/gagliardetto/solana-go/programs/token"
)

type Engine struct {
	jitoClient    *grpc.JitoClient
	solanaClient  *rpc.Client
	wsClient      *ws.Client
	walletKey     solana.PrivateKey
	targetWallets map[string]bool
	tokenCache    sync.Map // Cache for token metadata
}

func NewEngine(jitoEndpoint, jitoApiKey, rpcEndpoint string, privateKey solana.PrivateKey) (*Engine, error) {
	jitoClient, err := grpc.NewJitoClient(jitoEndpoint, jitoApiKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create JITO client: %v", err)
	}

	solanaClient := rpc.New(rpcEndpoint)
	wsClient, err := ws.Connect(context.Background(), rpcEndpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to websocket: %v", err)
	}

	return &Engine{
		jitoClient:    jitoClient,
		solanaClient:  solanaClient,
		wsClient:      wsClient,
		walletKey:     privateKey,
		targetWallets: make(map[string]bool),
	}, nil
}

func (e *Engine) Run(ctx context.Context) error {
	transactions, err := e.jitoClient.SubscribeToTransactions(ctx)
	if err != nil {
		return fmt.Errorf("failed to subscribe to transactions: %v", err)
	}

	for tx := range transactions {
		if e.shouldCopyTrade(tx) {
			if err := e.executeTrade(ctx, tx); err != nil {
				log.Printf("Failed to execute trade: %v", err)
				continue
			}
		}
	}

	return nil
}

func (e *Engine) shouldCopyTrade(tx *grpc.Transaction) bool {
	// Check if it's from a target wallet we're tracking
	if !e.targetWallets[tx.FromAddress] {
		return false
	}

	// Get token metadata from cache or fetch it
	tokenMetadata, err := e.getTokenMetadata(tx.TokenMint)
	if err != nil {
		log.Printf("Failed to get token metadata: %v", err)
		return false
	}

	// Check if token meets our criteria (market cap, volume, etc)
	if !e.isValidToken(tokenMetadata) {
		return false
	}

	return true
}

func (e *Engine) getTokenMetadata(mint string) (*TokenMetadata, error) {
	if cached, ok := e.tokenCache.Load(mint); ok {
		return cached.(*TokenMetadata), nil
	}

	// Fetch token metadata from Jupiter or similar API
	metadata := &TokenMetadata{
		Symbol:    "UNKNOWN",
		Decimals: 9,
	}

	e.tokenCache.Store(mint, metadata)
	return metadata, nil
}

func (e *Engine) executeTrade(ctx context.Context, sourceTx *grpc.Transaction) error {
	// Create a new transaction
	tx := solana.NewTransaction(
		[]solana.Instruction{
			token.NewTransferInstruction(
				sourceTx.Amount,
				solana.NewWalletFromPrivateKey(e.walletKey).PublicKey(),
				solana.MustPublicKeyFromBase58(sourceTx.ToAddress),
				solana.MustPublicKeyFromBase58(sourceTx.TokenMint),
				[]solana.PublicKey{},
			).Build(),
		},
		solana.NewWalletFromPrivateKey(e.walletKey).PublicKey(),
	)

	// Sign the transaction
	_, err := tx.Sign(func(key solana.PublicKey) *solana.PrivateKey {
		if key.Equals(e.walletKey.PublicKey()) {
			return &e.walletKey
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to sign transaction: %v", err)
	}

	// Send via JITO bundle
	sig, err := e.sendViaJitoBundle(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to send via JITO bundle: %v", err)
	}

	log.Printf("Successfully executed trade with signature: %s", sig)
	return nil
}

func (e *Engine) sendViaJitoBundle(ctx context.Context, tx *solana.Transaction) (string, error) {
	// TODO: Implement JITO bundle submission
	// This would use the JITO MEV API to submit the transaction
	// in a bundle for same-block/next-block inclusion
	return "", nil
}

type TokenMetadata struct {
	Symbol    string
	Decimals  uint8
	MarketCap *big.Int
	Volume24h *big.Int
}
