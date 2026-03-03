---
name: theorem-proving
description: Construct and verify mathematical proofs using LaTeX typesetting and computational verification via jupyter_execute
---

# Theorem Proving Skill

## Description
Assist with constructing, verifying, and typesetting mathematical proofs. Combines rigorous logical reasoning with computational verification.

## Tools Used
- `latex_compile` - Typeset proofs and mathematical documents (auto-switches to LaTeX editor)
- `update_latex` - Write LaTeX content to the editor for review before compiling
- `jupyter_execute` - Verify results computationally (sympy, numpy)
- `update_notes` - Write proof outlines and scratch work to Notes editor

## Capabilities

### Proof Construction
- Direct proofs, proof by contradiction, proof by induction
- Constructive and non-constructive existence proofs
- Epsilon-delta arguments in analysis
- Diagram chasing in algebra/category theory

### Verification
- Symbolic computation to check algebraic manipulations
- Numerical examples to build intuition
- Counterexample search for false conjectures
- Automated checking of special cases

### Typesetting
- AMS theorem environments (theorem, lemma, proposition, corollary, definition)
- Proper mathematical notation and spacing
- Cross-references and equation numbering
- Multi-part proofs with clear structure

## Usage Patterns

### Prove a Theorem
When user says: "Prove that [statement]"
1. Clarify definitions and assumptions
2. Outline proof strategy
3. Construct formal proof step-by-step
4. Verify key steps computationally if possible
5. Typeset in LaTeX with proper environments

### Verify a Conjecture
When user says: "Is it true that [conjecture]?"
1. Test with specific examples (jupyter_execute)
2. Search for counterexamples
3. Attempt proof if examples support it
4. Report findings with confidence level
