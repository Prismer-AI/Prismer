---
name: paper-search
description: Search and discover academic papers from arXiv and web sources using arxiv_to_prompt and web search
---

# Paper Search Skill

## Description
Search and discover academic papers from various databases and repositories.

## Tools Used
- `arxiv_to_prompt` - Convert arXiv papers to LLM-readable text (search by arXiv ID)
- `load_pdf` - Load PDF papers in the workspace viewer
- Web search is available as a built-in agent capability

## Capabilities

### Search Academic Databases
- arXiv (preprints in physics, math, CS, etc.)
- Semantic Scholar (comprehensive academic search)
- Google Scholar (broad academic coverage)
- PubMed (biomedical literature)

### Retrieve Paper Information
- Title, authors, abstract
- Publication venue and date
- Citation count and references
- Download links (when available)

### Organize Results
- Filter by date, citation count, relevance
- Group by topic or author
- Export to reference managers

## Usage Patterns

### Basic Search
When user says: "Find papers about transformer architectures"
1. Formulate search query
2. Search primary databases (arXiv, Semantic Scholar)
3. Collect top results with metadata
4. Present organized list with key information

### Specific Author Search
When user says: "Find recent papers by [Author Name]"
1. Search by author name
2. Filter by publication date
3. Show papers with co-authors and venues

### Citation Search
When user says: "Find papers that cite [Paper Title]"
1. Identify the source paper
2. Search for citing papers
3. Organize by recency and relevance

### Related Work Search
When user says: "Find related work for this topic"
1. Identify key concepts and terms
2. Search across multiple databases
3. Categorize by methodology or approach
4. Highlight highly cited foundational papers

## Output Format

### Single Paper Result
```
Title: [Paper Title]
Authors: [Author List]
Year: [Publication Year]
Venue: [Journal/Conference]
Abstract: [First 200 words...]
Citations: [Count]
Link: [URL]
```

### Search Results Summary
```
Found [N] relevant papers:

Top Results:
1. [Title] ([Year]) - [Citation Count] citations
2. [Title] ([Year]) - [Citation Count] citations
...

Would you like me to:
- Show detailed abstracts?
- Filter by specific criteria?
- Export to BibTeX?
```

## Best Practices

1. **Query Refinement**: Start broad, then narrow down
2. **Multiple Sources**: Cross-reference across databases
3. **Citation Awareness**: Note highly-cited foundational works
4. **Recency Balance**: Mix recent and seminal papers
5. **Relevance Check**: Verify papers match research goals
