---
name: ml-experiment
description: Design and run machine learning experiments with proper evaluation using jupyter_execute, including training, benchmarking, and ablation studies
---

# ML Experiment Skill

## Description
Design, implement, and evaluate machine learning experiments with reproducible workflows, proper baselines, and statistical analysis.

## Tools Used
- `jupyter_execute` - Execute ML code in Python (auto-switches to Jupyter)
- `jupyter_notebook` - Manage experiment notebooks
- `update_notebook` - Set up experiment cells
- `update_latex` - Write experiment results to papers
- `latex_compile` - Compile CS conference papers (auto-switches to LaTeX)
- `arxiv_to_prompt` - Read related work from arXiv papers
- `update_notes` - Write experiment logs and analysis summaries

## Capabilities

### Experiment Design
- Proper train/validation/test splits
- Cross-validation and bootstrap confidence intervals
- Ablation study design
- Hyperparameter search (grid, random, Bayesian)

### Implementation
- PyTorch and TensorFlow model building
- Data loading and augmentation pipelines
- Training loops with logging and checkpointing
- Distributed training setup

### Evaluation
- Standard metrics per task (accuracy, F1, BLEU, mAP, etc.)
- Statistical significance testing (paired t-test, bootstrap)
- Comparison with baselines
- Error analysis and visualization

## Usage Patterns

### Run an Experiment
When user says: "Train a model for [task]"
1. Clarify dataset, metrics, and baselines
2. Implement data loading and preprocessing
3. Build model architecture
4. Train with proper logging
5. Evaluate and compare to baselines
6. Report results with confidence intervals

### Reproduce a Paper
When user says: "Reproduce [paper title/arXiv ID]"
1. Fetch paper using arxiv_to_prompt
2. Extract key method details
3. Implement core algorithm
4. Run experiments matching paper setup
5. Compare results to reported numbers
