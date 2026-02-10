# Prismer Cloud SDKs

Official SDKs for Prismer Cloud Context API.

## Available SDKs

| Language | Package | Directory | Status |
|----------|---------|-----------|--------|
| TypeScript/JavaScript | `@prismer/sdk` | [typescript/](./typescript) | ✅ v0.1.0 |
| Python | `prismer` | [python/](./python) | ✅ v0.1.0 |
| Go | `github.com/Prismer-AI/Prismer/sdk/golang` | [golang/](./golang) | ✅ v0.1.0 |

## API Coverage

| Endpoint | Description | TS | Py | Go |
|----------|-------------|:--:|:--:|:--:|
| `POST /api/context/load` | Load content from URL(s) or query | ✅ | ✅ | ✅ |
| `POST /api/context/save` | Save content to global cache | ✅ | ✅ | ✅ |

**Coming soon:** Search API, Parse API, Compress API, Usage/Billing API

---

## Quick Start

### TypeScript

```typescript
import { PrismerClient } from '@prismer/sdk';

const client = new PrismerClient({ apiKey: 'sk-prismer-...' });

// Load from URL
const result = await client.load('https://example.com');
console.log(result.result?.hqcc);

// Search and load
const results = await client.load('latest AI news', {
  return: { topK: 5 }
});
```

### Python

```python
from prismer import PrismerClient

client = PrismerClient(api_key="sk-prismer-...")

# Load from URL
result = client.load("https://example.com")
print(result.result.hqcc if result.result else None)

# Async support
from prismer import AsyncPrismerClient
async with AsyncPrismerClient(api_key="...") as client:
    result = await client.load("https://example.com")
```

### Go

```go
import "github.com/Prismer-AI/Prismer/sdk/golang"

client := prismer.NewClient("sk-prismer-...")

result, _ := client.Load(ctx, "https://example.com", nil)
fmt.Println(result.Result.HQCC)
```

---

## Building SDKs

### Build All

```bash
cd sdk
chmod +x scripts/build-all.sh
./scripts/build-all.sh
```

### Build Individual

```bash
# TypeScript
cd typescript && ./scripts/build.sh && ./scripts/pack.sh

# Python  
cd python && ./scripts/build.sh && ./scripts/pack.sh

# Go
cd golang && ./scripts/build.sh
```

### Output

After building:

```
sdk/
├── typescript/
│   ├── dist/              # Compiled JS/TS
│   └── prismer-sdk-0.1.0.tgz
├── python/
│   └── dist/
│       ├── prismer-0.1.0-py3-none-any.whl
│       └── prismer-0.1.0.tar.gz
└── golang/
    └── (distributed via git tags)
```

---

## Publishing

### TypeScript (npm)

```bash
cd typescript
npm publish prismer-sdk-0.1.0.tgz
# Or for scoped package:
npm publish prismer-sdk-0.1.0.tgz --access public
```

### Python (PyPI)

```bash
cd python
source .venv/bin/activate
twine upload dist/*
# Or test first:
twine upload --repository testpypi dist/*
```

### Go (GitHub)

```bash
cd golang
git tag sdk/golang/v0.1.0
git push origin main --tags
# Users install via:
# go get github.com/Prismer-AI/Prismer/sdk/golang@sdk/golang/v0.1.0
```

---

## Authentication

All SDKs require an API key starting with `sk-prismer-`.

Get your key from [Prismer Dashboard](https://prismer.io/dashboard).

---

## License

MIT
