# OCR Service Bidirectional Indexing Requirements

## 1. Overview

This document specifies the minimal schema updates required for the OCR service to support **paragraph-level bidirectional mapping** between AI-generated content (Quick Insights, Q&A) and PDF source locations.

### 1.1 Goal

Enable users to:
1. **Forward Link**: Click on AI-generated content → highlight corresponding source location in PDF
2. **Backward Link**: Click on PDF content → see related AI-generated insights/answers

### 1.2 Current State Analysis

**`detections.json`** - Current Structure:
```json
{
  "page_number": 1,
  "detections": [
    {
      "label": "title" | "text" | "sub_title" | "image" | "table" | "equation" | ...,
      "boxes": [{ "x1": 305, "y1": 140, "x2": 692, "y2": 171, "x1_px": 373, "y1_px": 221, "x2_px": 847, "y2_px": 271 }],
      "raw_text": "<|ref|>title<|/ref|><|det|>[[305, 140, 692, 171]]<|/det|>"
    }
  ]
}
```

**`ocr_result.json`** - Current Structure:
```json
{
  "success": true,
  "total_pages": 34,
  "markdown_content": "...",
  "pages": [
    {
      "page_number": 1,
      "content": "# Title\n\nParagraph text...",
      "meta": { "width": 1224, "height": 1584, "dpi": 144 },
      "detection_count": 8,
      "image_count": 1
    }
  ]
}
```

### 1.3 Current Limitations

| Issue | Description |
|-------|-------------|
| No Unique IDs | Detections lack unique identifiers for reference |
| No Text Content | Detections don't include actual OCR text (only reference format) |
| No Cross-Reference | Markdown content has no link back to detection boxes |
| No Semantic Grouping | Related text blocks aren't grouped into logical paragraphs |

---

## 2. Proposed Schema Updates

### 2.1 Detection Schema Enhancement

Add unique `id` and `text` fields to each detection:

```typescript
interface Detection {
  // NEW: Unique identifier for this detection
  id: string;  // Format: "p{page}_{type}_{index}" e.g., "p1_text_3"
  
  // EXISTING
  label: DetectionLabel;
  boxes: BoundingBox[];
  raw_text: string;
  
  // NEW: Actual OCR text content
  text: string;
  
  // NEW (optional): For images/tables/equations, additional metadata
  metadata?: {
    image_path?: string;      // For figures: "images/0_0.jpg"
    latex?: string;           // For equations: LaTeX representation
    table_html?: string;      // For tables: HTML table structure
    caption?: string;         // Figure/table caption if detected separately
    caption_id?: string;      // Reference to caption detection ID
  };
}

type DetectionLabel = 
  | 'title' 
  | 'sub_title' 
  | 'text' 
  | 'image' 
  | 'image_caption'
  | 'table' 
  | 'table_caption'
  | 'equation'
  | 'reference'
  | 'footer'
  | 'header'
  | 'figure'
  | 'chart'
  | 'diagram';

interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x1_px: number;
  y1_px: number;
  x2_px: number;
  y2_px: number;
}
```

**Example Updated Detection:**
```json
{
  "id": "p1_title_0",
  "label": "title",
  "boxes": [{ "x1": 305, "y1": 140, "x2": 692, "y2": 171, "x1_px": 373, "y1_px": 221, "x2_px": 847, "y2_px": 271 }],
  "raw_text": "<|ref|>title<|/ref|><|det|>[[305, 140, 692, 171]]<|/det|>",
  "text": "Web World Models"
}
```

### 2.2 OCR Result Schema Enhancement

Option A: **Inline Reference Markers** (Recommended - Minimal Change)

Embed detection IDs directly in markdown content using HTML comments:

```markdown
<!--ref:p1_title_0-->
# Web World Models

<!--ref:p1_text_0-->
Jichen Feng, Yifan Zhang, Chenggong Zhang...

<!--ref:p1_text_1-->
Language agents increasingly require persistent worlds...

<!--ref:p1_image_0-->
![](images/0_0.jpg)

<!--ref:p1_image_caption_0-->
<center>Figure 1: Left: Traditional Web Frameworks...</center>
```

Option B: **Structured Content Array** (More Structured)

Add a `structured_content` array that maps content blocks to detection IDs:

```typescript
interface OCRPage {
  page_number: number;
  content: string;  // Keep existing markdown
  meta: PageMeta;
  
  // NEW: Structured mapping
  structured_content: ContentBlock[];
}

interface ContentBlock {
  detection_id: string;          // Reference to detection in detections.json
  type: DetectionLabel;
  text: string;                  // Text content
  markdown: string;              // Markdown representation
  
  // Character offsets in the page.content string
  content_offset?: {
    start: number;
    end: number;
  };
}
```

**Example:**
```json
{
  "page_number": 1,
  "content": "# Web World Models\n\nJichen Feng...",
  "meta": { "width": 1224, "height": 1584, "dpi": 144 },
  "structured_content": [
    {
      "detection_id": "p1_title_0",
      "type": "title",
      "text": "Web World Models",
      "markdown": "# Web World Models",
      "content_offset": { "start": 0, "end": 18 }
    },
    {
      "detection_id": "p1_text_0",
      "type": "text",
      "text": "Jichen Feng, Yifan Zhang...",
      "markdown": "Jichen Feng, Yifan Zhang...",
      "content_offset": { "start": 20, "end": 150 }
    }
  ]
}
```

### 2.3 Recommendation: Option A (Inline References)

**Rationale:**
- Minimal change to existing pipeline
- Markdown remains human-readable
- Easy to parse with regex: `<!--ref:(p\d+_\w+_\d+)-->`
- Backward compatible (parsers can ignore comments)

---

## 3. ID Generation Specification

### 3.1 ID Format

```
{page_prefix}_{type}_{sequence_index}
```

| Component | Description | Example |
|-----------|-------------|---------|
| `page_prefix` | Page identifier | `p1`, `p2`, `p34` |
| `type` | Detection label (normalized) | `title`, `text`, `image`, `table`, `equation` |
| `sequence_index` | Zero-based index within page+type | `0`, `1`, `2` |

### 3.2 Examples

| Detection | Generated ID |
|-----------|--------------|
| First title on page 1 | `p1_title_0` |
| Third text block on page 2 | `p2_text_2` |
| First equation on page 5 | `p5_equation_0` |
| Second image on page 3 | `p3_image_1` |

### 3.3 ID Stability

IDs must be **deterministic** based on:
1. Page number
2. Detection label
3. Top-to-bottom, left-to-right ordering

This ensures the same PDF always produces the same IDs.

---

## 4. Semantic Grouping (Optional Enhancement)

### 4.1 Paragraph Grouping

For better semantic understanding, group related detections:

```typescript
interface SemanticGroup {
  group_id: string;           // e.g., "section_2_1"
  type: 'section' | 'paragraph' | 'figure_group' | 'table_group';
  detection_ids: string[];    // ["p4_sub_title_0", "p4_text_0", "p4_text_1"]
  
  // Optional: Hierarchical structure
  parent_group_id?: string;
  heading?: string;
}
```

### 4.2 Example Section Grouping

```json
{
  "semantic_groups": [
    {
      "group_id": "section_1",
      "type": "section",
      "heading": "Introduction",
      "detection_ids": ["p2_sub_title_0", "p2_text_0", "p2_text_1", "p2_text_2", "p2_image_0"]
    },
    {
      "group_id": "figure_1",
      "type": "figure_group", 
      "detection_ids": ["p1_image_0", "p1_image_caption_0"],
      "parent_group_id": "section_1"
    }
  ]
}
```

---

## 5. Frontend Integration Specification

### 5.1 Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Generated   │────▶│  Citation Tags   │────▶│  PDF Highlight  │
│    Content      │     │  [p1_text_0]     │     │  Jump to Page 1 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Detection Boxes │
                        │  Overlay Render  │
                        └──────────────────┘
```

### 5.2 Citation Format in AI Responses

AI service should return citations in responses:

```typescript
interface AIResponse {
  content: string;  // Markdown content
  citations: Citation[];
}

interface Citation {
  detection_id: string;      // "p1_text_0"
  page_number: number;       // 1
  excerpt: string;           // Brief excerpt from source
  relevance: number;         // 0-1 confidence score
}
```

**Example AI Response:**
```json
{
  "content": "The paper introduces **Web World Models (WWM)** [1], a hybrid approach that combines deterministic code with LLM-generated content [2].",
  "citations": [
    {
      "detection_id": "p1_title_0",
      "page_number": 1,
      "excerpt": "Web World Models",
      "relevance": 1.0
    },
    {
      "detection_id": "p1_text_3",
      "page_number": 1,
      "excerpt": "world state and 'physics' are implemented in ordinary web code...",
      "relevance": 0.95
    }
  ]
}
```

### 5.3 Frontend Store Updates

```typescript
// aiStore.ts additions
interface AIState {
  // ... existing state
  
  // NEW: Active citation highlights
  activeCitations: string[];  // detection_ids currently highlighted
  
  // NEW: Citation index for quick lookup
  citationIndex: Map<string, {
    pageNumber: number;
    boxes: BoundingBox[];
    text: string;
  }>;
}

interface AIActions {
  // ... existing actions
  
  // NEW: Citation management
  highlightCitation: (detectionId: string) => void;
  clearCitationHighlights: () => void;
  scrollToCitation: (detectionId: string) => void;
}
```

---

## 6. Implementation Priority

### Phase 1: Core Infrastructure (Required)

| Task | Description | Effort |
|------|-------------|--------|
| Add detection IDs | Add `id` field to all detections | Low |
| Add text content | Add `text` field with OCR content | Low |
| Inline references | Add `<!--ref:id-->` markers in markdown | Medium |

### Phase 2: AI Integration (Required)

| Task | Description | Effort |
|------|-------------|--------|
| Prompt engineering | Include detection IDs in AI context | Medium |
| Citation parsing | Parse AI response citations | Low |
| Frontend highlights | Render citation overlays | Medium |

### Phase 3: Enhancements (Optional)

| Task | Description | Effort |
|------|-------------|--------|
| Semantic grouping | Group detections into sections | High |
| Confidence scores | Add citation relevance scores | Medium |
| Cross-page linking | Handle citations spanning pages | Medium |

---

## 7. API Contract Summary

### 7.1 Updated `detections.json` Schema

```json
{
  "page_number": 1,
  "detections": [
    {
      "id": "p1_title_0",
      "label": "title",
      "boxes": [...],
      "raw_text": "...",
      "text": "Web World Models"
    },
    {
      "id": "p1_text_0",
      "label": "text",
      "boxes": [...],
      "raw_text": "...",
      "text": "Language agents increasingly require..."
    },
    {
      "id": "p1_image_0",
      "label": "image",
      "boxes": [...],
      "raw_text": "...",
      "text": "",
      "metadata": {
        "image_path": "images/0_0.jpg",
        "caption": "Figure 1: Traditional Web Frameworks...",
        "caption_id": "p1_image_caption_0"
      }
    }
  ]
}
```

### 7.2 Updated `ocr_result.json` Markdown

```markdown
<!--ref:p1_title_0-->
# Web World Models

<!--ref:p1_text_0-->
Jichen Feng \(^{*1,3}\) Yifan Zhang \(^{*1}\)...

<!--ref:p1_text_1-->
Language agents increasingly require persistent worlds...

<!--ref:p1_image_0-->
![](images/0_0.jpg)

<!--ref:p1_image_caption_0-->
<center>Figure 1: Left: Traditional Web Frameworks...</center>
```

---

## 8. Acceptance Criteria

1. ✅ Every detection has a unique, deterministic `id`
2. ✅ Every text-based detection includes `text` field with actual content
3. ✅ Markdown content includes `<!--ref:id-->` markers before each block
4. ✅ Image/table/equation detections include relevant `metadata`
5. ✅ IDs are stable across re-processing of the same PDF
6. ✅ Backward compatible with existing parsing logic

---

## 9. Questions for OCR Service Team

1. **Text Extraction**: Is the OCR text already available internally before markdown generation?
2. **Processing Order**: Can we guarantee consistent top-to-bottom, left-to-right ordering?
3. **Image Metadata**: Is `image_path` already tracked for figure detections?
4. **Equation LaTeX**: Is LaTeX representation available for equation detections?
5. **Caption Linking**: Can captions be automatically linked to their parent figures/tables?

---

*Document Version: 1.0*  
*Last Updated: 2026-01-05*  
*Author: PISA-OS Frontend Team*
