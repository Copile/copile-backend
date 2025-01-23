package monitoring

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
	"gonum.org/v1/gonum/stat"
)

type BlockPredictor struct {
	config           *PredictorConfig
	slotHistory      *SlotHistory
	leaderSchedule   *LeaderSchedule
	networkStats     *NetworkStats
	modelCache       *ModelCache
	metrics          *PredictorMetrics
	mu               sync.RWMutex
}

type PredictorConfig struct {
	HistoryWindow      int
	PredictionHorizon  int
	ConfidenceThreshold float64
	UpdateInterval     time.Duration
	ModelConfig        *ModelConfig
}

type ModelConfig struct {
	Features        []string
	WindowSize      int
	LearningRate    float64
	RegularizationL2 float64
}

type SlotHistory struct {
	slots          []SlotData
	maxSize        int
	currentIndex   int
	mu             sync.RWMutex
}

type SlotData struct {
	Slot           uint64
	Timestamp      time.Time
	Leader         solana.PublicKey
	TxCount        int
	BlockTime      time.Duration
	MEVOpportunities []MEVOpportunity
}

type MEVOpportunity struct {
	Type          MEVType
	ProfitLamports uint64
	Probability    float64
	Requirements   MEVRequirements
}

type MEVType int

const (
	MEVType_Sandwich MEVType = iota
	MEVType_Arbitrage
	MEVType_LiquidationRacing
	MEVType_JustInTime
)

type MEVRequirements struct {
	MinimumBalance uint64
	RequiredTokens []solana.PublicKey
	MaxLatency     time.Duration
}

type LeaderSchedule struct {
	schedule       map[uint64]solana.PublicKey
	epoch         uint64
	updateTime    time.Time
	mu            sync.RWMutex
}

type NetworkStats struct {
	tps            float64
	blockTimes     []time.Duration
	mevFrequency   map[MEVType]float64
	updateTime     time.Time
	mu             sync.RWMutex
}

type ModelCache struct {
	predictions    map[uint64]*SlotPrediction
	features      []float64
	weights       []float64
	ttl           time.Duration
	mu            sync.RWMutex
}

type SlotPrediction struct {
	Slot              uint64
	PredictedTime     time.Time
	MEVProbability    map[MEVType]float64
	Confidence        float64
	Features          []float64
}

func NewBlockPredictor(config *PredictorConfig, client *rpc.Client) (*BlockPredictor, error) {
	if err := validatePredictorConfig(config); err != nil {
		return nil, fmt.Errorf("invalid config: %v", err)
	}

	predictor := &BlockPredictor{
		config: config,
		slotHistory: &SlotHistory{
			slots:   make([]SlotData, config.HistoryWindow),
			maxSize: config.HistoryWindow,
		},
		leaderSchedule: &LeaderSchedule{
			schedule: make(map[uint64]solana.PublicKey),
		},
		networkStats: &NetworkStats{
			mevFrequency: make(map[MEVType]float64),
		},
		modelCache: &ModelCache{
			predictions: make(map[uint64]*SlotPrediction),
			ttl:        5 * time.Second,
		},
		metrics: newPredictorMetrics(),
	}

	// Initialize model weights
	predictor.modelCache.weights = initializeModelWeights(config.ModelConfig)

	// Start background processes
	go predictor.startUpdateLoop(context.Background())

	return predictor, nil
}

func (p *BlockPredictor) PredictNextBlocks(ctx context.Context, horizon int) ([]*SlotPrediction, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	currentSlot := p.slotHistory.getCurrentSlot()
	predictions := make([]*SlotPrediction, horizon)

	for i := 0; i < horizon; i++ {
		targetSlot := currentSlot + uint64(i+1)
		
		// Check cache first
		if prediction, ok := p.modelCache.getPrediction(targetSlot); ok {
			predictions[i] = prediction
			continue
		}

		// Generate new prediction
		prediction, err := p.generatePrediction(ctx, targetSlot)
		if err != nil {
			return nil, fmt.Errorf("failed to predict slot %d: %v", targetSlot, err)
		}

		predictions[i] = prediction
		p.modelCache.storePrediction(targetSlot, prediction)
	}

	return predictions, nil
}

func (p *BlockPredictor) generatePrediction(ctx context.Context, slot uint64) (*SlotPrediction, error) {
	// Extract features
	features := p.extractFeatures(slot)

	// Apply model
	mevProbabilities := make(map[MEVType]float64)
	for mevType := range p.networkStats.mevFrequency {
		prob := p.predictMEVProbability(features, mevType)
		if prob >= p.config.ConfidenceThreshold {
			mevProbabilities[mevType] = prob
		}
	}

	// Calculate predicted time
	predictedTime := p.predictBlockTime(slot, features)

	// Calculate overall confidence
	confidence := p.calculateConfidence(features, mevProbabilities)

	return &SlotPrediction{
		Slot:           slot,
		PredictedTime:  predictedTime,
		MEVProbability: mevProbabilities,
		Confidence:     confidence,
		Features:       features,
	}, nil
}

func (p *BlockPredictor) extractFeatures(slot uint64) []float64 {
	p.mu.RLock()
	defer p.mu.RUnlock()

	features := make([]float64, len(p.config.ModelConfig.Features))

	// Historical features
	recentSlots := p.slotHistory.getRecentSlots(10)
	
	// Calculate statistical features
	var blockTimes []float64
	var txCounts []float64
	for _, slotData := range recentSlots {
		blockTimes = append(blockTimes, float64(slotData.BlockTime.Microseconds()))
		txCounts = append(txCounts, float64(slotData.TxCount))
	}

	// Basic statistics
	features[0] = stat.Mean(blockTimes, nil)
	features[1] = stat.Variance(blockTimes, nil)
	features[2] = stat.Mean(txCounts, nil)
	features[3] = calculateTrend(blockTimes)

	// Network load features
	features[4] = p.networkStats.tps
	features[5] = float64(len(p.slotHistory.getMEVOpportunities(5)))

	// Leader-specific features
	if leader, ok := p.leaderSchedule.getLeader(slot); ok {
		leaderStats := p.calculateLeaderStats(leader)
		features[6] = leaderStats.avgBlockTime
		features[7] = leaderStats.mevFrequency
	}

	return features
}

func (p *BlockPredictor) predictMEVProbability(features []float64, mevType MEVType) float64 {
	// Apply logistic regression
	z := 0.0
	for i, feature := range features {
		z += feature * p.modelCache.weights[i]
	}
	
	// Sigmoid activation
	return 1.0 / (1.0 + math.Exp(-z))
}

func (p *BlockPredictor) predictBlockTime(slot uint64, features []float64) time.Time {
	// Use recent block time average and adjust based on features
	avgBlockTime := time.Duration(features[0]) * time.Microsecond
	adjustment := time.Duration(features[1] * features[4] / 100) * time.Microsecond
	
	baseTime := time.Now()
	if lastSlot := p.slotHistory.getLastSlot(); lastSlot != nil {
		baseTime = lastSlot.Timestamp
	}

	return baseTime.Add(avgBlockTime).Add(adjustment)
}

func (p *BlockPredictor) calculateConfidence(features []float64, mevProbs map[MEVType]float64) float64 {
	// Base confidence on feature stability and prediction consistency
	featureStability := calculateFeatureStability(features, p.modelCache.getRecentFeatures(10))
	predictionConsistency := calculatePredictionConsistency(mevProbs, p.networkStats.mevFrequency)
	
	return (featureStability + predictionConsistency) / 2.0
}

func (p *BlockPredictor) startUpdateLoop(ctx context.Context) {
	ticker := time.NewTicker(p.config.UpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.updateModels()
		}
	}
}

func (p *BlockPredictor) updateModels() {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Update network statistics
	p.updateNetworkStats()

	// Update model weights using recent history
	p.updateModelWeights()

	// Clean up old predictions
	p.modelCache.cleanup()
}

func calculateFeatureStability(current, historical [][]float64) float64 {
	if len(historical) == 0 {
		return 1.0
	}

	variances := make([]float64, len(current))
	for i := range current {
		values := make([]float64, len(historical))
		for j := range historical {
			values[j] = historical[j][i]
		}
		variances[i] = stat.Variance(values, nil)
	}

	// Normalize and invert variances (lower variance = higher stability)
	stability := 0.0
	for _, v := range variances {
		stability += 1.0 / (1.0 + v)
	}
	return stability / float64(len(variances))
}

func calculatePredictionConsistency(predicted map[MEVType]float64, historical map[MEVType]float64) float64 {
	if len(historical) == 0 {
		return 1.0
	}

	totalDiff := 0.0
	count := 0
	for mevType, predProb := range predicted {
		if histProb, ok := historical[mevType]; ok {
			totalDiff += math.Abs(predProb - histProb)
			count++
		}
	}

	if count == 0 {
		return 1.0
	}

	// Convert average difference to consistency score (1 = perfect consistency)
	avgDiff := totalDiff / float64(count)
	return 1.0 - math.Min(avgDiff, 1.0)
}

func calculateTrend(values []float64) float64 {
	if len(values) < 2 {
		return 0.0
	}

	x := make([]float64, len(values))
	for i := range x {
		x[i] = float64(i)
	}

	slope, _ := stat.LinearRegression(x, values, nil, false)
	return slope
}

func initializeModelWeights(config *ModelConfig) []float64 {
	weights := make([]float64, len(config.Features))
	// Initialize with small random values
	for i := range weights {
		weights[i] = (rand.Float64() * 2 - 1) * 0.01
	}
	return weights
}

func newPredictorMetrics() *PredictorMetrics {
	return &PredictorMetrics{
		predictionLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "block_predictor_latency_microseconds",
			Help:    "Time taken to generate predictions in microseconds",
			Buckets: []float64{100, 200, 500, 1000, 2000},
		}),
		predictionAccuracy: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "block_predictor_accuracy",
				Help:    "Prediction accuracy by MEV type",
				Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9},
			},
			[]string{"mev_type"},
		),
		modelUpdates: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "block_predictor_model_updates_total",
			Help: "Total number of model updates",
		}),
	}
} 