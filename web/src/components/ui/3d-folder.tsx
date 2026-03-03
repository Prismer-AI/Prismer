import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, forwardRef } from 'react';
import { Sun, Moon, X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utilities ---

/**
 * Combines multiple class names and merges Tailwind classes correctly.
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Interfaces & Constants ---

export interface Project {
  id: string;
  image: string;
  title: string;
}

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200";

// --- Internal Components ---

interface ProjectCardProps {
  image: string;
  title: string;
  delay: number;
  isVisible: boolean;
  index: number;
  totalCount: number;
  onClick: () => void;
  isSelected: boolean;
}

const ProjectCard = forwardRef<HTMLDivElement, ProjectCardProps>(
  ({ image, title, delay, isVisible, index, totalCount, onClick, isSelected }, ref) => {
    const middleIndex = (totalCount - 1) / 2;
    const factor = totalCount > 1 ? (index - middleIndex) / middleIndex : 0;
    
    const rotation = factor * 25; 
    const translationX = factor * 85; 
    const translationY = Math.abs(factor) * 12;

    return (
      <div
        ref={ref}
        className={cn(
          "absolute w-20 h-28 cursor-pointer group/card",
          isSelected && "opacity-0",
        )}
        style={{
          transform: isVisible
            ? `translateY(calc(-100px + ${translationY}px)) translateX(${translationX}px) rotate(${rotation}deg) scale(1)`
            : "translateY(0px) translateX(0px) rotate(0deg) scale(0.4)",
          opacity: isSelected ? 0 : isVisible ? 1 : 0,
          transition: `all 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
          zIndex: 10 + index,
          left: "-40px",
          top: "-56px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className={cn(
          "w-full h-full rounded-lg overflow-hidden shadow-xl bg-card border border-white/5 relative",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "group-hover/card:-translate-y-6 group-hover/card:shadow-2xl group-hover/card:shadow-accent/40 group-hover/card:ring-2 group-hover/card:ring-accent group-hover/card:scale-125"
        )}>
          <img 
            src={image || PLACEHOLDER_IMAGE} 
            alt={title} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] font-black uppercase tracking-tighter text-white truncate drop-shadow-md">
            {title}
          </p>
        </div>
      </div>
    );
  }
);
ProjectCard.displayName = "ProjectCard";

interface ImageLightboxProps {
  projects: Project[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  sourceRect: DOMRect | null;
  onCloseComplete?: () => void;
  onNavigate: (index: number) => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  projects,
  currentIndex,
  isOpen,
  onClose,
  sourceRect,
  onCloseComplete,
  onNavigate,
}) => {
  const [animationPhase, setAnimationPhase] = useState<"initial" | "animating" | "complete">("initial");
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [internalIndex, setInternalIndex] = useState(currentIndex);
  const [isSliding, setIsSliding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalProjects = projects.length;
  const hasNext = internalIndex < totalProjects - 1;
  const hasPrev = internalIndex > 0;
  const currentProject = projects[internalIndex];

  useEffect(() => {
    if (isOpen && currentIndex !== internalIndex && !isSliding) {
      setIsSliding(true);
      const timer = setTimeout(() => {
        setInternalIndex(currentIndex);
        setIsSliding(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isOpen, internalIndex, isSliding]);

  useEffect(() => {
    if (isOpen) {
      setInternalIndex(currentIndex);
      setIsSliding(false);
    }
  }, [isOpen, currentIndex]);

  const navigateNext = useCallback(() => {
    if (internalIndex >= totalProjects - 1 || isSliding) return;
    onNavigate(internalIndex + 1);
  }, [internalIndex, totalProjects, isSliding, onNavigate]);

  const navigatePrev = useCallback(() => {
    if (internalIndex <= 0 || isSliding) return;
    onNavigate(internalIndex - 1);
  }, [internalIndex, isSliding, onNavigate]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    onClose();
    setTimeout(() => {
      setIsClosing(false);
      setShouldRender(false);
      setAnimationPhase("initial");
      onCloseComplete?.();
    }, 500);
  }, [onClose, onCloseComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") navigateNext();
      if (e.key === "ArrowLeft") navigatePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose, navigateNext, navigatePrev]);

  useLayoutEffect(() => {
    if (isOpen && sourceRect) {
      setShouldRender(true);
      setAnimationPhase("initial");
      setIsClosing(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationPhase("animating");
        });
      });
      const timer = setTimeout(() => {
        setAnimationPhase("complete");
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOpen, sourceRect]);

  const handleDotClick = (idx: number) => {
    if (isSliding || idx === internalIndex) return;
    onNavigate(idx);
  };

  if (!shouldRender || !currentProject) return null;

  const getInitialStyles = (): React.CSSProperties => {
    if (!sourceRect) return {};
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.min(800, viewportWidth - 64);
    const targetHeight = Math.min(viewportHeight * 0.85, 600);
    const targetX = (viewportWidth - targetWidth) / 2;
    const targetY = (viewportHeight - targetHeight) / 2;
    const scaleX = sourceRect.width / targetWidth;
    const scaleY = sourceRect.height / targetHeight;
    const scale = Math.max(scaleX, scaleY);
    const translateX = sourceRect.left + sourceRect.width / 2 - (targetX + targetWidth / 2) + window.scrollX;
    const translateY = sourceRect.top + sourceRect.height / 2 - (targetY + targetHeight / 2) + window.scrollY;
    return {
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      opacity: 0.5,
      borderRadius: "12px",
    };
  };

  const getFinalStyles = (): React.CSSProperties => ({
    transform: "translate(0, 0) scale(1)",
    opacity: 1,
    borderRadius: "24px",
  });

  const currentStyles = animationPhase === "initial" && !isClosing ? getInitialStyles() : getFinalStyles();

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8")}
      onClick={handleClose}
      style={{
        opacity: isClosing ? 0 : 1,
        transition: "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-2xl"
        style={{
          opacity: (animationPhase === "initial" && !isClosing) ? 0 : 1,
          transition: "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        className={cn(
          "absolute top-6 right-6 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-muted/30 backdrop-blur-xl border border-white/10 shadow-2xl text-foreground hover:bg-muted transition-all duration-300",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateY(0)" : "translateY(-30px)",
          transition: "opacity 400ms ease-out 400ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 400ms",
        }}
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
        disabled={!hasPrev || isSliding}
        className={cn(
          "absolute left-4 md:left-10 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-muted/30 backdrop-blur-xl border border-white/10 text-foreground hover:scale-110 active:scale-95 transition-all duration-300 disabled:opacity-0 disabled:pointer-events-none shadow-2xl",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing && hasPrev ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateX(0)" : "translateX(-40px)",
          transition: "opacity 400ms ease-out 600ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 600ms",
        }}
      >
        <ChevronLeft className="w-6 h-6" strokeWidth={3} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); navigateNext(); }}
        disabled={!hasNext || isSliding}
        className={cn(
          "absolute right-4 md:right-10 z-50 w-14 h-14 flex items-center justify-center rounded-full bg-muted/30 backdrop-blur-xl border border-white/10 text-foreground hover:scale-110 active:scale-95 transition-all duration-300 disabled:opacity-0 disabled:pointer-events-none shadow-2xl",
        )}
        style={{
          opacity: animationPhase === "complete" && !isClosing && hasNext ? 1 : 0,
          transform: animationPhase === "complete" && !isClosing ? "translateX(0)" : "translateX(40px)",
          transition: "opacity 400ms ease-out 600ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 600ms",
        }}
      >
        <ChevronRight className="w-6 h-6" strokeWidth={3} />
      </button>
      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...currentStyles,
          transform: isClosing ? "translate(0, 0) scale(0.92)" : currentStyles.transform,
          transition: animationPhase === "initial" && !isClosing ? "none" : "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 600ms ease-out, border-radius 700ms ease",
          transformOrigin: "center center",
        }}
      >
        <div className={cn("relative overflow-hidden rounded-[inherit] bg-card border border-white/10 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)]")}>
          <div className="relative overflow-hidden aspect-[4/3] md:aspect-[16/10]">
            <div
              className="flex w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `translateX(-${internalIndex * 100}%)`,
                transition: isSliding ? "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
              }}
            >
              {projects.map((project, idx) => (
                <div key={project.id} className="min-w-full h-full relative">
                  <img
                    src={project.image || PLACEHOLDER_IMAGE}
                    alt={project.title}
                    className="w-full h-full object-cover select-none"
                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
          <div
            className={cn("px-8 py-7 bg-card border-t border-white/5")}
            style={{
              opacity: animationPhase === "complete" && !isClosing ? 1 : 0,
              transform: animationPhase === "complete" && !isClosing ? "translateY(0)" : "translateY(40px)",
              transition: "opacity 500ms ease-out 500ms, transform 600ms cubic-bezier(0.16, 1, 0.3, 1) 500ms",
            }}
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-foreground tracking-tight truncate">{currentProject?.title}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full border border-white/5">
                    {projects.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDotClick(idx)}
                        className={cn("w-1.5 h-1.5 rounded-full transition-all duration-500", idx === internalIndex ? "bg-foreground scale-150" : "bg-muted-foreground/30 hover:bg-muted-foreground/60")}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{internalIndex + 1} / {totalProjects}</p>
                </div>
              </div>
              <button className={cn("flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground bg-primary hover:brightness-110 rounded-xl shadow-lg shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95")}>
                <span>View Project</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AnimatedFolderProps {
  title: string;
  projects: Project[];
  className?: string;
  gradient?: string;
}

const AnimatedFolder: React.FC<AnimatedFolderProps> = ({ title, projects, className, gradient }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const previewProjects = projects.slice(0, 5);

  const handleProjectClick = (project: Project, index: number) => {
    const cardEl = cardRefs.current[index];
    if (cardEl) setSourceRect(cardEl.getBoundingClientRect());
    setSelectedIndex(index);
    setHiddenCardId(project.id);
  };

  const handleCloseLightbox = () => { setSelectedIndex(null); setSourceRect(null); };
  const handleCloseComplete = () => { setHiddenCardId(null); };
  const handleNavigate = (newIndex: number) => { setSelectedIndex(newIndex); setHiddenCardId(projects[newIndex]?.id || null); };

  const backBg = gradient || "linear-gradient(135deg, var(--folder-back) 0%, var(--folder-tab) 100%)";
  const tabBg = gradient || "var(--folder-tab)";
  const frontBg = gradient || "linear-gradient(135deg, var(--folder-front) 0%, var(--folder-back) 100%)";

  return (
    <>
      <div
        className={cn("relative flex flex-col items-center justify-center p-8 rounded-2xl cursor-pointer bg-card border border-border transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-2xl hover:shadow-accent/20 hover:border-accent/40 group", className)}
        style={{ minWidth: "280px", minHeight: "320px", perspective: "1200px", transform: isHovered ? "scale(1.04) rotate(-1.5deg)" : "scale(1) rotate(0deg)" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="absolute inset-0 rounded-2xl transition-opacity duration-700"
          style={{ background: gradient ? `radial-gradient(circle at 50% 70%, ${gradient.match(/#[a-fA-F0-9]{3,6}/)?.[0] || 'var(--accent)'} 0%, transparent 70%)` : "radial-gradient(circle at 50% 70%, var(--accent) 0%, transparent 70%)", opacity: isHovered ? 0.12 : 0 }}
        />
        <div className="relative flex items-center justify-center mb-4" style={{ height: "160px", width: "200px" }}>
          <div className="absolute w-32 h-24 rounded-lg shadow-md border border-white/10" style={{ background: backBg, filter: gradient ? "brightness(0.9)" : "none", transformOrigin: "bottom center", transform: isHovered ? "rotateX(-20deg) scaleY(1.05)" : "rotateX(0deg) scaleY(1)", transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)", zIndex: 10 }} />
          <div className="absolute w-12 h-4 rounded-t-md border-t border-x border-white/10" style={{ background: tabBg, filter: gradient ? "brightness(0.85)" : "none", top: "calc(50% - 48px - 12px)", left: "calc(50% - 64px + 16px)", transformOrigin: "bottom center", transform: isHovered ? "rotateX(-30deg) translateY(-3px)" : "rotateX(0deg) translateY(0)", transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)", zIndex: 10 }} />
          <div className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 20 }}>
            {previewProjects.map((project, index) => (
              <ProjectCard key={project.id} ref={(el) => { cardRefs.current[index] = el; }} image={project.image} title={project.title} delay={index * 50} isVisible={isHovered} index={index} totalCount={previewProjects.length} onClick={() => handleProjectClick(project, index)} isSelected={hiddenCardId === project.id} />
            ))}
          </div>
          <div className="absolute w-32 h-24 rounded-lg shadow-lg border border-white/20" style={{ background: frontBg, top: "calc(50% - 48px + 4px)", transformOrigin: "bottom center", transform: isHovered ? "rotateX(35deg) translateY(12px)" : "rotateX(0deg) translateY(0)", transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)", zIndex: 30 }} />
          <div className="absolute w-32 h-24 rounded-lg overflow-hidden pointer-events-none" style={{ top: "calc(50% - 48px + 4px)", background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)", transformOrigin: "bottom center", transform: isHovered ? "rotateX(35deg) translateY(12px)" : "rotateX(0deg) translateY(0)", transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)", zIndex: 31 }} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground mt-4 transition-all duration-500" style={{ transform: isHovered ? "translateY(2px)" : "translateY(0)", letterSpacing: isHovered ? "-0.01em" : "0" }}>{title}</h3>
          <p className="text-sm font-medium text-muted-foreground transition-all duration-500" style={{ opacity: isHovered ? 0.8 : 1 }}>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 transition-all duration-500" style={{ opacity: isHovered ? 0 : 1, transform: isHovered ? "translateY(10px)" : "translateY(0)" }}>
          <span>Hover</span>
        </div>
      </div>
      <ImageLightbox projects={projects} currentIndex={selectedIndex ?? 0} isOpen={selectedIndex !== null} onClose={handleCloseLightbox} sourceRect={sourceRect} onCloseComplete={handleCloseComplete} onNavigate={handleNavigate} />
    </>
  );
};

// --- Portfolio Data & Main App ---

const portfolioData = [
  {
    title: "Branding",
    gradient: "linear-gradient(135deg, #e73827, #f85032)",
    projects: [
      { id: "b1", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800", title: "Lumnia Identity" },
      { id: "b2", image: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=800", title: "Prism Collective" },
      { id: "b3", image: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&q=80&w=800", title: "Vertex Studio" },
      { id: "b4", image: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=800", title: "Aura Branding" },
      { id: "b5", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800", title: "Zephyr Lab" },
      { id: "b6", image: "https://images.unsplash.com/photo-1554446422-d05db23719d2?auto=format&fit=crop&q=80&w=800", title: "Origin Brand" },
    ] as Project[]
  },
  {
    title: "Web Design",
    gradient: "linear-gradient(to right, #f7b733, #fc4a1a)",
    projects: [
      { id: "w1", image: "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&q=80&w=800", title: "Nexus Platform" },
      { id: "w2", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800", title: "Echo Analytics" },
      { id: "w3", image: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=800", title: "Flow Systems" },
      { id: "w4", image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800", title: "Code Nest" },
      { id: "w5", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800", title: "Dev Port" },
    ] as Project[]
  },
  {
    title: "UI/UX Design",
    gradient: "linear-gradient(135deg, #00c6ff, #0072ff)",
    projects: [
      { id: "u1", image: "https://images.unsplash.com/photo-1586717791821-3f44a563eb4c?auto=format&fit=crop&q=80&w=800", title: "Crypto Wallet" },
      { id: "u2", image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&q=80&w=800", title: "Social Connect" },
      { id: "u3", image: "https://images.unsplash.com/photo-1522542550221-31fd19fe4af0?auto=format&fit=crop&q=80&w=800", title: "Health Tracker" },
      { id: "u4", image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&q=80&w=800", title: "Finance Dash" },
      { id: "u5", image: "https://images.unsplash.com/photo-1541462608141-ad4d4f942177?auto=format&fit=crop&q=80&w=800", title: "UX Wireframe" },
    ] as Project[]
  },
  {
    title: "Photography",
    gradient: "linear-gradient(to right, #414345, #232526)",
    projects: [
      { id: "p1", image: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&q=80&w=800", title: "Urban Rhythms" },
      { id: "p2", image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=800", title: "Natural States" },
      { id: "p3", image: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800", title: "Silent Woods" },
    ] as Project[]
  },
  {
    title: "Illustration",
    gradient: "linear-gradient(135deg, #8e2de2, #4a00e0)",
    projects: [
      { id: "i1", image: "https://images.unsplash.com/photo-1618335829737-2228915674e0?auto=format&fit=crop&q=80&w=800", title: "Digital Flora" },
      { id: "i2", image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=800", title: "Neon Nights" },
      { id: "i3", image: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&q=80&w=800", title: "Abstract Worlds" },
    ] as Project[]
  },
  {
    title: "Motion",
    gradient: "linear-gradient(135deg, #f80759, #bc4e9c)",
    projects: [
      { id: "m1", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800", title: "3D Sequences" },
      { id: "m2", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800", title: "Glitch Art" },
      { id: "m3", image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=800", title: "Tech Loops" },
    ] as Project[]
  }
];

export default function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-accent/30 selection:text-accent-foreground">
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-xl border-b border-border transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-end">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto pt-20 px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          Design <span className="text-primary italic">Portfolio</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          An interactive catalog of creative work. Hover over folders to reveal project previews.
        </p>
      </div>

      <section className="max-w-7xl mx-auto px-6 pt-16 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 justify-items-center">
          {portfolioData.map((folder, index) => (
            <div 
              key={folder.title} 
              className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700" 
              style={{ animationDelay: `${200 + index * 100}ms` }}
            >
              <AnimatedFolder 
                title={folder.title} 
                projects={folder.projects} 
                gradient={folder.gradient}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}