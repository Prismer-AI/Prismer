// Package prismer provides the official Go SDK for Prismer Cloud API.
//
// Based on actual API implementation at /api/context/load and /api/context/save.
//
// Example:
//
//	client := prismer.NewClient("sk-prismer-...")
//	result, err := client.Load(context.Background(), "https://example.com", nil)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Println(result.Result.HQCC)
package prismer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "https://prismer.cloud"
	DefaultTimeout = 30 * time.Second
)

// Client is the Prismer API client.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// ClientOption is a function that configures the client.
type ClientOption func(*Client)

// WithBaseURL sets a custom base URL.
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(url, "/")
	}
}

// WithTimeout sets a custom timeout.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = timeout
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = client
	}
}

// NewClient creates a new Prismer API client.
func NewClient(apiKey string, opts ...ClientOption) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: DefaultBaseURL,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// ============================================================================
// Types - Based on actual API implementation
// ============================================================================

// LoadOptions configures the load request.
type LoadOptions struct {
	// Force input type: "url", "urls", "query"
	InputType string `json:"inputType,omitempty"`
	// Process uncached URLs in batch mode
	ProcessUncached bool `json:"processUncached,omitempty"`
	// Search configuration (query mode only)
	Search *SearchConfig `json:"search,omitempty"`
	// Processing configuration
	Processing *ProcessConfig `json:"processing,omitempty"`
	// Return configuration
	Return *ReturnConfig `json:"return,omitempty"`
	// Ranking configuration (query mode only)
	Ranking *RankingConfig `json:"ranking,omitempty"`
}

// SearchConfig configures search behavior (query mode).
type SearchConfig struct {
	// Number of search results to fetch (default: 15)
	TopK int `json:"topK,omitempty"`
}

// ProcessConfig configures processing behavior.
type ProcessConfig struct {
	// Compression strategy: "auto", "fast", "quality"
	Strategy string `json:"strategy,omitempty"`
	// Max concurrent compressions (default: 3)
	MaxConcurrent int `json:"maxConcurrent,omitempty"`
}

// ReturnConfig configures return format.
type ReturnConfig struct {
	// Return format: "hqcc", "raw", "both"
	Format string `json:"format,omitempty"`
	// Number of results to return (default: 5, query mode)
	TopK int `json:"topK,omitempty"`
}

// RankingConfig configures result ranking (query mode).
type RankingConfig struct {
	// Preset: "cache_first", "relevance_first", "balanced"
	Preset string `json:"preset,omitempty"`
	// Custom ranking weights (0-1 each)
	Custom *RankingCustomConfig `json:"custom,omitempty"`
}

// RankingCustomConfig for custom ranking weights.
type RankingCustomConfig struct {
	CacheHit  float64 `json:"cacheHit,omitempty"`
	Relevance float64 `json:"relevance,omitempty"`
	Freshness float64 `json:"freshness,omitempty"`
	Quality   float64 `json:"quality,omitempty"`
}

// LoadResult is the response from load.
type LoadResult struct {
	Success        bool             `json:"success"`
	RequestID      string           `json:"requestId,omitempty"`
	Mode           string           `json:"mode,omitempty"` // "single_url", "batch_urls", "query"
	Result         *LoadResultItem  `json:"result,omitempty"`
	Results        []LoadResultItem `json:"results,omitempty"`
	Summary        map[string]any   `json:"summary,omitempty"`
	Cost           map[string]any   `json:"cost,omitempty"`
	ProcessingTime int              `json:"processingTime,omitempty"`
	Error          *APIError        `json:"error,omitempty"`
}

// LoadResultItem is a single result item.
type LoadResultItem struct {
	Rank      int                    `json:"rank,omitempty"` // 1-based, query mode
	URL       string                 `json:"url"`
	Title     string                 `json:"title,omitempty"`
	HQCC      string                 `json:"hqcc,omitempty"`
	Raw       string                 `json:"raw,omitempty"`
	Cached    bool                   `json:"cached"`
	CachedAt  string                 `json:"cachedAt,omitempty"`
	Processed bool                   `json:"processed,omitempty"` // batch mode
	Found     bool                   `json:"found,omitempty"`     // batch mode
	Error     string                 `json:"error,omitempty"`     // if processing failed
	Ranking   *RankingInfo           `json:"ranking,omitempty"`   // query mode
	Meta      map[string]interface{} `json:"meta,omitempty"`
}

// RankingInfo contains ranking details.
type RankingInfo struct {
	Score   float64        `json:"score"`
	Factors RankingFactors `json:"factors,omitempty"`
}

// RankingFactors breakdown.
type RankingFactors struct {
	Cache     float64 `json:"cache"`
	Relevance float64 `json:"relevance"`
	Freshness float64 `json:"freshness"`
	Quality   float64 `json:"quality"`
}

// SaveOptions for single save.
type SaveOptions struct {
	URL  string                 `json:"url"`
	HQCC string                 `json:"hqcc"`
	Raw  string                 `json:"raw,omitempty"`
	Meta map[string]interface{} `json:"meta,omitempty"`
}

// SaveBatchOptions for batch save (max 50 items).
type SaveBatchOptions struct {
	Items []SaveOptions `json:"items"`
}

// SaveResult is the response from save.
type SaveResult struct {
	Success bool             `json:"success"`
	Status  string           `json:"status,omitempty"` // "created", "exists" (single)
	URL     string           `json:"url,omitempty"`    // single save
	Results []SaveResultItem `json:"results,omitempty"`
	Summary *SaveSummary     `json:"summary,omitempty"`
	Error   *APIError        `json:"error,omitempty"`
}

// SaveResultItem is a single batch save result.
type SaveResultItem struct {
	URL    string `json:"url"`
	Status string `json:"status"`
}

// SaveSummary contains batch save summary.
type SaveSummary struct {
	Total   int `json:"total"`
	Created int `json:"created"`
	Exists  int `json:"exists"`
}

// APIError represents an API error.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// ============================================================================
// Methods
// ============================================================================

// Load fetches content from URL(s) or search query.
//
// The API auto-detects input type:
//   - Single URL: "https://..." → checks cache, fetches & compresses if miss
//   - URL array: []string{"url1", "url2"} → batch cache check
//   - Query string: "search terms" → searches, caches results, ranks
//
// Example:
//
//	// Single URL
//	result, err := client.Load(ctx, "https://example.com", nil)
//
//	// Batch URLs with processing
//	result, err := client.Load(ctx, []string{"url1", "url2"}, &prismer.LoadOptions{
//	    ProcessUncached: true,
//	})
//
//	// Search query
//	result, err := client.Load(ctx, "latest AI news", &prismer.LoadOptions{
//	    Search: &prismer.SearchConfig{TopK: 15},
//	    Return: &prismer.ReturnConfig{TopK: 5, Format: "both"},
//	    Ranking: &prismer.RankingConfig{Preset: "cache_first"},
//	})
func (c *Client) Load(ctx context.Context, input interface{}, opts *LoadOptions) (*LoadResult, error) {
	payload := map[string]interface{}{
		"input": input,
	}

	if opts != nil {
		if opts.InputType != "" {
			payload["inputType"] = opts.InputType
		}
		if opts.ProcessUncached {
			payload["processUncached"] = true
		}
		if opts.Search != nil {
			payload["search"] = opts.Search
		}
		if opts.Processing != nil {
			payload["processing"] = opts.Processing
		}
		if opts.Return != nil {
			payload["return"] = opts.Return
		}
		if opts.Ranking != nil {
			payload["ranking"] = opts.Ranking
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/context/load", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result LoadResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// Save stores content in Prismer cache.
//
// Requires authentication. Content is stored globally and can be
// retrieved by any authenticated user via Load().
//
// Example:
//
//	result, err := client.Save(ctx, &prismer.SaveOptions{
//	    URL:  "https://example.com",
//	    HQCC: "compressed content...",
//	    Raw:  "original content...",
//	    Meta: map[string]interface{}{"source": "my-agent"},
//	})
func (c *Client) Save(ctx context.Context, opts *SaveOptions) (*SaveResult, error) {
	if opts == nil || opts.URL == "" || opts.HQCC == "" {
		return &SaveResult{
			Success: false,
			Error:   &APIError{Code: "INVALID_INPUT", Message: "url and hqcc are required"},
		}, nil
	}

	body, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/context/save", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result SaveResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// SaveBatch stores multiple items in Prismer cache (max 50).
//
// Example:
//
//	result, err := client.SaveBatch(ctx, &prismer.SaveBatchOptions{
//	    Items: []prismer.SaveOptions{
//	        {URL: "url1", HQCC: "content1"},
//	        {URL: "url2", HQCC: "content2"},
//	    },
//	})
func (c *Client) SaveBatch(ctx context.Context, opts *SaveBatchOptions) (*SaveResult, error) {
	if opts == nil || len(opts.Items) == 0 {
		return &SaveResult{
			Success: false,
			Error:   &APIError{Code: "INVALID_INPUT", Message: "items are required"},
		}, nil
	}

	if len(opts.Items) > 50 {
		return &SaveResult{
			Success: false,
			Error:   &APIError{Code: "BATCH_TOO_LARGE", Message: "Maximum 50 items per batch request"},
		}, nil
	}

	body, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/context/save", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result SaveResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}
