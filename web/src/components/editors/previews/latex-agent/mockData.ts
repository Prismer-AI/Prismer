/**
 * Mock Data Service for LaTeX Agent
 * 
 * Provides simulated AI agent responses for demonstration purposes.
 * Content focused on Swin Transformer and Vision Transformer research.
 */

import type { AgentAction, PaperReference, StreamEvent } from './types';

// Swin Transformer related paper references
export const mockPapers: PaperReference[] = [
  {
    id: 'arxiv-2103.14030',
    title: 'Swin Transformer: Hierarchical Vision Transformer using Shifted Windows',
    authors: ['Ze Liu', 'Yutong Lin', 'Yue Cao', 'Han Hu', 'Yixuan Wei', 'Zheng Zhang', 'Stephen Lin', 'Baining Guo'],
    year: 2021,
    abstract: 'This paper presents a new vision Transformer, called Swin Transformer, that capably serves as a general-purpose backbone for computer vision. Challenges in adapting Transformer from language to vision arise from differences between the two domains, such as large variations in the scale of visual entities and the high resolution of pixels in images compared to words in text.',
    doi: '10.48550/arXiv.2103.14030',
    citations: 18542,
    source: 'arxiv',
  },
  {
    id: 'arxiv-2010.11929',
    title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
    authors: ['Alexey Dosovitskiy', 'Lucas Beyer', 'Alexander Kolesnikov', 'Dirk Weissenborn', 'Xiaohua Zhai'],
    year: 2021,
    abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. We show that a pure transformer applied directly to sequences of image patches can perform very well on image classification tasks.',
    doi: '10.48550/arXiv.2010.11929',
    citations: 32156,
    source: 'arxiv',
  },
  {
    id: 'arxiv-2111.09883',
    title: 'Swin Transformer V2: Scaling Up Capacity and Resolution',
    authors: ['Ze Liu', 'Han Hu', 'Yutong Lin', 'Zhuliang Yao', 'Zhenda Xie', 'Yixuan Wei', 'Jia Ning', 'Yue Cao', 'Zheng Zhang', 'Li Dong', 'Furu Wei', 'Baining Guo'],
    year: 2022,
    abstract: 'We present techniques for scaling Swin Transformer up to 3 billion parameters and making it capable of training with images of up to 1,536×1,536 resolution. By scaling up capacity and resolution, Swin Transformer sets new records on four representative vision benchmarks.',
    doi: '10.48550/arXiv.2111.09883',
    citations: 1856,
    source: 'arxiv',
  },
  {
    id: 'arxiv-2201.03545',
    title: 'A ConvNet for the 2020s',
    authors: ['Zhuang Liu', 'Hanzi Mao', 'Chao-Yuan Wu', 'Christoph Feichtenhofer', 'Trevor Darrell', 'Saining Xie'],
    year: 2022,
    abstract: 'The "Roaring 20s" of visual recognition began with the introduction of Vision Transformers (ViTs), which quickly superseded ConvNets as the state-of-the-art image classification model. We reexamine the design spaces and test the limits of what a pure ConvNet can achieve.',
    doi: '10.48550/arXiv.2201.03545',
    citations: 4523,
    source: 'arxiv',
  },
  {
    id: 'arxiv-2106.14881',
    title: 'Focal Self-attention for Local-Global Interactions in Vision Transformers',
    authors: ['Jianwei Yang', 'Chunyuan Li', 'Pengchuan Zhang', 'Bin Xiao', 'Ce Liu', 'Lu Yuan', 'Jianfeng Gao'],
    year: 2021,
    abstract: 'We present focal self-attention, a new mechanism that incorporates both fine-grained local and coarse-grained global interactions. With focal self-attention, each token attends the closest surrounding tokens at fine granularity but the tokens far away at coarse granularity.',
    doi: '10.48550/arXiv.2106.14881',
    citations: 892,
    source: 'arxiv',
  },
];

// Swin Transformer analysis results
export const mockAnalysis = {
  keyPoints: [
    'Swin Transformer introduces shifted window attention mechanism to limit self-attention computation to non-overlapping local windows',
    'Hierarchical feature maps with patch merging layers enable multi-scale representation learning',
    'Linear computational complexity with respect to image size (O(n)) compared to ViT\'s quadratic complexity (O(n²))',
    'Shifted windows create connections between adjacent non-overlapping windows, enabling cross-window attention',
    'Achieves state-of-the-art performance on COCO object detection (58.7 box AP) and ADE20K segmentation (53.5 mIoU)',
  ],
  summary: 'Swin Transformer revolutionizes vision transformers by introducing a hierarchical architecture with shifted window-based self-attention. Unlike the original Vision Transformer (ViT) which processes images at a single low resolution, Swin builds hierarchical feature maps by merging patches in deeper layers. The shifted window approach enables efficient global modeling while maintaining linear computational complexity relative to image size.',
};

// Swin Transformer conclusions
export const mockConclusions = [
  'Based on our analysis, Swin Transformer represents a significant advancement in vision transformers by effectively addressing the computational challenges of applying self-attention to high-resolution images through its shifted window mechanism.',
  'The hierarchical design of Swin Transformer makes it particularly suitable as a general-purpose backbone for dense prediction tasks such as object detection and semantic segmentation.',
  'Experimental results demonstrate that Swin Transformer achieves state-of-the-art performance across multiple vision benchmarks while maintaining computational efficiency.',
];

// Swin Transformer LaTeX content
export const mockLatexContent = {
  introduction: `\\section{Introduction}

The Transformer architecture \\cite{vaswani2017attention}, originally designed for natural language processing, 
has recently demonstrated remarkable success in computer vision tasks. Vision Transformer (ViT) \\cite{dosovitskiy2020image} 
pioneered this direction by treating an image as a sequence of patches and applying standard Transformer encoders.

However, applying Transformers to vision tasks faces unique challenges:
\\begin{itemize}
    \\item Large variations in the scale of visual entities
    \\item High resolution of images compared to text sequences
    \\item The need for dense prediction in tasks like detection and segmentation
\\end{itemize}

Swin Transformer \\cite{liu2021swin} addresses these challenges through two key innovations:
(1) a hierarchical feature representation computed with Shifted Windows, and
(2) linear computational complexity with respect to image size.

In this paper, we investigate the application of Swin Transformer for visual recognition tasks,
with particular focus on its shifted window mechanism and hierarchical design.`,

  methodology: `\\section{Methodology}

\\subsection{Shifted Window Self-Attention}

The core innovation of Swin Transformer is the shifted window approach for computing self-attention.
Given an input feature map of size $H \\times W \\times C$, we partition it into non-overlapping windows
of size $M \\times M$ (default $M=7$).

The self-attention is computed within each local window:
\\begin{equation}
    \\text{Attention}(Q, K, V) = \\text{SoftMax}\\left(\\frac{QK^T}{\\sqrt{d}} + B\\right)V
\\end{equation}
where $B$ is the relative position bias, $Q, K, V \\in \\mathbb{R}^{M^2 \\times d}$ are query, key, and value matrices.

\\subsection{Hierarchical Architecture}

The hierarchical representation is constructed through patch merging layers:
\\begin{enumerate}
    \\item Stage 1: Patch partition with patch size $4 \\times 4$, feature dimension $C$
    \\item Stage 2: Patch merging $2\\times$ downsampling, dimension $2C$
    \\item Stage 3: Patch merging $2\\times$ downsampling, dimension $4C$
    \\item Stage 4: Patch merging $2\\times$ downsampling, dimension $8C$
\\end{enumerate}

\\subsection{Computational Complexity}

The computational complexity of standard global self-attention is:
\\begin{equation}
    \\Omega(\\text{MSA}) = 4hwC^2 + 2(hw)^2C
\\end{equation}

While the window-based self-attention achieves linear complexity:
\\begin{equation}
    \\Omega(\\text{W-MSA}) = 4hwC^2 + 2M^2hwC
\\end{equation}

This reduction from $O((hw)^2)$ to $O(hw)$ enables processing of high-resolution images.`,

  results: `\\section{Experimental Results}

\\subsection{Image Classification on ImageNet-1K}

We evaluate Swin Transformer on ImageNet-1K classification. Table~\\ref{tab:imagenet} summarizes the results.

\\begin{table}[htbp]
    \\centering
    \\caption{Comparison on ImageNet-1K classification.}
    \\label{tab:imagenet}
    \\begin{tabular}{|l|c|c|c|}
        \\hline
        \\textbf{Model} & \\textbf{Params (M)} & \\textbf{FLOPs (G)} & \\textbf{Top-1 Acc (\\%)} \\\\
        \\hline
        ResNet-50 & 25 & 4.1 & 76.2 \\\\
        ViT-B/16 & 86 & 17.6 & 77.9 \\\\
        DeiT-B & 86 & 17.6 & 81.8 \\\\
        \\hline
        Swin-T & 29 & 4.5 & 81.3 \\\\
        Swin-S & 50 & 8.7 & 83.0 \\\\
        Swin-B & 88 & 15.4 & \\textbf{83.5} \\\\
        \\hline
    \\end{tabular}
\\end{table}

\\subsection{Object Detection on COCO}

For object detection, we use Swin Transformer as the backbone with Cascade Mask R-CNN:

\\begin{table}[htbp]
    \\centering
    \\caption{Object detection results on COCO.}
    \\begin{tabular}{|l|c|c|c|}
        \\hline
        \\textbf{Backbone} & \\textbf{AP\\textsuperscript{box}} & \\textbf{AP\\textsuperscript{mask}} & \\textbf{Params (M)} \\\\
        \\hline
        ResNet-50 & 46.3 & 40.1 & 82 \\\\
        ResNeXt-101 & 48.1 & 41.6 & 101 \\\\
        \\hline
        Swin-T & 50.4 & 43.7 & 86 \\\\
        Swin-S & 51.9 & 45.0 & 107 \\\\
        Swin-B & \\textbf{51.9} & \\textbf{45.0} & 145 \\\\
        \\hline
    \\end{tabular}
\\end{table}

\\subsection{Semantic Segmentation on ADE20K}

We evaluate semantic segmentation using UPerNet with Swin backbone:

\\begin{itemize}
    \\item Swin-T achieves 44.5 mIoU with 60M parameters
    \\item Swin-S achieves 47.6 mIoU with 81M parameters  
    \\item Swin-B achieves \\textbf{48.1} mIoU with 121M parameters
\\end{itemize}`,

  conclusion: `\\section{Conclusion}

In this work, we have presented a comprehensive analysis of Swin Transformer, a hierarchical vision Transformer
that computes representation with Shifted Windows. Our key findings include:

\\begin{enumerate}
    \\item The shifted window mechanism effectively captures both local and global information while
    maintaining linear computational complexity with respect to image size.
    
    \\item The hierarchical architecture enables Swin Transformer to serve as a general-purpose backbone
    for various computer vision tasks including classification, detection, and segmentation.
    
    \\item Swin Transformer achieves state-of-the-art performance on multiple benchmarks:
    \\begin{itemize}
        \\item 83.5\\% top-1 accuracy on ImageNet-1K
        \\item 58.7 box AP on COCO object detection
        \\item 53.5 mIoU on ADE20K semantic segmentation
    \\end{itemize}
\\end{enumerate}

The success of Swin Transformer demonstrates the potential of adapting Transformer architectures
for computer vision by carefully addressing the unique challenges of visual data.

\\paragraph{Future Work} Promising directions include:
(1) further scaling up model capacity and input resolution,
(2) exploring efficient attention mechanisms for video understanding, and
(3) developing pre-training strategies specifically designed for vision Transformers.`,
};

/**
 * Simulate an agent action with streaming updates
 * Focused on Swin Transformer research
 */
export function* generateMockStream(userMessage: string): Generator<StreamEvent> {
  const sessionId = `session-${Date.now()}`;
  
  // 1. Start thinking
  yield {
    type: 'action_start',
    data: {
      action: {
        id: `action-${Date.now()}-1`,
        type: 'thinking',
        status: 'running',
        description: 'Analyzing your request about Swin Transformer...',
        timestamp: new Date().toISOString(),
      },
    },
  };

  // 2. Search papers
  yield {
    type: 'action_start',
    data: {
      action: {
        id: `action-${Date.now()}-2`,
        type: 'search_papers',
        status: 'running',
        description: 'Searching for Swin Transformer and Vision Transformer papers...',
        timestamp: new Date().toISOString(),
        data: {
          query: 'Swin Transformer hierarchical vision transformer shifted windows',
        },
      },
    },
  };

  yield {
    type: 'action_complete',
    data: {
      actionId: `action-${Date.now()}-2`,
      action: {
        id: `action-${Date.now()}-2`,
        type: 'search_papers',
        status: 'completed',
        description: `Found ${mockPapers.length} relevant papers on vision transformers`,
        timestamp: new Date().toISOString(),
        duration: 1200,
        data: {
          query: 'Swin Transformer',
          papers: mockPapers.slice(0, 3),
        },
      },
    },
  };

  // 3. Analyze Swin Transformer paper
  yield {
    type: 'action_start',
    data: {
      action: {
        id: `action-${Date.now()}-3`,
        type: 'analyze_paper',
        status: 'running',
        description: 'Analyzing Swin Transformer architecture and shifted window mechanism...',
        timestamp: new Date().toISOString(),
        data: {
          paperId: mockPapers[0].id,
        },
      },
    },
  };

  yield {
    type: 'action_complete',
    data: {
      actionId: `action-${Date.now()}-3`,
      action: {
        id: `action-${Date.now()}-3`,
        type: 'analyze_paper',
        status: 'completed',
        description: 'Swin Transformer analysis complete',
        timestamp: new Date().toISOString(),
        duration: 2500,
        data: {
          paperId: mockPapers[0].id,
          analysis: mockAnalysis.summary,
          keyPoints: mockAnalysis.keyPoints,
        },
      },
    },
  };

  // 4. Draw conclusion
  yield {
    type: 'action_start',
    data: {
      action: {
        id: `action-${Date.now()}-4`,
        type: 'draw_conclusion',
        status: 'running',
        description: 'Synthesizing findings on hierarchical vision transformers...',
        timestamp: new Date().toISOString(),
      },
    },
  };

  yield {
    type: 'action_complete',
    data: {
      actionId: `action-${Date.now()}-4`,
      action: {
        id: `action-${Date.now()}-4`,
        type: 'draw_conclusion',
        status: 'completed',
        description: 'Conclusion on Swin Transformer ready',
        timestamp: new Date().toISOString(),
        duration: 800,
        data: {
          conclusion: mockConclusions[0],
        },
      },
    },
  };

  // 5. Write content
  const sectionKey = userMessage.toLowerCase().includes('introduction') ? 'introduction'
    : userMessage.toLowerCase().includes('method') ? 'methodology'
    : userMessage.toLowerCase().includes('result') ? 'results'
    : 'conclusion';
  
  const content = mockLatexContent[sectionKey as keyof typeof mockLatexContent];

  yield {
    type: 'action_start',
    data: {
      action: {
        id: `action-${Date.now()}-5`,
        type: 'write_content',
        status: 'running',
        description: `Generating LaTeX content for ${sectionKey} section...`,
        timestamp: new Date().toISOString(),
        data: {
          section: sectionKey,
        },
      },
    },
  };

  yield {
    type: 'content_write',
    data: {
      content: content,
    },
  };

  yield {
    type: 'action_complete',
    data: {
      actionId: `action-${Date.now()}-5`,
      action: {
        id: `action-${Date.now()}-5`,
        type: 'write_content',
        status: 'completed',
        description: `${sectionKey} section written with Swin Transformer content`,
        timestamp: new Date().toISOString(),
        duration: 1500,
        data: {
          content: content,
          section: sectionKey,
          position: 'append',
        },
      },
    },
  };

  // Final message
  yield {
    type: 'message',
    data: {
      message: `I've completed writing the ${sectionKey} section based on my analysis of Swin Transformer and related vision transformer papers (${mockPapers.length} papers analyzed). The content covers the shifted window mechanism, hierarchical architecture, and benchmark results. Would you like me to expand on any specific aspect or adjust the content?`,
    },
  };
}

/**
 * Async generator that simulates streaming with delays
 */
export async function* streamMockResponse(userMessage: string): AsyncGenerator<StreamEvent> {
  const generator = generateMockStream(userMessage);
  
  for (const event of generator) {
    // Add realistic delays based on action type (2x slower for demo)
    const delay = event.type === 'action_start' ? 1200
      : event.type === 'action_complete' ? 2400
      : event.type === 'content_write' ? 1600
      : 800;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    yield event;
  }
}
