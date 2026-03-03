---
name: peer-review
description: Conduct thorough academic peer reviews with structured feedback using load_pdf and arxiv_to_prompt
---

# Peer Review Skill

## Description
Conduct thorough academic peer reviews with structured, constructive feedback.

## Tools Used
- `load_pdf` - Load PDF papers in the workspace viewer (auto-switches to PDF reader)
- `arxiv_to_prompt` - Convert arXiv papers to readable text for analysis
- `update_notes` - Write review reports to the Notes editor

## Capabilities

### Paper Analysis
- Extract and summarize main contributions
- Identify methodology and approach
- Evaluate experimental design
- Assess writing quality

### Comparative Analysis
- Find related prior work
- Identify novelty claims
- Check citation completeness
- Verify originality

### Feedback Generation
- Structured review reports
- Specific, actionable comments
- Line-by-line annotations
- Summary recommendations

## Review Process

### Phase 1: Initial Read
1. Read abstract and introduction
2. Understand claimed contributions
3. Skim methodology and results
4. Form initial impression

### Phase 2: Detailed Analysis
1. Carefully read methodology
2. Evaluate experimental design
3. Check result validity
4. Assess reproducibility

### Phase 3: Comparative Check
1. Search for related work
2. Verify novelty claims
3. Check citation coverage
4. Identify missing references

### Phase 4: Report Writing
1. Summarize paper
2. List strengths
3. Detail weaknesses
4. Provide recommendations

## Feedback Templates

### Major Issue
```
[MAJOR] Section X, Page Y
Issue: [Clear description]
Impact: [Why this matters]
Suggestion: [How to address]
```

### Minor Issue
```
[MINOR] Section X
Observation: [Description]
Suggestion: [Improvement]
```

### Question
```
[QUESTION] Section X
The authors claim [X]. Could you clarify:
- [Specific question]
- [Related concern]
```

## Review Report Structure

```markdown
# Paper Review: [Title]

## Summary
[2-3 sentence overview]

## Strengths
1. [Strength with explanation]
2. [Strength with explanation]

## Weaknesses
### Major Issues
1. [Issue with suggestion]

### Minor Issues
1. [Issue with suggestion]

## Questions for Authors
1. [Question]

## Detailed Comments
[Section-by-section feedback]

## Recommendation
[ ] Accept
[ ] Minor Revision
[ ] Major Revision
[ ] Reject

Confidence: [1-5]
```

## Best Practices

1. **Be Constructive**: Focus on improvement, not criticism
2. **Be Specific**: Point to exact locations and issues
3. **Be Fair**: Acknowledge strengths before weaknesses
4. **Be Thorough**: Cover all major aspects
5. **Be Timely**: Complete reviews within deadlines
