# @prismer/sdk

Official TypeScript/JavaScript SDK for Prismer Cloud Context API.

Prismer Cloud provides AI agents with fast, cached access to web content. Load URLs or search queries, get compressed high-quality content (HQCC) optimized for LLM consumption.

## Installation

```bash
npm install @prismer/sdk
# or
pnpm add @prismer/sdk
# or
yarn add @prismer/sdk
```

## Quick Start

```typescript
import { PrismerClient } from '@prismer/sdk';

const client = new PrismerClient({
  apiKey: 'sk-prismer-...',
});

// Load content from a URL
const result = await client.load('https://example.com');
if (result.success && result.result) {
  console.log(result.result.hqcc);  // Compressed content for LLM
}
```

---

## API Reference

### Constructor

```typescript
const client = new PrismerClient({
  apiKey: string,       // Required: API key (starts with sk-prismer-)
  baseUrl?: string,     // Optional: API base URL (default: https://prismer.cloud)
  timeout?: number,     // Optional: Request timeout in ms (default: 30000)
  fetch?: typeof fetch, // Optional: Custom fetch implementation
});
```

---

## `load(input, options?)`

Load content from URL(s) or search query. The API auto-detects input type.

### Input Types

| Input | Mode | Description |
|-------|------|-------------|
| `"https://..."` | `single_url` | Fetch single URL, check cache first |
| `["url1", "url2"]` | `batch_urls` | Batch cache lookup |
| `"search query"` | `query` | Search → cache check → compress → rank |

### Examples

#### Single URL

```typescript
const result = await client.load('https://example.com');

// Result structure:
{
  success: true,
  requestId: "load_abc123",
  mode: "single_url",
  result: {
    url: "https://example.com",
    title: "Example Domain",
    hqcc: "# Example Domain\n\nThis domain is for...",  // Compressed content
    cached: true,           // Was it from cache?
    cachedAt: "2024-01-15T10:30:00Z",
    meta: { ... }
  },
  cost: { credits: 0, cached: true },  // Free if cached
  processingTime: 45
}
```

#### Batch URLs

```typescript
// Cache check only (default)
const result = await client.load(['url1', 'url2', 'url3']);

// With processing for uncached URLs
const result = await client.load(['url1', 'url2', 'url3'], {
  processUncached: true,
  processing: { 
    strategy: 'fast',      // 'auto' | 'fast' | 'quality'
    maxConcurrent: 5       // Parallel compression limit
  }
});

// Result structure:
{
  success: true,
  mode: "batch_urls",
  results: [
    { url: "url1", found: true, cached: true, hqcc: "..." },
    { url: "url2", found: true, cached: false, processed: true, hqcc: "..." },
    { url: "url3", found: false, cached: false, hqcc: null }
  ],
  summary: { total: 3, found: 2, notFound: 1, cached: 1, processed: 1 },
  cost: { credits: 0.5, cached: 1 }
}
```

#### Search Query

```typescript
const result = await client.load('latest developments in AI agents 2024', {
  search: { 
    topK: 15              // How many search results to fetch
  },
  processing: {
    strategy: 'quality',  // Better compression for important content
    maxConcurrent: 3
  },
  return: {
    topK: 5,              // How many results to return
    format: 'both'        // 'hqcc' | 'raw' | 'both'
  },
  ranking: {
    preset: 'cache_first' // Prefer cached results
    // Or use custom weights:
    // custom: { cacheHit: 0.3, relevance: 0.4, freshness: 0.2, quality: 0.1 }
  }
});

// Result structure:
{
  success: true,
  mode: "query",
  results: [
    {
      rank: 1,
      url: "https://...",
      title: "AI Agents in 2024",
      hqcc: "...",
      raw: "...",           // Only if format='both'
      cached: true,
      ranking: {
        score: 0.85,
        factors: { cache: 0.3, relevance: 0.35, freshness: 0.15, quality: 0.05 }
      }
    },
    // ... more results
  ],
  summary: { query: "...", searched: 15, cacheHits: 8, compressed: 7, returned: 5 },
  cost: { 
    searchCredits: 1, 
    compressionCredits: 3.5, 
    totalCredits: 4.5,
    savedByCache: 4.0      // Credits saved by cache hits
  }
}
```

### Load Options

```typescript
interface LoadOptions {
  // Force input type detection
  inputType?: 'url' | 'urls' | 'query';
  
  // Process uncached URLs in batch mode
  processUncached?: boolean;
  
  // Search configuration (query mode)
  search?: {
    topK?: number;         // Search results to fetch (default: 15)
  };
  
  // Processing configuration
  processing?: {
    strategy?: 'auto' | 'fast' | 'quality';
    maxConcurrent?: number;  // Default: 3
  };
  
  // Return configuration
  return?: {
    format?: 'hqcc' | 'raw' | 'both';
    topK?: number;           // Results to return (default: 5)
  };
  
  // Ranking configuration (query mode)
  ranking?: {
    preset?: 'cache_first' | 'relevance_first' | 'balanced';
    custom?: {
      cacheHit?: number;     // 0-1, bonus for cached items
      relevance?: number;    // 0-1, search relevance weight
      freshness?: number;    // 0-1, recency weight
      quality?: number;      // 0-1, content quality weight
    };
  };
}
```

### Ranking Presets

| Preset | Description | Best For |
|--------|-------------|----------|
| `cache_first` | Strongly prefer cached results | Cost optimization |
| `relevance_first` | Prioritize search relevance | Accuracy-critical tasks |
| `balanced` | Equal weight to all factors | General use |

---

## `save(options)` / `saveBatch(items)`

Save content to Prismer's global cache. Requires authentication.

### Single Save

```typescript
const result = await client.save({
  url: 'https://example.com/article',
  hqcc: 'Compressed content for LLM...',
  raw: 'Original HTML/text content...',  // Optional
  meta: {                                 // Optional metadata
    source: 'my-crawler',
    crawledAt: new Date().toISOString()
  }
});

// Result:
{ success: true, status: 'created', url: '...' }
// Or if already exists:
{ success: true, status: 'exists', url: '...' }
```

### Batch Save (max 50 items)

```typescript
const result = await client.save({
  items: [
    { url: 'url1', hqcc: 'content1' },
    { url: 'url2', hqcc: 'content2', raw: 'raw2' },
    { url: 'url3', hqcc: 'content3', meta: { source: 'bot' } },
  ]
});

// Or use the convenience method:
const result = await client.saveBatch([
  { url: 'url1', hqcc: 'content1' },
  { url: 'url2', hqcc: 'content2' },
]);

// Result:
{
  success: true,
  results: [
    { url: 'url1', status: 'created' },
    { url: 'url2', status: 'exists' },
    { url: 'url3', status: 'created' }
  ],
  summary: { total: 3, created: 2, exists: 1 }
}
```

---

## Error Handling

```typescript
const result = await client.load('https://example.com');

if (!result.success) {
  console.error(`Error [${result.error?.code}]: ${result.error?.message}`);
  // Handle specific errors:
  switch (result.error?.code) {
    case 'UNAUTHORIZED':
      // Invalid or missing API key
      break;
    case 'INVALID_INPUT':
      // Bad request parameters
      break;
    case 'TIMEOUT':
      // Request timed out
      break;
    case 'NETWORK_ERROR':
      // Network connectivity issue
      break;
  }
  return;
}

// Safe to use result
console.log(result.result?.hqcc);
```

---

## TypeScript Types

All types are exported for TypeScript users:

```typescript
import type {
  PrismerConfig,
  LoadOptions,
  LoadResult,
  LoadResultItem,
  RankingFactors,
  SingleUrlCost,
  BatchUrlCost,
  QueryCost,
  BatchSummary,
  QuerySummary,
  SaveOptions,
  SaveBatchOptions,
  SaveResult,
} from '@prismer/sdk';
```

---

## Best Practices

### 1. Batch URLs When Possible

```typescript
// ❌ Multiple individual requests
for (const url of urls) {
  await client.load(url);
}

// ✅ Single batch request
await client.load(urls, { processUncached: true });
```

### 2. Use Cache-First Ranking for Cost Savings

```typescript
// Cached results are free, uncached cost credits
const result = await client.load('AI news', {
  ranking: { preset: 'cache_first' }
});
console.log(`Saved ${result.cost?.savedByCache} credits from cache hits`);
```

### 3. Choose the Right Format

```typescript
// For LLM context: just HQCC (smaller, optimized)
await client.load(url, { return: { format: 'hqcc' } });

// For display + LLM: both formats
await client.load(url, { return: { format: 'both' } });
```

### 4. Handle Partial Failures in Batch

```typescript
const result = await client.load(urls, { processUncached: true });
const failed = result.results?.filter(r => !r.found && !r.processed);
if (failed?.length) {
  console.warn('Failed URLs:', failed.map(r => r.url));
}
```

---

## Environment Variables

```bash
# Optional: Set default API key
PRISMER_API_KEY=sk-prismer-...

# Optional: Custom API endpoint
PRISMER_BASE_URL=https://prismer.cloud
```

---

## License

MIT
