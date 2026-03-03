# Bidirectional Indexing Implementation Plan

## 1. Data Analysis Summary

### 1.1 OCR Service Output (Updated)

The OCR service now provides complete bidirectional indexing support:

```
public/data/output/{arxiv_id}/
├── detections.json      # Detection boxes with IDs and text
├── ocr_result.json      # Full OCR result (kept for compatibility)
├── paper.md             # Markdown with <!--ref:id--> markers
├── metadata.json        # Paper metadata + indexing stats
└── images/              # Extracted images with page-prefixed names
    ├── p1_image_0.jpg
    ├── p5_image_0.jpg
    └── ...
```

### 1.2 Schema Verification

#### detections.json ✅
```typescript
interface PageDetections {
  page_number: number;
  detections: Detection[];
  extracted_images: ExtractedImage[];
}

interface Detection {
  id: string;           // ✅ "p1_title_0", "p2_text_3", etc.
  label: DetectionLabel;
  boxes: BoundingBox[];
  text: string;         // ✅ Actual content (markdown/LaTeX/HTML table)
  metadata?: {
    image_path: string | null;
    latex: string | null;
    table_html: string | null;
    caption: string | null;
    caption_id: string | null;
  };
}
```

#### paper.md ✅
```markdown
<!--ref:p1_title_0-->
# Paper Title

<!--ref:p1_text_0-->
Author names and affiliations...

<!--ref:p1_image_0-->
![](images/0_0.jpg)

<!--ref:p1_image_caption_0-->
<center>Figure 1: Description...</center>
```

#### metadata.json ✅
```json
{
  "arxiv_id": "2601.02346v1",
  "title": "...",
  "authors": [...],
  "abstract": "...",
  "bidirectional_indexing": {
    "detection_ids_count": 284,
    "ref_markers_count": 284,
    "enabled": true
  }
}
```

---

## 2. Implementation Architecture

### 2.1 Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PDF Reader Component                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ detections   │───▶│ Citation     │◀──▶│ AI Service           │  │
│  │ .json        │    │ Index Store  │    │ (with detection IDs) │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                   │                       │               │
│         ▼                   ▼                       ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ PDF Canvas   │    │ Citation     │    │ Insight/Chat Panel   │  │
│  │ Overlay      │◀───│ Highlight    │───▶│ [1][2] markers       │  │
│  │ (boxes)      │    │ Controller   │    │ with hover preview   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| CitationIndexStore | `store/citationStore.ts` | Store detection data, provide lookup |
| CitationHighlightLayer | `components/layers/CitationHighlightLayer.tsx` | Render citation overlays on PDF |
| CitationTag | `components/ui/CitationTag.tsx` | Clickable citation marker [1] |
| AI Service Update | `services/paperAgentService.ts` | Include detection context in prompts |

---

## 3. Implementation Phases

### Phase 1: Citation Index Infrastructure (Priority: Critical)

#### 3.1.1 Create Citation Store

**File**: `src/components/editors/pdf-reader/store/citationStore.ts`

```typescript
import { create } from 'zustand';

interface Detection {
  id: string;
  label: string;
  pageNumber: number;
  boxes: BoundingBox[];
  text: string;
  metadata?: DetectionMetadata;
}

interface CitationState {
  // Index: detection_id -> Detection
  detectionIndex: Map<string, Detection>;
  
  // Page-based grouping for efficient lookup
  pageDetections: Map<number, Detection[]>;
  
  // Currently highlighted citations
  activeCitations: string[];
  
  // Hovered citation (for preview)
  hoveredCitation: string | null;
  
  // Loading state
  isLoaded: boolean;
}

interface CitationActions {
  // Load detections from JSON
  loadDetections: (detections: PageDetections[]) => void;
  
  // Get detection by ID
  getDetection: (id: string) => Detection | undefined;
  
  // Get all detections for a page
  getPageDetections: (pageNumber: number) => Detection[];
  
  // Highlight management
  setActiveCitations: (ids: string[]) => void;
  addActiveCitation: (id: string) => void;
  clearActiveCitations: () => void;
  
  // Hover management
  setHoveredCitation: (id: string | null) => void;
  
  // Navigation
  scrollToDetection: (id: string) => void;
}

export const useCitationStore = create<CitationState & CitationActions>(...);
```

#### 3.1.2 Update Type Definitions

**File**: `src/types/paperContext.ts`

```typescript
// Add new types
export interface Detection {
  id: string;
  label: DetectionLabel;
  boxes: BoundingBox[];
  text: string;
  metadata?: DetectionMetadata;
}

export interface DetectionMetadata {
  image_path?: string | null;
  latex?: string | null;
  table_html?: string | null;
  caption?: string | null;
  caption_id?: string | null;
}

export interface ExtractedImage {
  detection_id: string;
  index: number;
  bbox: BoundingBox;
  width: number;
  height: number;
  image_path: string;
}

export interface PageDetections {
  page_number: number;
  detections: Detection[];
  extracted_images: ExtractedImage[];
}

export interface PaperMetadata {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  total_pages: number;
  total_detections: number;
  bidirectional_indexing: {
    detection_ids_count: number;
    ref_markers_count: number;
    enabled: boolean;
  };
}
```

#### 3.1.3 Load Detections on Paper Open

**File**: `src/components/editors/pdf-reader/index.tsx`

```typescript
// Add to useEffect for paper loading
useEffect(() => {
  if (pdfSource.arxivId) {
    // Load detections.json
    fetch(`/data/output/${pdfSource.arxivId}/detections.json`)
      .then(res => res.json())
      .then(data => {
        useCitationStore.getState().loadDetections(data);
      });
      
    // Load metadata.json  
    fetch(`/data/output/${pdfSource.arxivId}/metadata.json`)
      .then(res => res.json())
      .then(data => {
        // Store paper metadata
      });
  }
}, [pdfSource.arxivId]);
```

---

### Phase 2: Citation Highlight Layer (Priority: High)

#### 3.2.1 Create Citation Highlight Layer

**File**: `src/components/editors/pdf-reader/components/layers/CitationHighlightLayer.tsx`

```typescript
interface CitationHighlightLayerProps {
  pageNumber: number;
  scale: number;
  pageDimensions: { width: number; height: number };
}

export const CitationHighlightLayer: React.FC<CitationHighlightLayerProps> = ({
  pageNumber,
  scale,
  pageDimensions,
}) => {
  const { activeCitations, hoveredCitation, pageDetections } = useCitationStore();
  
  const detections = pageDetections.get(pageNumber) || [];
  
  return (
    <div className="citation-highlight-layer absolute inset-0 pointer-events-none z-30">
      {detections.map(detection => {
        const isActive = activeCitations.includes(detection.id);
        const isHovered = hoveredCitation === detection.id;
        
        if (!isActive && !isHovered) return null;
        
        return detection.boxes.map((box, idx) => (
          <div
            key={`${detection.id}-${idx}`}
            className={cn(
              "absolute border-2 rounded transition-all duration-200",
              isActive && "border-indigo-500 bg-indigo-500/10",
              isHovered && "border-amber-500 bg-amber-500/10"
            )}
            style={{
              left: (box.x1_px / pageDimensions.width) * 100 + '%',
              top: (box.y1_px / pageDimensions.height) * 100 + '%',
              width: ((box.x2_px - box.x1_px) / pageDimensions.width) * 100 + '%',
              height: ((box.y2_px - box.y1_px) / pageDimensions.height) * 100 + '%',
            }}
          />
        ));
      })}
    </div>
  );
};
```

#### 3.2.2 Integrate Layer into PDFRenderer

**File**: `src/components/editors/pdf-reader/components/PDFRenderer.tsx`

```typescript
// Add CitationHighlightLayer to each page
<div className="pdf-page relative">
  <canvas ref={canvasRef} />
  <TextLayer ... />
  <ObjectSelectionLayer ... />
  <CitationHighlightLayer 
    pageNumber={pageNumber}
    scale={scale}
    pageDimensions={pageDimensions}
  />
</div>
```

---

### Phase 3: AI Service with Citations (Priority: High)

#### 3.3.1 Update Paper Agent Service

**File**: `src/components/editors/pdf-reader/services/paperAgentService.ts`

```typescript
interface InsightWithCitations {
  type: InsightType;
  content: string;
  citations: Citation[];
}

interface Citation {
  detection_id: string;
  page_number: number;
  excerpt: string;
  relevance: number;
}

// Update generateInsight to include detection context
async generateInsightWithCitations(
  type: InsightType,
  paperContext: PaperContext,
  detections: Detection[]
): Promise<InsightWithCitations> {
  
  // Build context with detection IDs
  const contextWithIds = this.buildContextWithIds(paperContext, detections);
  
  const prompt = `
${INSIGHT_PROMPTS[type]}

IMPORTANT: When referencing specific content from the paper, include citation markers 
using the format [[detection_id]]. For example: "The paper proposes [[p1_text_2]]..."

Paper content with detection IDs:
${contextWithIds}
`;

  const response = await this.callLLM(prompt);
  
  // Parse citations from response
  const citations = this.parseCitations(response, detections);
  
  return {
    type,
    content: this.formatContentWithCitationNumbers(response, citations),
    citations,
  };
}

// Build context string with detection IDs
private buildContextWithIds(
  paperContext: PaperContext,
  detections: Detection[]
): string {
  return detections
    .filter(d => ['title', 'sub_title', 'text', 'equation'].includes(d.label))
    .map(d => `[${d.id}] ${d.text}`)
    .join('\n\n');
}

// Parse [[detection_id]] markers from response
private parseCitations(response: string, detections: Detection[]): Citation[] {
  const citationRegex = /\[\[(p\d+_\w+_\d+)\]\]/g;
  const citations: Citation[] = [];
  const seen = new Set<string>();
  
  let match;
  while ((match = citationRegex.exec(response)) !== null) {
    const detectionId = match[1];
    if (seen.has(detectionId)) continue;
    seen.add(detectionId);
    
    const detection = detections.find(d => d.id === detectionId);
    if (detection) {
      citations.push({
        detection_id: detectionId,
        page_number: parseInt(detectionId.split('_')[0].slice(1)),
        excerpt: detection.text.slice(0, 100) + '...',
        relevance: 1.0,
      });
    }
  }
  
  return citations;
}
```

#### 3.3.2 Update Insight Store

**File**: `src/components/editors/pdf-reader/store/aiStore.ts`

```typescript
interface Insight {
  id: string;
  type: InsightType;
  content: string;
  isLoading: boolean;
  error?: string;
  
  // NEW: Citations
  citations?: Citation[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  
  // NEW: Citations for assistant messages
  citations?: Citation[];
}
```

---

### Phase 4: Citation UI Components (Priority: Medium)

#### 3.4.1 Create Citation Tag Component

**File**: `src/components/editors/pdf-reader/components/ui/CitationTag.tsx`

```typescript
interface CitationTagProps {
  citation: Citation;
  index: number;
  onClick?: () => void;
}

export const CitationTag: React.FC<CitationTagProps> = ({
  citation,
  index,
  onClick,
}) => {
  const { setHoveredCitation, scrollToDetection } = useCitationStore();
  
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center",
        "w-5 h-5 text-xs font-medium rounded",
        "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
        "transition-colors cursor-pointer"
      )}
      onMouseEnter={() => setHoveredCitation(citation.detection_id)}
      onMouseLeave={() => setHoveredCitation(null)}
      onClick={() => {
        scrollToDetection(citation.detection_id);
        onClick?.();
      }}
      title={`Page ${citation.page_number}: ${citation.excerpt}`}
    >
      {index + 1}
    </button>
  );
};
```

#### 3.4.2 Create Citation Popover

**File**: `src/components/editors/pdf-reader/components/ui/CitationPopover.tsx`

```typescript
interface CitationPopoverProps {
  citation: Citation;
  children: React.ReactNode;
}

export const CitationPopover: React.FC<CitationPopoverProps> = ({
  citation,
  children,
}) => {
  const detection = useCitationStore(s => s.getDetection(citation.detection_id));
  
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="px-1.5 py-0.5 bg-stone-100 rounded">
              Page {citation.page_number}
            </span>
            <span className="capitalize">{detection?.label}</span>
          </div>
          <p className="text-sm text-stone-700 line-clamp-4">
            {detection?.text}
          </p>
          <button
            className="text-xs text-indigo-600 hover:underline"
            onClick={() => useCitationStore.getState().scrollToDetection(citation.detection_id)}
          >
            Jump to source →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
```

#### 3.4.3 Update Quick Insights Panel

**File**: `src/components/editors/pdf-reader/components/ai/QuickInsightsPanel.tsx`

```typescript
// Render insight content with citation tags
const renderContentWithCitations = (insight: Insight) => {
  if (!insight.citations?.length) {
    return <ReactMarkdown>{insight.content}</ReactMarkdown>;
  }
  
  // Replace [[id]] with citation numbers
  let content = insight.content;
  insight.citations.forEach((citation, idx) => {
    content = content.replace(
      new RegExp(`\\[\\[${citation.detection_id}\\]\\]`, 'g'),
      `<citation-${idx}>`
    );
  });
  
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          // Custom renderer for citation markers
          code: ({ children }) => {
            const text = String(children);
            const match = text.match(/^citation-(\d+)$/);
            if (match) {
              const idx = parseInt(match[1]);
              const citation = insight.citations![idx];
              return (
                <CitationPopover citation={citation}>
                  <CitationTag citation={citation} index={idx} />
                </CitationPopover>
              );
            }
            return <code>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
```

---

### Phase 5: Scroll & Navigation (Priority: Medium)

#### 3.5.1 Implement Scroll to Detection

**File**: `src/components/editors/pdf-reader/store/citationStore.ts`

```typescript
scrollToDetection: (id: string) => {
  const detection = get().detectionIndex.get(id);
  if (!detection) return;
  
  const pageNumber = detection.pageNumber;
  
  // Dispatch event for PDF viewer to handle
  window.dispatchEvent(new CustomEvent('pdf-scroll-to-page', {
    detail: { pageNumber, detectionId: id }
  }));
  
  // Highlight the detection temporarily
  set({ activeCitations: [id] });
  
  // Clear highlight after 3 seconds
  setTimeout(() => {
    set(state => ({
      activeCitations: state.activeCitations.filter(c => c !== id)
    }));
  }, 3000);
}
```

#### 3.5.2 Handle Scroll Event in PDF Viewer

**File**: `src/components/editors/pdf-reader/components/PDFRenderer.tsx`

```typescript
useEffect(() => {
  const handleScrollToPage = (e: CustomEvent<{ pageNumber: number; detectionId: string }>) => {
    const { pageNumber, detectionId } = e.detail;
    
    // Scroll to page
    scrollToPage(pageNumber);
    
    // After scroll, highlight the detection box
    setTimeout(() => {
      const detection = useCitationStore.getState().getDetection(detectionId);
      if (detection && detection.boxes[0]) {
        // Optionally scroll to specific position within page
        const box = detection.boxes[0];
        const pageElement = document.querySelector(`[data-page="${pageNumber}"]`);
        if (pageElement) {
          const yOffset = (box.y1_px / pageDimensions.height) * pageElement.clientHeight;
          pageElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 300);
  };
  
  window.addEventListener('pdf-scroll-to-page', handleScrollToPage as EventListener);
  return () => window.removeEventListener('pdf-scroll-to-page', handleScrollToPage as EventListener);
}, []);
```

---

## 4. Task Breakdown & Timeline

### Week 1: Foundation

| Task | Priority | Est. Hours | Status |
|------|----------|------------|--------|
| Create Citation Store | Critical | 4h | ⬜ |
| Update Type Definitions | Critical | 2h | ⬜ |
| Load detections on paper open | Critical | 2h | ⬜ |
| Create CitationHighlightLayer | High | 4h | ⬜ |

### Week 2: AI Integration

| Task | Priority | Est. Hours | Status |
|------|----------|------------|--------|
| Update paperAgentService with citations | High | 6h | ⬜ |
| Update aiStore with citation types | High | 2h | ⬜ |
| Modify prompts to request citations | High | 3h | ⬜ |
| Test citation parsing | High | 2h | ⬜ |

### Week 3: UI Components

| Task | Priority | Est. Hours | Status |
|------|----------|------------|--------|
| Create CitationTag component | Medium | 2h | ⬜ |
| Create CitationPopover component | Medium | 3h | ⬜ |
| Update QuickInsightsPanel | Medium | 4h | ⬜ |
| Update AskPaperChat | Medium | 4h | ⬜ |

### Week 4: Polish & Testing

| Task | Priority | Est. Hours | Status |
|------|----------|------------|--------|
| Implement scroll navigation | Medium | 4h | ⬜ |
| Add highlight animations | Low | 2h | ⬜ |
| Cross-browser testing | Medium | 4h | ⬜ |
| Performance optimization | Medium | 4h | ⬜ |

---

## 5. API Changes Summary

### 5.1 New Store: `citationStore.ts`

```typescript
// Exports
export const useCitationStore: UseBoundStore<CitationState & CitationActions>;
```

### 5.2 Updated Store: `aiStore.ts`

```typescript
// New fields in Insight
interface Insight {
  citations?: Citation[];
}

// New fields in ChatMessage
interface ChatMessage {
  citations?: Citation[];
}
```

### 5.3 New Components

| Component | Path | Props |
|-----------|------|-------|
| CitationHighlightLayer | `layers/CitationHighlightLayer.tsx` | pageNumber, scale, pageDimensions |
| CitationTag | `ui/CitationTag.tsx` | citation, index, onClick |
| CitationPopover | `ui/CitationPopover.tsx` | citation, children |

### 5.4 Service Updates

```typescript
// paperAgentService.ts
generateInsightWithCitations(type, paperContext, detections): Promise<InsightWithCitations>
generateChatResponseWithCitations(messages, paperContext, detections): Promise<ChatResponseWithCitations>
```

---

## 6. Testing Checklist

### 6.1 Unit Tests

- [ ] Citation store: load, query, update operations
- [ ] Citation parsing from AI response
- [ ] Detection ID format validation

### 6.2 Integration Tests

- [ ] Load detections.json on paper open
- [ ] Citation highlights appear on correct page/position
- [ ] Click citation → scroll to source
- [ ] Hover citation → preview popover

### 6.3 E2E Tests

- [ ] Generate insight → citations displayed → click → PDF scrolls
- [ ] Ask question → response with citations → verify sources

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM doesn't return citation IDs | High | Fallback to text matching, add few-shot examples |
| Performance with many detections | Medium | Virtualize highlight layer, lazy load |
| Coordinate mismatch (px vs normalized) | High | Use px coordinates consistently |
| Missing detections for some content | Medium | Graceful degradation, show warning |

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Citation accuracy | >90% citations link to correct source |
| Interaction latency | <200ms for highlight/scroll |
| Coverage | >80% of AI-generated content has citations |
| User engagement | Track citation clicks per session |

---

*Document Version: 1.0*  
*Created: 2026-01-06*  
*Author: PISA-OS Frontend Team*
