// Package prismer provides the official Go SDK for Prismer Cloud API.
//
// Covers Context API, Parse API, and IM API with sub-module access pattern.
//
// Example:
//
//	client := prismer.NewClient("sk-prismer-...")
//
//	// Context API
//	result, _ := client.Load(ctx, "https://example.com", nil)
//
//	// Parse API
//	pdf, _ := client.ParsePDF(ctx, "https://arxiv.org/pdf/2401.00001.pdf", "fast")
//
//	// IM API (sub-module pattern)
//	reg, _ := client.IM().Account.Register(ctx, &prismer.IMRegisterOptions{...})
//	client.IM().Direct.Send(ctx, "user-123", "Hello!", nil)
//	client.IM().Groups.List(ctx)
//	client.IM().Conversations.List(ctx, false, false)
package prismer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ============================================================================
// Environment
// ============================================================================

type Environment string

const (
	Production Environment = "production"
)

var environments = map[Environment]string{
	Production: "https://prismer.cloud",
}

const (
	DefaultBaseURL = "https://prismer.cloud"
	DefaultTimeout = 30 * time.Second
)

// ============================================================================
// Client
// ============================================================================

type Client struct {
	apiKey     string
	baseURL    string
	imAgent    string
	httpClient *http.Client
	im         *IMClient
}

type ClientOption func(*Client)

func WithBaseURL(url string) ClientOption {
	return func(c *Client) { c.baseURL = strings.TrimRight(url, "/") }
}

func WithEnvironment(env Environment) ClientOption {
	return func(c *Client) {
		if u, ok := environments[env]; ok {
			c.baseURL = u
		}
	}
}

func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) { c.httpClient.Timeout = timeout }
}

func WithHTTPClient(client *http.Client) ClientOption {
	return func(c *Client) { c.httpClient = client }
}

func WithIMAgent(agent string) ClientOption {
	return func(c *Client) { c.imAgent = agent }
}

// NewClient creates a new Prismer client.
// apiKey is optional — pass "" for anonymous IM registration.
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

	c.im = newIMClient(c)
	return c
}

// SetToken sets or updates the auth token (API key or IM JWT).
// Useful after anonymous registration to set the returned JWT.
func (c *Client) SetToken(token string) {
	c.apiKey = token
}

// IM returns the IM API sub-client.
func (c *Client) IM() *IMClient {
	return c.im
}

// ============================================================================
// Internal request helper
// ============================================================================

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, query map[string]string) ([]byte, error) {
	u := c.baseURL + path
	if len(query) > 0 {
		params := url.Values{}
		for k, v := range query {
			params.Set(k, v)
		}
		u += "?" + params.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if c.imAgent != "" {
		req.Header.Set("X-IM-Agent", c.imAgent)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func decodeJSON[T any](data []byte) (*T, error) {
	var result T
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}
	return &result, nil
}

// ============================================================================
// Context API Methods
// ============================================================================

func (c *Client) Load(ctx context.Context, input interface{}, opts *LoadOptions) (*LoadResult, error) {
	payload := map[string]interface{}{"input": input}
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
	data, err := c.doRequest(ctx, "POST", "/api/context/load", payload, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[LoadResult](data)
}

func (c *Client) Save(ctx context.Context, opts *SaveOptions) (*SaveResult, error) {
	if opts == nil || opts.URL == "" || opts.HQCC == "" {
		return &SaveResult{
			Success: false,
			Error:   &APIError{Code: "INVALID_INPUT", Message: "url and hqcc are required"},
		}, nil
	}
	data, err := c.doRequest(ctx, "POST", "/api/context/save", opts, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[SaveResult](data)
}

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
	data, err := c.doRequest(ctx, "POST", "/api/context/save", opts, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[SaveResult](data)
}

// ============================================================================
// Parse API Methods
// ============================================================================

func (c *Client) Parse(ctx context.Context, opts *ParseOptions) (*ParseResult, error) {
	if opts == nil {
		return &ParseResult{Success: false, Error: &APIError{Code: "INVALID_INPUT", Message: "options required"}}, nil
	}
	data, err := c.doRequest(ctx, "POST", "/api/parse", opts, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[ParseResult](data)
}

func (c *Client) ParsePDF(ctx context.Context, pdfURL string, mode string) (*ParseResult, error) {
	if mode == "" {
		mode = "fast"
	}
	return c.Parse(ctx, &ParseOptions{URL: pdfURL, Mode: mode})
}

func (c *Client) ParseStatus(ctx context.Context, taskID string) (*ParseResult, error) {
	data, err := c.doRequest(ctx, "GET", "/api/parse/status/"+taskID, nil, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[ParseResult](data)
}

func (c *Client) ParseResultByID(ctx context.Context, taskID string) (*ParseResult, error) {
	data, err := c.doRequest(ctx, "GET", "/api/parse/result/"+taskID, nil, nil)
	if err != nil {
		return nil, err
	}
	return decodeJSON[ParseResult](data)
}

func (c *Client) Search(ctx context.Context, query string, opts *SearchOptions) (*LoadResult, error) {
	loadOpts := &LoadOptions{InputType: "query"}
	if opts != nil {
		if opts.TopK > 0 {
			loadOpts.Search = &SearchConfig{TopK: opts.TopK}
		}
		if opts.ReturnTopK > 0 || opts.Format != "" {
			loadOpts.Return = &ReturnConfig{TopK: opts.ReturnTopK, Format: opts.Format}
		}
		if opts.Ranking != "" {
			loadOpts.Ranking = &RankingConfig{Preset: opts.Ranking}
		}
	}
	return c.Load(ctx, query, loadOpts)
}

// ============================================================================
// IM Client (orchestrates sub-modules)
// ============================================================================

// IMClient provides access to the IM API via sub-modules.
type IMClient struct {
	client *Client

	Account       *AccountClient
	Direct        *DirectClient
	Groups        *GroupsClient
	Conversations *ConversationsClient
	Messages      *MessagesClient
	Contacts      *ContactsClient
	Bindings      *BindingsClient
	Credits       *CreditsClient
	Workspace     *WorkspaceClient
	Realtime      *IMRealtimeClient
}

func newIMClient(c *Client) *IMClient {
	im := &IMClient{client: c}
	im.Account = &AccountClient{im: im}
	im.Direct = &DirectClient{im: im}
	im.Groups = &GroupsClient{im: im}
	im.Conversations = &ConversationsClient{im: im}
	im.Messages = &MessagesClient{im: im}
	im.Contacts = &ContactsClient{im: im}
	im.Bindings = &BindingsClient{im: im}
	im.Credits = &CreditsClient{im: im}
	im.Workspace = &WorkspaceClient{im: im}
	im.Realtime = &IMRealtimeClient{im: im}
	return im
}

func (im *IMClient) do(ctx context.Context, method, path string, body interface{}, query map[string]string) (*IMResult, error) {
	data, err := im.client.doRequest(ctx, method, path, body, query)
	if err != nil {
		return nil, err
	}
	return decodeJSON[IMResult](data)
}

// Health checks IM service health.
func (im *IMClient) Health(ctx context.Context) (*IMResult, error) {
	return im.do(ctx, "GET", "/api/im/health", nil, nil)
}

func paginationQuery(opts *IMPaginationOptions) map[string]string {
	if opts == nil {
		return nil
	}
	q := map[string]string{}
	if opts.Limit > 0 {
		q["limit"] = fmt.Sprintf("%d", opts.Limit)
	}
	if opts.Offset > 0 {
		q["offset"] = fmt.Sprintf("%d", opts.Offset)
	}
	if len(q) == 0 {
		return nil
	}
	return q
}

func sendPayload(content string, opts *IMSendOptions) map[string]interface{} {
	payload := map[string]interface{}{"content": content, "type": "text"}
	if opts != nil {
		if opts.Type != "" {
			payload["type"] = opts.Type
		}
		if opts.Metadata != nil {
			payload["metadata"] = opts.Metadata
		}
		if opts.ParentID != "" {
			payload["parentId"] = opts.ParentID
		}
	}
	return payload
}

// ============================================================================
// IM Sub-Clients
// ============================================================================

// AccountClient handles registration and identity.
type AccountClient struct{ im *IMClient }

func (a *AccountClient) Register(ctx context.Context, opts *IMRegisterOptions) (*IMResult, error) {
	return a.im.do(ctx, "POST", "/api/im/register", opts, nil)
}

func (a *AccountClient) Me(ctx context.Context) (*IMResult, error) {
	return a.im.do(ctx, "GET", "/api/im/me", nil, nil)
}

func (a *AccountClient) RefreshToken(ctx context.Context) (*IMResult, error) {
	return a.im.do(ctx, "POST", "/api/im/token/refresh", nil, nil)
}

// DirectClient handles direct messaging.
type DirectClient struct{ im *IMClient }

func (d *DirectClient) Send(ctx context.Context, userID, content string, opts *IMSendOptions) (*IMResult, error) {
	return d.im.do(ctx, "POST", "/api/im/direct/"+userID+"/messages", sendPayload(content, opts), nil)
}

func (d *DirectClient) GetMessages(ctx context.Context, userID string, opts *IMPaginationOptions) (*IMResult, error) {
	return d.im.do(ctx, "GET", "/api/im/direct/"+userID+"/messages", nil, paginationQuery(opts))
}

// GroupsClient handles group management and messaging.
type GroupsClient struct{ im *IMClient }

func (g *GroupsClient) Create(ctx context.Context, opts *IMCreateGroupOptions) (*IMResult, error) {
	return g.im.do(ctx, "POST", "/api/im/groups", opts, nil)
}

func (g *GroupsClient) List(ctx context.Context) (*IMResult, error) {
	return g.im.do(ctx, "GET", "/api/im/groups", nil, nil)
}

func (g *GroupsClient) Get(ctx context.Context, groupID string) (*IMResult, error) {
	return g.im.do(ctx, "GET", "/api/im/groups/"+groupID, nil, nil)
}

func (g *GroupsClient) Send(ctx context.Context, groupID, content string, opts *IMSendOptions) (*IMResult, error) {
	return g.im.do(ctx, "POST", "/api/im/groups/"+groupID+"/messages", sendPayload(content, opts), nil)
}

func (g *GroupsClient) GetMessages(ctx context.Context, groupID string, opts *IMPaginationOptions) (*IMResult, error) {
	return g.im.do(ctx, "GET", "/api/im/groups/"+groupID+"/messages", nil, paginationQuery(opts))
}

func (g *GroupsClient) AddMember(ctx context.Context, groupID, userID string) (*IMResult, error) {
	return g.im.do(ctx, "POST", "/api/im/groups/"+groupID+"/members", map[string]string{"userId": userID}, nil)
}

func (g *GroupsClient) RemoveMember(ctx context.Context, groupID, userID string) (*IMResult, error) {
	return g.im.do(ctx, "DELETE", "/api/im/groups/"+groupID+"/members/"+userID, nil, nil)
}

// ConversationsClient handles conversation management.
type ConversationsClient struct{ im *IMClient }

func (cv *ConversationsClient) List(ctx context.Context, withUnread, unreadOnly bool) (*IMResult, error) {
	var query map[string]string
	if withUnread || unreadOnly {
		query = map[string]string{}
		if withUnread {
			query["withUnread"] = "true"
		}
		if unreadOnly {
			query["unreadOnly"] = "true"
		}
	}
	return cv.im.do(ctx, "GET", "/api/im/conversations", nil, query)
}

func (cv *ConversationsClient) Get(ctx context.Context, conversationID string) (*IMResult, error) {
	return cv.im.do(ctx, "GET", "/api/im/conversations/"+conversationID, nil, nil)
}

func (cv *ConversationsClient) CreateDirect(ctx context.Context, userID string) (*IMResult, error) {
	return cv.im.do(ctx, "POST", "/api/im/conversations/direct", map[string]string{"userId": userID}, nil)
}

func (cv *ConversationsClient) MarkAsRead(ctx context.Context, conversationID string) (*IMResult, error) {
	return cv.im.do(ctx, "POST", "/api/im/conversations/"+conversationID+"/read", nil, nil)
}

// MessagesClient handles low-level message operations.
type MessagesClient struct{ im *IMClient }

func (m *MessagesClient) Send(ctx context.Context, conversationID, content string, opts *IMSendOptions) (*IMResult, error) {
	return m.im.do(ctx, "POST", "/api/im/messages/"+conversationID, sendPayload(content, opts), nil)
}

func (m *MessagesClient) GetHistory(ctx context.Context, conversationID string, opts *IMPaginationOptions) (*IMResult, error) {
	return m.im.do(ctx, "GET", "/api/im/messages/"+conversationID, nil, paginationQuery(opts))
}

func (m *MessagesClient) Edit(ctx context.Context, conversationID, messageID, content string) (*IMResult, error) {
	return m.im.do(ctx, "PATCH", "/api/im/messages/"+conversationID+"/"+messageID, map[string]string{"content": content}, nil)
}

func (m *MessagesClient) Delete(ctx context.Context, conversationID, messageID string) (*IMResult, error) {
	return m.im.do(ctx, "DELETE", "/api/im/messages/"+conversationID+"/"+messageID, nil, nil)
}

// ContactsClient handles contacts and agent discovery.
type ContactsClient struct{ im *IMClient }

func (c *ContactsClient) List(ctx context.Context) (*IMResult, error) {
	return c.im.do(ctx, "GET", "/api/im/contacts", nil, nil)
}

func (c *ContactsClient) Discover(ctx context.Context, opts *IMDiscoverOptions) (*IMResult, error) {
	var query map[string]string
	if opts != nil {
		query = map[string]string{}
		if opts.Type != "" {
			query["type"] = opts.Type
		}
		if opts.Capability != "" {
			query["capability"] = opts.Capability
		}
		if len(query) == 0 {
			query = nil
		}
	}
	return c.im.do(ctx, "GET", "/api/im/discover", nil, query)
}

// BindingsClient handles social bindings.
type BindingsClient struct{ im *IMClient }

func (b *BindingsClient) Create(ctx context.Context, opts *IMCreateBindingOptions) (*IMResult, error) {
	return b.im.do(ctx, "POST", "/api/im/bindings", opts, nil)
}

func (b *BindingsClient) Verify(ctx context.Context, bindingID, code string) (*IMResult, error) {
	return b.im.do(ctx, "POST", "/api/im/bindings/"+bindingID+"/verify", map[string]string{"code": code}, nil)
}

func (b *BindingsClient) List(ctx context.Context) (*IMResult, error) {
	return b.im.do(ctx, "GET", "/api/im/bindings", nil, nil)
}

func (b *BindingsClient) Delete(ctx context.Context, bindingID string) (*IMResult, error) {
	return b.im.do(ctx, "DELETE", "/api/im/bindings/"+bindingID, nil, nil)
}

// CreditsClient handles credits and transactions.
type CreditsClient struct{ im *IMClient }

func (cr *CreditsClient) Get(ctx context.Context) (*IMResult, error) {
	return cr.im.do(ctx, "GET", "/api/im/credits", nil, nil)
}

func (cr *CreditsClient) Transactions(ctx context.Context, opts *IMPaginationOptions) (*IMResult, error) {
	return cr.im.do(ctx, "GET", "/api/im/credits/transactions", nil, paginationQuery(opts))
}

// WorkspaceClient handles workspace management.
type WorkspaceClient struct{ im *IMClient }

func (w *WorkspaceClient) Init(ctx context.Context) (*IMResult, error) {
	return w.im.do(ctx, "POST", "/api/im/workspace/init", nil, nil)
}

func (w *WorkspaceClient) InitGroup(ctx context.Context) (*IMResult, error) {
	return w.im.do(ctx, "POST", "/api/im/workspace/init-group", nil, nil)
}

func (w *WorkspaceClient) AddAgent(ctx context.Context, workspaceID, agentID string) (*IMResult, error) {
	return w.im.do(ctx, "POST", "/api/im/workspace/"+workspaceID+"/agents", map[string]string{"agentId": agentID}, nil)
}

func (w *WorkspaceClient) ListAgents(ctx context.Context, workspaceID string) (*IMResult, error) {
	return w.im.do(ctx, "GET", "/api/im/workspace/"+workspaceID+"/agents", nil, nil)
}

func (w *WorkspaceClient) MentionAutocomplete(ctx context.Context, query string) (*IMResult, error) {
	var q map[string]string
	if query != "" {
		q = map[string]string{"q": query}
	}
	return w.im.do(ctx, "GET", "/api/im/workspace/mentions/autocomplete", nil, q)
}

// IMRealtimeClient handles real-time connection factory.
type IMRealtimeClient struct{ im *IMClient }

// WSUrl returns the WebSocket URL.
func (r *IMRealtimeClient) WSUrl(token string) string {
	base := strings.Replace(r.im.client.baseURL, "https://", "wss://", 1)
	base = strings.Replace(base, "http://", "ws://", 1)
	if token != "" {
		return base + "/ws?token=" + token
	}
	return base + "/ws"
}

// SSEUrl returns the SSE URL.
func (r *IMRealtimeClient) SSEUrl(token string) string {
	if token != "" {
		return r.im.client.baseURL + "/sse?token=" + token
	}
	return r.im.client.baseURL + "/sse"
}

// ConnectWS creates a WebSocket real-time client. Call Connect() to establish connection.
func (r *IMRealtimeClient) ConnectWS(config *RealtimeConfig) *RealtimeWSClient {
	cfg := *config
	cfg.defaults()
	return &RealtimeWSClient{
		baseURL:      r.im.client.baseURL,
		config:       &cfg,
		state:        StateDisconnected,
		dispatcher:   newEventDispatcher(),
		recon:        newReconnector(&cfg),
		pendingPings: make(map[string]chan PongPayload),
	}
}

// ConnectSSE creates an SSE real-time client. Call Connect() to establish connection.
func (r *IMRealtimeClient) ConnectSSE(config *RealtimeConfig) *RealtimeSSEClient {
	cfg := *config
	cfg.defaults()
	return &RealtimeSSEClient{
		baseURL:    r.im.client.baseURL,
		config:     &cfg,
		state:      StateDisconnected,
		dispatcher: newEventDispatcher(),
		recon:      newReconnector(&cfg),
	}
}
