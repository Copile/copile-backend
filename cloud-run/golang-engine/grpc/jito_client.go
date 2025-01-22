package grpc

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	
	block "github.com/jito-labs/jito-protos/gen/block/v1"
	auth "github.com/jito-labs/jito-protos/gen/auth/v1"
)

type Transaction struct {
	Signature    string
	FromAddress  string
	ToAddress    string
	Amount       uint64
	TokenMint    string
	BlockHeight  uint64
	Timestamp    time.Time
}

type JitoClient struct {
	conn         *grpc.ClientConn
	blockClient  block.BlockStreamClient
	authClient   auth.AuthClient
	token        string
}

func NewJitoClient(endpoint, apiKey string) (*JitoClient, error) {
	conn, err := grpc.Dial(endpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JITO: %v", err)
	}

	client := &JitoClient{
		conn:        conn,
		blockClient: block.NewBlockStreamClient(conn),
		authClient:  auth.NewAuthClient(conn),
	}

	// Authenticate with JITO
	token, err := client.authenticate(apiKey)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to authenticate: %v", err)
	}
	client.token = token

	return client, nil
}

func (c *JitoClient) authenticate(apiKey string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := c.authClient.GetToken(ctx, &auth.GetTokenRequest{
		ApiKey: apiKey,
	})
	if err != nil {
		return "", err
	}

	return resp.Token, nil
}

func (c *JitoClient) Close() {
	if c.conn != nil {
		c.conn.Close()
	}
}

func (c *JitoClient) SubscribeToTransactions(ctx context.Context) (<-chan *Transaction, error) {
	transactions := make(chan *Transaction, 1000)

	stream, err := c.blockClient.SubscribeBlockUpdates(ctx, &block.SubscribeBlockUpdatesRequest{
		Commitment: "processed",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to subscribe to blocks: %v", err)
	}

	go func() {
		defer close(transactions)
		for {
			update, err := stream.Recv()
			if err != nil {
				log.Printf("Error receiving block update: %v", err)
				return
			}

			// Process each transaction in the block
			for _, tx := range update.Block.Transactions {
				// Extract transaction details
				transaction := &Transaction{
					Signature:   tx.Transaction.Signatures[0],
					BlockHeight: update.Block.ParentSlot + 1,
					Timestamp:   time.Now(), // Use block timestamp when available
				}

				// Parse transaction instructions
				for _, inst := range tx.Transaction.Message.Instructions {
					// Here we would parse the instruction data based on the program
					// For this example we'll focus on token transfers
					if inst.ProgramIdIndex == 0 { // Token program
						transaction.TokenMint = string(inst.Data[:32])
						transaction.FromAddress = string(inst.Accounts[0])
						transaction.ToAddress = string(inst.Accounts[1])
						transaction.Amount = uint64(inst.Data[32:40])
					}
				}

				select {
				case transactions <- transaction:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return transactions, nil
}

// ExecuteTrade simulates executing a trade
func (c *JitoClient) ExecuteTrade(transaction string) {
	fmt.Printf("Executing trade for transaction: %s\n", transaction)
}
