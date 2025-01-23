package pkg

import (
	"sync"
)

// CircularBuffer is a thread-safe fixed-size circular buffer
type CircularBuffer struct {
	data     []interface{}
	size     int
	head     int
	tail     int
	count    int
	mu       sync.RWMutex
}

// NewCircularBuffer creates a new circular buffer with the specified size
func NewCircularBuffer(size int) *CircularBuffer {
	return &CircularBuffer{
		data: make([]interface{}, size),
		size: size,
	}
}

// Add adds an item to the buffer, overwriting the oldest item if the buffer is full
func (cb *CircularBuffer) Add(item interface{}) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.data[cb.head] = item
	cb.head = (cb.head + 1) % cb.size

	if cb.count < cb.size {
		cb.count++
	} else {
		cb.tail = (cb.tail + 1) % cb.size
	}
}

// GetRecent returns the n most recent items in chronological order
func (cb *CircularBuffer) GetRecent(n int) []interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if n > cb.count {
		n = cb.count
	}

	result := make([]interface{}, n)
	idx := 0

	// Calculate starting position
	start := (cb.head - n + cb.size) % cb.size
	if start < 0 {
		start += cb.size
	}

	// Copy items in chronological order
	for i := 0; i < n; i++ {
		pos := (start + i) % cb.size
		result[idx] = cb.data[pos]
		idx++
	}

	return result
}

// GetAll returns all items in the buffer in chronological order
func (cb *CircularBuffer) GetAll() []interface{} {
	return cb.GetRecent(cb.size)
}

// Clear removes all items from the buffer
func (cb *CircularBuffer) Clear() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.data = make([]interface{}, cb.size)
	cb.head = 0
	cb.tail = 0
	cb.count = 0
}

// Count returns the current number of items in the buffer
func (cb *CircularBuffer) Count() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.count
}

// IsFull returns true if the buffer is full
func (cb *CircularBuffer) IsFull() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.count == cb.size
}

// IsEmpty returns true if the buffer is empty
func (cb *CircularBuffer) IsEmpty() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.count == 0
}

// Capacity returns the total capacity of the buffer
func (cb *CircularBuffer) Capacity() int {
	return cb.size
}

// ForEach executes the provided function for each item in the buffer in chronological order
func (cb *CircularBuffer) ForEach(fn func(item interface{}) bool) {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if cb.count == 0 {
		return
	}

	start := cb.tail
	for i := 0; i < cb.count; i++ {
		pos := (start + i) % cb.size
		if !fn(cb.data[pos]) {
			break
		}
	}
}

// Filter returns a new slice containing all items that satisfy the predicate
func (cb *CircularBuffer) Filter(predicate func(item interface{}) bool) []interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	result := make([]interface{}, 0, cb.count)
	
	if cb.count == 0 {
		return result
	}

	start := cb.tail
	for i := 0; i < cb.count; i++ {
		pos := (start + i) % cb.size
		if predicate(cb.data[pos]) {
			result = append(result, cb.data[pos])
		}
	}

	return result
}

// Map applies the provided function to each item and returns a new slice with the results
func (cb *CircularBuffer) Map(fn func(item interface{}) interface{}) []interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	result := make([]interface{}, cb.count)
	
	if cb.count == 0 {
		return result
	}

	start := cb.tail
	for i := 0; i < cb.count; i++ {
		pos := (start + i) % cb.size
		result[i] = fn(cb.data[pos])
	}

	return result
}

// Reduce applies a reduction function to all items in the buffer
func (cb *CircularBuffer) Reduce(fn func(acc, item interface{}) interface{}, initial interface{}) interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if cb.count == 0 {
		return initial
	}

	result := initial
	start := cb.tail
	for i := 0; i < cb.count; i++ {
		pos := (start + i) % cb.size
		result = fn(result, cb.data[pos])
	}

	return result
}

// Window returns a sliding window view of the buffer with the specified size
func (cb *CircularBuffer) Window(windowSize int) [][]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if windowSize > cb.count {
		return nil
	}

	numWindows := cb.count - windowSize + 1
	windows := make([][]interface{}, numWindows)

	for i := 0; i < numWindows; i++ {
		window := make([]interface{}, windowSize)
		start := (cb.tail + i) % cb.size
		
		for j := 0; j < windowSize; j++ {
			pos := (start + j) % cb.size
			window[j] = cb.data[pos]
		}
		
		windows[i] = window
	}

	return windows
} 