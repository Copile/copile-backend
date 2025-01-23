package submission

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	bundle "github.com/jito-labs/jito-protos/gen/bundle/v1"
	searcher "github.com/jito-labs/jito-protos/gen/searcher/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Config struct {
	JitoEndpoint string
	BundleSize   int
	MaxRetries   int
	TipBuffer    uint64
}

type Submitter struct {
	config        *Config
	jitoClient    searcher.SearcherServiceClient
	bundleClient  bundle.BundleServiceClient
	solanaClient  *rpc.Client
	bundleQueue   chan *bundle.Bundle
	metrics       *Metrics
	retryBackoff  time.Duration
}

type BlockPosition int

const (
	BlockPosition_SAME_BLOCK BlockPosition = iota
	BlockPosition_BEFORE_TARGET
	BlockPosition_AFTER_TARGET
)

type TargetBlock struct {
	Slot     uint64
	Position BlockPosition
}

type Options struct {
	Target  *TargetBlock
	MaxTip  uint64
}

type Request struct {
	Transaction *solana.Transaction
	Options     *Options
}

type Result struct {
	Signature string
	Slot      uint64
	Error     error
}

type Metrics struct {
	submissionLatency *prometheus.Histogram
	bundleSize       *prometheus.Gauge
	retryCount       *prometheus.Counter
}

func NewSubmitter(config *Config) (*Submitter, error) {
	conn, err := grpc.Dial(config.JitoEndpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to JITO: %v", err)
	}

	submitter := &Submitter{
		config:       config,
		jitoClient:   searcher.NewSearcherServiceClient(conn),
		bundleClient: bundle.NewBundleServiceClient(conn),
		bundleQueue:  make(chan *bundle.Bundle, config.BundleSize),
		metrics:      newMetrics(),
		retryBackoff: 100 * time.Microsecond,
	}

	// Start bundle processor
	go submitter.processBundles()

	return submitter, nil
}

func (s *Submitter) SubmitWithProtection(ctx context.Context, req *Request) (*Result, error) {
	start := time.Now()
	defer s.metrics.submissionLatency.Observe(float64(time.Since(start).Microseconds()))

	// Create bundle with the transaction
	bundle := &bundle.Bundle{
		Transactions: [][]byte{req.Transaction.Marshal()},
		Header: &bundle.BundleHeader{
			MaxTip: req.Options.MaxTip,
		},
	}

	// Set target block if specified
	if req.Options.Target != nil {
		bundle.Header.TargetSlot = req.Options.Target.Slot
		switch req.Options.Target.Position {
		case BlockPosition_SAME_BLOCK:
			bundle.Header.BlockDeadline = 0
		case BlockPosition_BEFORE_TARGET:
			bundle.Header.BlockDeadline = -1
		case BlockPosition_AFTER_TARGET:
			bundle.Header.BlockDeadline = 1
		}
	}

	// Submit bundle to JITO
	resp, err := s.bundleClient.SubmitBundle(ctx, &bundle.SubmitBundleRequest{
		Bundle: bundle,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to submit bundle: %v", err)
	}

	// Monitor bundle status
	status, err := s.monitorBundleStatus(ctx, resp.Uuid)
	if err != nil {
		return nil, fmt.Errorf("failed to monitor bundle: %v", err)
	}

	return &Result{
		Signature: solana.SignatureFromBytes(status.Signature).String(),
		Slot:     status.Slot,
	}, nil
}

func (s *Submitter) monitorBundleStatus(ctx context.Context, bundleID string) (*bundle.BundleResult, error) {
	stream, err := s.bundleClient.SubscribeBundleResults(ctx, &bundle.SubscribeBundleResultsRequest{
		BundleUuid: bundleID,
	})
	if err != nil {
		return nil, err
	}

	for {
		result, err := stream.Recv()
		if err != nil {
			return nil, err
		}

		switch result.Status {
		case bundle.BundleResult_CONFIRMED:
			return result, nil
		case bundle.BundleResult_FAILED:
			return nil, fmt.Errorf("bundle failed: %s", result.ErrorMessage)
		}
	}
}

func (s *Submitter) processBundles() {
	var currentBundle *bundle.Bundle
	bundleSize := 0

	for tx := range s.bundleQueue {
		if currentBundle == nil {
			currentBundle = tx
			bundleSize = 1
		} else {
			currentBundle.Transactions = append(currentBundle.Transactions, tx.Transactions...)
			bundleSize++
		}

		s.metrics.bundleSize.Set(float64(bundleSize))

		if bundleSize >= s.config.BundleSize {
			if err := s.submitBundle(currentBundle); err != nil {
				log.Printf("Failed to submit bundle: %v", err)
			}
			currentBundle = nil
			bundleSize = 0
		}
	}
}

func (s *Submitter) submitBundle(bundle *bundle.Bundle) error {
	ctx := context.Background()
	
	for i := 0; i < s.config.MaxRetries; i++ {
		_, err := s.bundleClient.SubmitBundle(ctx, &bundle.SubmitBundleRequest{
			Bundle: bundle,
		})
		if err == nil {
			return nil
		}

		s.metrics.retryCount.Inc()
		time.Sleep(s.retryBackoff)
		s.retryBackoff *= 2 // Exponential backoff
	}

	return fmt.Errorf("max retries exceeded")
}

func newMetrics() *Metrics {
	return &Metrics{
		submissionLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name: "tx_submission_latency_microseconds",
			Help: "Transaction submission latency in microseconds",
			Buckets: []float64{100, 200, 500, 1000, 2000, 5000},
		}),
		bundleSize: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "bundle_size",
			Help: "Current size of the transaction bundle",
		}),
		retryCount: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "submission_retries_total",
			Help: "Total number of submission retries",
		}),
	}
} 