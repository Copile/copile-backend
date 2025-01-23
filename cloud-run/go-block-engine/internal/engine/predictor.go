package engine

import (
	"context"
	"sync"
	"time"

	"github.com/gagliardetto/jito-go/pkg/jito"
	"github.com/gagliardetto/solana-go/rpc"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type BlockPredictor struct {
	solanaClient *rpc.Client
	jitoClient   *jito.Client
	logger       *zap.Logger
	mu           sync.RWMutex

	// Block prediction state
	currentSlot     uint64
	predictedBlocks map[uint64]*PredictedBlock
	recentHistory   []*BlockHistory
}

type PredictedBlock struct {
	Slot           uint64
	Leader         string
	Probability    float64
	PredictedTime  time.Time
	JitoValidated  bool
	NextBlockScore float64
}

type BlockHistory struct {
	Slot          uint64
	ActualLeader  string
	PredictedTime time.Time
	ActualTime    time.Time
	WasAccurate   bool
}

func NewBlockPredictor(solanaRPC, jitoRPC string, logger *zap.Logger) (*BlockPredictor, error) {
	solClient := rpc.New(solanaRPC)
	jitoClient, err := jito.NewClient(context.Background(), jitoRPC, grpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	return &BlockPredictor{
		solanaClient:    solClient,
		jitoClient:      jitoClient,
		logger:          logger,
		predictedBlocks: make(map[uint64]*PredictedBlock),
		recentHistory:   make([]*BlockHistory, 0, 1000),
	}, nil
}

func (bp *BlockPredictor) Start(ctx context.Context) error {
	// Initialize current slot
	slot, err := bp.solanaClient.GetSlot(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return err
	}
	bp.currentSlot = uint64(slot)

	// Start prediction loops
	go bp.runPredictionLoop(ctx)
	go bp.runValidationLoop(ctx)

	return nil
}

func (bp *BlockPredictor) runPredictionLoop(ctx context.Context) {
	ticker := time.NewTicker(400 * time.Millisecond) // Solana block time
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := bp.predictNextBlocks(ctx); err != nil {
				bp.logger.Error("Failed to predict blocks", zap.Error(err))
			}
		}
	}
}

func (bp *BlockPredictor) runValidationLoop(ctx context.Context) {
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := bp.validatePredictions(ctx); err != nil {
				bp.logger.Error("Failed to validate predictions", zap.Error(err))
			}
		}
	}
}

func (bp *BlockPredictor) predictNextBlocks(ctx context.Context) error {
	// Get current slot and leaders schedule
	slot, err := bp.solanaClient.GetSlot(ctx, rpc.CommitmentFinalized)
	if err != nil {
		return err
	}

	leaders, err := bp.solanaClient.GetLeaderSchedule(ctx, nil, rpc.CommitmentFinalized)
	if err != nil {
		return err
	}

	bp.mu.Lock()
	defer bp.mu.Unlock()

	bp.currentSlot = uint64(slot)

	// Predict next 5 blocks
	for i := uint64(0); i < 5; i++ {
		predictedSlot := bp.currentSlot + i + 1
		leader, exists := leaders[predictedSlot]
		if !exists {
			continue
		}

		// Create prediction
		prediction := &PredictedBlock{
			Slot:          predictedSlot,
			Leader:        leader,
			PredictedTime: time.Now().Add(time.Duration(i+1) * 400 * time.Millisecond),
			Probability:   calculateProbability(leader, i),
		}

		// Validate with Jito
		if jitoBlock, err := bp.jitoClient.GetBlock(ctx, predictedSlot); err == nil {
			prediction.JitoValidated = true
			// Update probability based on Jito data
			prediction.Probability *= 1.2 // Increase confidence if Jito validates
		}

		bp.predictedBlocks[predictedSlot] = prediction
	}

	// Clean up old predictions
	for slot := range bp.predictedBlocks {
		if slot < bp.currentSlot {
			delete(bp.predictedBlocks, slot)
		}
	}

	return nil
}

func (bp *BlockPredictor) validatePredictions(ctx context.Context) error {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	for slot, prediction := range bp.predictedBlocks {
		if slot > bp.currentSlot {
			continue
		}

		// Get actual block info
		block, err := bp.solanaClient.GetBlock(ctx, uint64(slot))
		if err != nil {
			continue
		}

		// Record history
		history := &BlockHistory{
			Slot:          slot,
			ActualLeader:  block.Rewards[0].Pubkey, // Assuming first reward is to leader
			PredictedTime: prediction.PredictedTime,
			ActualTime:    time.Now(),
			WasAccurate:   block.Rewards[0].Pubkey == prediction.Leader,
		}

		bp.recentHistory = append(bp.recentHistory, history)
		if len(bp.recentHistory) > 1000 {
			bp.recentHistory = bp.recentHistory[1:]
		}

		delete(bp.predictedBlocks, slot)
	}

	return nil
}

func calculateProbability(leader string, distance uint64) float64 {
	// Base probability decreases with prediction distance
	baseProbability := 1.0 - (float64(distance) * 0.1)
	if baseProbability < 0.5 {
		baseProbability = 0.5
	}
	return baseProbability
}

func (bp *BlockPredictor) GetPredictions() []*PredictedBlock {
	bp.mu.RLock()
	defer bp.mu.RUnlock()

	predictions := make([]*PredictedBlock, 0, len(bp.predictedBlocks))
	for _, pred := range bp.predictedBlocks {
		predictions = append(predictions, pred)
	}
	return predictions
}

func (bp *BlockPredictor) GetAccuracy() float64 {
	bp.mu.RLock()
	defer bp.mu.RUnlock()

	if len(bp.recentHistory) == 0 {
		return 0
	}

	accurate := 0
	for _, history := range bp.recentHistory {
		if history.WasAccurate {
			accurate++
		}
	}

	return float64(accurate) / float64(len(bp.recentHistory))
}
