/**
 * ViT Survey — LaTeX Content for Demo Scenario 1
 *
 * Complete Vision Transformer survey article in LaTeX format.
 * Injected into LatexEditorPreview via demo:updateLatex event.
 *
 * Note: All LaTeX backslashes are escaped (\\) for JS string literals.
 */

export const VIT_SURVEY_LATEX = `\\documentclass[11pt,a4paper]{article}

% ============================================================
% Packages
% ============================================================
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{authblk}
\\usepackage{abstract}
\\usepackage{enumitem}

% ============================================================
% Title
% ============================================================
\\title{\\textbf{Vision Transformer: A Comprehensive Survey}}
\\author[1]{Research Agent}
\\author[1]{Prismer.AI}
\\affil[1]{Prismer Academic Research Platform}
\\date{\\today}

\\begin{document}
\\maketitle

% ============================================================
% Abstract
% ============================================================
\\begin{abstract}
Transformers, originally designed for natural language processing, have recently achieved remarkable success in computer vision tasks. This survey provides a comprehensive overview of Vision Transformers (ViTs), covering their architectural foundations, key variants, training strategies, and applications. We systematically review the evolution from the original ViT to advanced architectures including DeiT, Swin Transformer, CvT, and PVT. We analyze the self-attention mechanism, positional encoding strategies, and efficiency improvements. Finally, we discuss open challenges and future research directions in this rapidly evolving field.
\\end{abstract}

\\textbf{Keywords:} Vision Transformer, Self-Attention, Image Classification, Object Detection, Transfer Learning

% ============================================================
% 1. Introduction
% ============================================================
\\section{Introduction}

The Transformer architecture \\cite{vaswani2017attention} has fundamentally transformed natural language processing (NLP) through its self-attention mechanism. In 2020, Dosovitskiy et al. \\cite{dosovitskiy2020image} demonstrated that a pure Transformer applied directly to sequences of image patches can achieve state-of-the-art performance on image classification benchmarks, giving rise to the Vision Transformer (ViT).

Unlike convolutional neural networks (CNNs) that process images through local receptive fields, ViTs treat an image as a sequence of patches and model global dependencies from the very first layer. This paradigm shift has led to an explosion of research exploring Transformer-based architectures for various computer vision tasks.

The key contributions of this survey are:
\\begin{itemize}[noitemsep]
    \\item A systematic taxonomy of Vision Transformer architectures
    \\item Analysis of the self-attention mechanism in the visual domain
    \\item Comparison of training strategies and data efficiency techniques
    \\item Review of applications across classification, detection, and segmentation
\\end{itemize}

% ============================================================
% 2. Architectural Foundations
% ============================================================
\\section{Architectural Foundations}

\\subsection{Patch Embedding}

Given an input image $\\mathbf{x} \\in \\mathbb{R}^{H \\times W \\times C}$, ViT reshapes it into a sequence of flattened 2D patches $\\mathbf{x}_p \\in \\mathbb{R}^{N \\times (P^2 \\cdot C)}$, where $(H, W)$ is the resolution, $C$ is the number of channels, $P$ is the patch size, and $N = HW/P^2$ is the number of patches.

Each patch is linearly projected to a $D$-dimensional embedding:
\\begin{equation}
    \\mathbf{z}_0 = [\\mathbf{x}_\\text{class}; \\, \\mathbf{x}_p^1 \\mathbf{E}; \\, \\mathbf{x}_p^2 \\mathbf{E}; \\, \\cdots; \\, \\mathbf{x}_p^N \\mathbf{E}] + \\mathbf{E}_\\text{pos}
\\end{equation}
where $\\mathbf{E} \\in \\mathbb{R}^{(P^2 \\cdot C) \\times D}$ is the patch embedding projection and $\\mathbf{E}_\\text{pos} \\in \\mathbb{R}^{(N+1) \\times D}$ are learnable position embeddings.

\\subsection{Multi-Head Self-Attention (MHSA)}

The core of the Transformer is the multi-head self-attention mechanism. For each head $h$, the attention is computed as:
\\begin{equation}
    \\text{Attention}(\\mathbf{Q}, \\mathbf{K}, \\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^\\top}{\\sqrt{d_k}}\\right)\\mathbf{V}
\\end{equation}
where $\\mathbf{Q} = \\mathbf{z}\\mathbf{W}_Q$, $\\mathbf{K} = \\mathbf{z}\\mathbf{W}_K$, $\\mathbf{V} = \\mathbf{z}\\mathbf{W}_V$ are the query, key, and value projections, and $d_k = D/h$ is the dimension per head.

The multi-head attention concatenates $h$ attention heads:
\\begin{equation}
    \\text{MHSA}(\\mathbf{z}) = \\text{Concat}(\\text{head}_1, \\ldots, \\text{head}_h)\\mathbf{W}_O
\\end{equation}

\\subsection{Transformer Encoder Block}

Each Transformer encoder block consists of MHSA and a feed-forward network (FFN) with residual connections and layer normalization:
\\begin{align}
    \\mathbf{z}'_l &= \\text{MHSA}(\\text{LN}(\\mathbf{z}_{l-1})) + \\mathbf{z}_{l-1} \\\\
    \\mathbf{z}_l &= \\text{FFN}(\\text{LN}(\\mathbf{z}'_l)) + \\mathbf{z}'_l
\\end{align}
where $\\text{FFN}(\\mathbf{z}) = \\text{GELU}(\\mathbf{z}\\mathbf{W}_1 + \\mathbf{b}_1)\\mathbf{W}_2 + \\mathbf{b}_2$.

% ============================================================
% 3. Key Variants
% ============================================================
\\section{Key Variants}

\\subsection{DeiT: Data-efficient Image Transformers}

Touvron et al. \\cite{touvron2021training} proposed DeiT, which introduced a distillation token and improved training recipes to train ViTs on ImageNet-1K \\emph{without} external data. Key innovations include:
\\begin{itemize}[noitemsep]
    \\item Strong data augmentation (RandAugment, Mixup, CutMix)
    \\item Knowledge distillation from a CNN teacher (RegNet)
    \\item Distillation token appended alongside the class token
\\end{itemize}

DeiT-B achieves 83.1\\% top-1 accuracy on ImageNet with only ImageNet-1K training data.

\\subsection{Swin Transformer}

Liu et al. \\cite{liu2021swin} proposed the Swin Transformer with a hierarchical architecture using shifted windows:

\\begin{itemize}[noitemsep]
    \\item \\textbf{Hierarchical feature maps}: Patch merging reduces spatial resolution progressively (like CNN feature pyramids)
    \\item \\textbf{Window attention}: Self-attention computed within local windows of size $M \\times M$
    \\item \\textbf{Shifted windows}: Alternating between regular and shifted window partitions for cross-window connections
\\end{itemize}

The computational complexity of window attention is $O(M^2 \\cdot N)$ compared to $O(N^2)$ for global attention, making it practical for high-resolution inputs.

\\subsection{CvT: Convolutional Vision Transformer}

Wu et al. \\cite{wu2021cvt} introduced convolutional operations into the Transformer:
\\begin{itemize}[noitemsep]
    \\item Convolutional Token Embedding replaces linear projection
    \\item Convolutional Projection for Q, K, V generation (depthwise separable convolution)
    \\item Removes positional encoding by leveraging convolution's inherent position sensitivity
\\end{itemize}

\\subsection{PVT: Pyramid Vision Transformer}

Wang et al. \\cite{wang2021pyramid} proposed PVT with a progressive shrinking strategy:
\\begin{itemize}[noitemsep]
    \\item Spatial Reduction Attention (SRA) reduces K, V dimensions
    \\item Multi-scale feature maps for dense prediction tasks
    \\item PVTv2 improved with overlapping patch embedding and convolutional FFN
\\end{itemize}

% ============================================================
% 4. Comparison
% ============================================================
\\section{Performance Comparison}

Table~\\ref{tab:comparison} summarizes the performance of key ViT variants on ImageNet-1K.

\\begin{table}[h]
\\centering
\\caption{Comparison of Vision Transformer variants on ImageNet-1K validation set.}
\\label{tab:comparison}
\\begin{tabular}{@{}lcccc@{}}
\\toprule
\\textbf{Model} & \\textbf{Params (M)} & \\textbf{FLOPs (G)} & \\textbf{Top-1 (\\%)} & \\textbf{Resolution} \\\\
\\midrule
ViT-B/16      & 86   & 17.6 & 77.9 & $224^2$ \\\\
ViT-L/16      & 307  & 61.6 & 76.5 & $224^2$ \\\\
DeiT-B        & 86   & 17.6 & 81.8 & $224^2$ \\\\
DeiT-B $\\uparrow$384 & 86 & 55.5 & 83.1 & $384^2$ \\\\
Swin-T        & 29   & 4.5  & 81.3 & $224^2$ \\\\
Swin-S        & 50   & 8.7  & 83.0 & $224^2$ \\\\
Swin-B        & 88   & 15.4 & 83.5 & $224^2$ \\\\
CvT-13        & 20   & 4.5  & 81.6 & $224^2$ \\\\
CvT-21        & 32   & 7.1  & 82.5 & $224^2$ \\\\
PVT-Large     & 61   & 9.8  & 81.7 & $224^2$ \\\\
PVTv2-B5      & 82   & 11.8 & 83.8 & $224^2$ \\\\
\\bottomrule
\\end{tabular}
\\end{table}

% ============================================================
% 5. Applications
% ============================================================
\\section{Applications}

\\subsection{Object Detection}

DETR \\cite{carion2020end} pioneered Transformer-based object detection by formulating it as a set prediction problem. Subsequent works like Deformable DETR, DAB-DETR, and DINO improved upon the original design with deformable attention and improved query initialization. Swin Transformer and PVT serve as powerful backbones for Faster R-CNN and Cascade R-CNN frameworks.

\\subsection{Semantic Segmentation}

SegFormer \\cite{xie2021segformer} proposed an efficient Transformer encoder with a lightweight MLP decoder. SETR uses ViT as a backbone with progressive upsampling. Mask2Former unifies instance, semantic, and panoptic segmentation with masked attention.

\\subsection{Image Generation}

Vision Transformers have also been adopted in generative models. DiT (Diffusion Transformer) replaces U-Net with a Transformer backbone in diffusion models, achieving state-of-the-art FID scores on class-conditional ImageNet generation.

% ============================================================
% 6. Conclusion
% ============================================================
\\section{Conclusion}

Vision Transformers have emerged as a powerful alternative to CNNs across a wide range of computer vision tasks. The key advantages include global receptive fields, flexible architectures, and strong scalability. Current research trends include:

\\begin{enumerate}[noitemsep]
    \\item \\textbf{Efficiency}: Linear attention, pruning, and quantization for deployment
    \\item \\textbf{Hybrid architectures}: Combining convolutions with self-attention
    \\item \\textbf{Self-supervised pre-training}: MAE, BEiT, DINO for label-efficient learning
    \\item \\textbf{Multimodal fusion}: CLIP, Florence for vision-language understanding
\\end{enumerate}

As the field continues to evolve rapidly, we anticipate further innovations in architecture design, training methodologies, and real-world applications.

% ============================================================
% References
% ============================================================
\\begin{thebibliography}{99}
\\bibitem{vaswani2017attention} Vaswani, A., et al. \`\`Attention is all you need.'' \\textit{NeurIPS}, 2017.
\\bibitem{dosovitskiy2020image} Dosovitskiy, A., et al. \`\`An image is worth 16x16 words: Transformers for image recognition at scale.'' \\textit{ICLR}, 2021.
\\bibitem{touvron2021training} Touvron, H., et al. \`\`Training data-efficient image transformers \\& distillation through attention.'' \\textit{ICML}, 2021.
\\bibitem{liu2021swin} Liu, Z., et al. \`\`Swin Transformer: Hierarchical vision transformer using shifted windows.'' \\textit{ICCV}, 2021.
\\bibitem{wu2021cvt} Wu, H., et al. \`\`CvT: Introducing convolutions to vision transformers.'' \\textit{ICCV}, 2021.
\\bibitem{wang2021pyramid} Wang, W., et al. \`\`Pyramid vision transformer: A versatile backbone for dense prediction without convolutions.'' \\textit{ICCV}, 2021.
\\bibitem{carion2020end} Carion, N., et al. \`\`End-to-end object detection with transformers.'' \\textit{ECCV}, 2020.
\\bibitem{xie2021segformer} Xie, E., et al. \`\`SegFormer: Simple and efficient design for semantic segmentation with transformers.'' \\textit{NeurIPS}, 2021.
\\end{thebibliography}

\\end{document}`;
