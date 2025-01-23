package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gorilla/mux"
	"go.uber.org/zap"

	"github.com/copile/go-block-engine/internal/engine"
)

type Server struct {
	predictor *engine.BlockPredictor
	logger    *zap.Logger
	firestore *firestore.Client
	router    *mux.Router
}

type PredictionResponse struct {
	Predictions []*engine.PredictedBlock `json:"predictions"`
	CurrentSlot uint64                   `json:"current_slot"`
	Accuracy    float64                  `json:"accuracy"`
	Timestamp   time.Time                `json:"timestamp"`
}

func NewServer(predictor *engine.BlockPredictor, logger *zap.Logger, firestoreClient *firestore.Client) *Server {
	s := &Server{
		predictor: predictor,
		logger:    logger,
		firestore: firestoreClient,
		router:    mux.NewRouter(),
	}

	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")
	s.router.HandleFunc("/predictions", s.handleGetPredictions).Methods("GET")
	s.router.HandleFunc("/accuracy", s.handleGetAccuracy).Methods("GET")
}

func (s *Server) Start(port int) error {
	addr := fmt.Sprintf(":%d", port)
	s.logger.Info("Starting server", zap.String("address", addr))
	return http.ListenAndServe(addr, s.router)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleGetPredictions(w http.ResponseWriter, r *http.Request) {
	predictions := s.predictor.GetPredictions()
	accuracy := s.predictor.GetAccuracy()

	response := PredictionResponse{
		Predictions: predictions,
		Accuracy:    accuracy,
		Timestamp:   time.Now().UTC(),
	}

	// Store predictions in Firestore
	ctx := context.Background()
	_, err := s.firestore.Collection("block_predictions").Doc(time.Now().UTC().Format(time.RFC3339)).Set(ctx, response)
	if err != nil {
		s.logger.Error("Failed to store predictions", zap.Error(err))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleGetAccuracy(w http.ResponseWriter, r *http.Request) {
	accuracy := s.predictor.GetAccuracy()

	response := map[string]interface{}{
		"accuracy":  accuracy,
		"timestamp": time.Now().UTC(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
