package monitoring

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	
	block "github.com/jito-labs/jito-protos/gen/block/v1"
)

type Config struct {
	JitoEndpoint    string
	YellowstoneURL  string
	BlockBatchSize  int
	StreamBufferLen int
}

type BlockStreamer struct {
	config      *Config
	jitoClient  block.BlockStreamClient
	wsConn      *websocket.Conn
	subscribers sync.Map
	metrics     *Metrics
}

type Filter struct {
	Programs []solana.PublicKey
	Accounts []solana.PublicKey
}

type Subscription struct {
	ID     string
	Filter Filter
	stream chan *Transaction
}

type Transaction struct {
	Signature        string
	Slot            uint64
	BlockTime       time.Time
	Instructions    []solana.CompiledInstruction
	DetectionLatency time.Duration
}

type Metrics struct {
	detectionLatency   *prometheus.Histogram
	throughput         *prometheus.Counter
	activeSubscribers  *prometheus.Gauge
}

func NewBlockStreamer(ctx context.Context, config *Config) (*BlockStreamer, error) {
	// Connect to JITO gRPC
	conn, err := grpc.Dial(config.JitoEndpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JITO: %v", err)
	}

	// Connect to Yellowstone WebSocket
	wsConn, _, err := websocket.DefaultDialer.Dial(config.YellowstoneURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Yellowstone: %v", err)
	}

	streamer := &BlockStreamer{
		config:     config,
		jitoClient: block.NewBlockStreamClient(conn),
		wsConn:     wsConn,
		metrics:    newMetrics(),
	}

	// Start processing blocks from both sources
	go streamer.processJitoBlocks(ctx)
	go streamer.processYellowstoneUpdates(ctx)

	return streamer, nil
}

func (s *BlockStreamer) SubscribeTransactions(filter Filter) *Subscription {
	sub := &Subscription{
		ID:     generateSubscriptionID(),
		Filter: filter,
		stream: make(chan *Transaction, s.config.StreamBufferLen),
	}
	s.subscribers.Store(sub.ID, sub)
	s.metrics.activeSubscribers.Inc()
	return sub
}

func (s *BlockStreamer) processJitoBlocks(ctx context.Context) {
	stream, err := s.jitoClient.SubscribeBlockUpdates(ctx, &block.SubscribeBlockUpdatesRequest{
		Commitment: "processed",
	})
	if err != nil {
		log.Printf("Failed to subscribe to JITO blocks: %v", err)
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			update, err := stream.Recv()
			if err != nil {
				log.Printf("Error receiving block update: %v", err)
				continue
			}

			start := time.Now()
			s.processBlock(update.Block)
			s.metrics.throughput.Inc()
			s.metrics.detectionLatency.Observe(float64(time.Since(start).Microseconds()))
		}
	}
}

func (s *BlockStreamer) processYellowstoneUpdates(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			_, message, err := s.wsConn.ReadMessage()
			if err != nil {
				log.Printf("Error reading Yellowstone message: %v", err)
				continue
			}

			start := time.Now()
			s.processYellowstoneMessage(message)
			s.metrics.throughput.Inc()
			s.metrics.detectionLatency.Observe(float64(time.Since(start).Microseconds()))
		}
	}
}

func (s *BlockStreamer) processBlock(block *block.Block) {
	s.subscribers.Range(func(key, value interface{}) bool {
		sub := value.(*Subscription)
		
		// Process each transaction in the block
		for _, tx := range block.Transactions {
			if s.matchesFilter(tx, sub.Filter) {
				transaction := &Transaction{
					Signature:        tx.Transaction.Signatures[0],
					Slot:            block.ParentSlot + 1,
					BlockTime:       time.Unix(int64(block.BlockTime), 0),
					Instructions:    tx.Transaction.Message.Instructions,
					DetectionLatency: time.Since(time.Unix(int64(block.BlockTime), 0)),
				}

				select {
				case sub.stream <- transaction:
				default:
					log.Printf("Warning: Subscriber %s stream buffer full", sub.ID)
				}
			}
		}
		return true
	})
}

func (s *BlockStreamer) matchesFilter(tx *block.Transaction, filter Filter) bool {
	if len(filter.Programs) == 0 && len(filter.Accounts) == 0 {
		return true
	}

	// Check program IDs
	for _, inst := range tx.Transaction.Message.Instructions {
		programID := solana.PublicKeyFromBytes(inst.ProgramIdIndex)
		for _, targetProgram := range filter.Programs {
			if programID.Equals(targetProgram) {
				return true
			}
		}
	}

	// Check account keys
	for _, acc := range tx.Transaction.Message.AccountKeys {
		account := solana.PublicKeyFromBytes(acc)
		for _, targetAccount := range filter.Accounts {
			if account.Equals(targetAccount) {
				return true
			}
		}
	}

	return false
}

func newMetrics() *Metrics {
	return &Metrics{
		detectionLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name: "tx_detection_latency_microseconds",
			Help: "Transaction detection latency in microseconds",
			Buckets: []float64{50, 100, 200, 500, 1000, 2000},
		}),
		throughput: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "tx_processing_total",
			Help: "Total number of transactions processed",
		}),
		activeSubscribers: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "active_subscribers",
			Help: "Number of active transaction subscribers",
		}),
	}
}

func generateSubscriptionID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
} 