# prismer-sdk-go

Official Go SDK for Prismer Cloud Context API.

Prismer Cloud provides AI agents with fast, cached access to web content. Load URLs or search queries, get compressed high-quality content (HQCC) optimized for LLM consumption.

## Installation

```bash
go get github.com/prismer-io/prismer-sdk-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/prismer-io/prismer-sdk-go"
)

func main() {
    client := prismer.NewClient("sk-prismer-...")

    result, err := client.Load(context.Background(), "https://example.com", nil)
    if err != nil {
        log.Fatal(err)
    }

    if result.Success && result.Result != nil {
        fmt.Println(result.Result.HQCC)  // Compressed content for LLM
    }
}
```

---

## API Reference

### Constructor

```go
// Basic
client := prismer.NewClient("sk-prismer-...")

// With options
client := prismer.NewClient("sk-prismer-...",
    prismer.WithBaseURL("https://custom.api.com"),
    prismer.WithTimeout(60 * time.Second),
    prismer.WithHTTPClient(customClient),
)
```

---

## `Load(ctx, input, opts)`

Load content from URL(s) or search query. The API auto-detects input type.

### Input Types

| Input | Mode | Description |
|-------|------|-------------|
| `"https://..."` | `single_url` | Fetch single URL, check cache first |
| `[]string{"url1", "url2"}` | `batch_urls` | Batch cache lookup |
| `"search query"` | `query` | Search → cache check → compress → rank |

### Examples

#### Single URL

```go
result, err := client.Load(ctx, "https://example.com", nil)
if err != nil {
    log.Fatal(err)
}

if result.Success && result.Result != nil {
    fmt.Printf("Title: %s\n", result.Result.Title)
    fmt.Printf("HQCC: %s\n", result.Result.HQCC)
    fmt.Printf("Cached: %v\n", result.Result.Cached)
}

// Result structure:
// LoadResult{
//   Success: true,
//   RequestID: "load_abc123",
//   Mode: "single_url",
//   Result: &LoadResultItem{
//     URL: "https://example.com",
//     Title: "Example Domain",
//     HQCC: "# Example Domain\n\nThis domain is for...",
//     Cached: true,
//     CachedAt: "2024-01-15T10:30:00Z",
//   },
//   Cost: map[string]any{"credits": 0, "cached": true},
//   ProcessingTime: 45,
// }
```

#### Batch URLs

```go
// Cache check only (default)
result, err := client.Load(ctx, []string{"url1", "url2", "url3"}, nil)

// With processing for uncached URLs
result, err := client.Load(ctx, []string{"url1", "url2", "url3"}, &prismer.LoadOptions{
    ProcessUncached: true,
    Processing: &prismer.ProcessConfig{
        Strategy:      "fast",  // "auto" | "fast" | "quality"
        MaxConcurrent: 5,
    },
})

// Result:
// result.Results = []LoadResultItem{
//   {URL: "url1", Found: true, Cached: true, HQCC: "..."},
//   {URL: "url2", Found: true, Cached: false, Processed: true, HQCC: "..."},
//   {URL: "url3", Found: false, Cached: false, HQCC: ""},
// }
// result.Summary = map[string]any{"total": 3, "found": 2, "notFound": 1, "cached": 1, "processed": 1}
```

#### Search Query

```go
result, err := client.Load(ctx, "latest developments in AI agents 2024", &prismer.LoadOptions{
    Search: &prismer.SearchConfig{
        TopK: 15,  // Search results to fetch
    },
    Processing: &prismer.ProcessConfig{
        Strategy:      "quality",
        MaxConcurrent: 3,
    },
    Return: &prismer.ReturnConfig{
        TopK:   5,      // Results to return
        Format: "both", // "hqcc" | "raw" | "both"
    },
    Ranking: &prismer.RankingConfig{
        Preset: "cache_first",  // Prefer cached results
        // Or custom weights:
        // Custom: &prismer.RankingCustomConfig{
        //     CacheHit:  0.3,
        //     Relevance: 0.4,
        //     Freshness: 0.2,
        //     Quality:   0.1,
        // },
    },
})

// Result:
// result.Results = []LoadResultItem{
//   {
//     Rank: 1,
//     URL: "https://...",
//     Title: "AI Agents in 2024",
//     HQCC: "...",
//     Raw: "...",
//     Cached: true,
//     Ranking: &RankingInfo{
//       Score: 0.85,
//       Factors: RankingFactors{Cache: 0.3, Relevance: 0.35, Freshness: 0.15, Quality: 0.05},
//     },
//   },
//   ...
// }
// result.Cost = map[string]any{
//   "searchCredits": 1,
//   "compressionCredits": 3.5,
//   "totalCredits": 4.5,
//   "savedByCache": 4.0,
// }
```

### LoadOptions

```go
type LoadOptions struct {
    InputType       string          // "url", "urls", "query"
    ProcessUncached bool            // Process uncached URLs in batch
    Search          *SearchConfig   // {TopK: 15}
    Processing      *ProcessConfig  // {Strategy: "auto", MaxConcurrent: 3}
    Return          *ReturnConfig   // {Format: "hqcc", TopK: 5}
    Ranking         *RankingConfig  // {Preset: "cache_first"} or {Custom: {...}}
}
```

### Ranking Presets

| Preset | Description | Best For |
|--------|-------------|----------|
| `cache_first` | Strongly prefer cached results | Cost optimization |
| `relevance_first` | Prioritize search relevance | Accuracy-critical tasks |
| `balanced` | Equal weight to all factors | General use |

---

## `Save(ctx, opts)` / `SaveBatch(ctx, opts)`

Save content to Prismer's global cache. Requires authentication.

### Single Save

```go
result, err := client.Save(ctx, &prismer.SaveOptions{
    URL:  "https://example.com/article",
    HQCC: "Compressed content for LLM...",
    Raw:  "Original HTML/text content...",  // Optional
    Meta: map[string]interface{}{            // Optional
        "source":    "my-crawler",
        "crawledAt": time.Now().Format(time.RFC3339),
    },
})

// Result:
// SaveResult{Success: true, Status: "created", URL: "..."}
// Or if already exists:
// SaveResult{Success: true, Status: "exists", URL: "..."}
```

### Batch Save (max 50 items)

```go
result, err := client.SaveBatch(ctx, &prismer.SaveBatchOptions{
    Items: []prismer.SaveOptions{
        {URL: "url1", HQCC: "content1"},
        {URL: "url2", HQCC: "content2", Raw: "raw2"},
        {URL: "url3", HQCC: "content3", Meta: map[string]interface{}{"source": "bot"}},
    },
})

// Result:
// SaveResult{
//   Success: true,
//   Results: []SaveResultItem{
//     {URL: "url1", Status: "created"},
//     {URL: "url2", Status: "exists"},
//     {URL: "url3", Status: "created"},
//   },
//   Summary: &SaveSummary{Total: 3, Created: 2, Exists: 1},
// }
```

---

## Error Handling

```go
result, err := client.Load(ctx, "https://example.com", nil)

// Network/encoding errors
if err != nil {
    log.Fatalf("Request failed: %v", err)
}

// API errors
if !result.Success {
    fmt.Printf("Error [%s]: %s\n", result.Error.Code, result.Error.Message)
    
    switch result.Error.Code {
    case "UNAUTHORIZED":
        // Invalid or missing API key
    case "INVALID_INPUT":
        // Bad request parameters
    case "BATCH_TOO_LARGE":
        // Too many items in batch (>50)
    }
    return
}

// Safe to use result
fmt.Println(result.Result.HQCC)
```

---

## Best Practices

### 1. Use Context for Timeouts

```go
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := client.Load(ctx, "https://example.com", nil)
```

### 2. Batch URLs When Possible

```go
// ❌ Multiple individual requests
for _, url := range urls {
    client.Load(ctx, url, nil)
}

// ✅ Single batch request
client.Load(ctx, urls, &prismer.LoadOptions{ProcessUncached: true})
```

### 3. Reuse Client

```go
// ✅ Create once, reuse
client := prismer.NewClient("sk-prismer-...")

// Use throughout application
result1, _ := client.Load(ctx, url1, nil)
result2, _ := client.Load(ctx, url2, nil)
```

### 4. Handle Partial Failures in Batch

```go
result, _ := client.Load(ctx, urls, &prismer.LoadOptions{ProcessUncached: true})

for _, item := range result.Results {
    if !item.Found && !item.Processed {
        log.Printf("Failed to process: %s", item.URL)
    }
}
```

---

## Environment Variables

```bash
# Optional: Set default API key
export PRISMER_API_KEY=sk-prismer-...

# Optional: Custom API endpoint
export PRISMER_BASE_URL=https://prismer.cloud
```

---

## License

MIT
