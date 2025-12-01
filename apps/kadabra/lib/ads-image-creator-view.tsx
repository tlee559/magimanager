"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ImageIcon,
  Sparkles,
  Upload,
  Target,
  Zap,
  TrendingUp,
  Eye,
  Heart,
  Download,
  RefreshCw,
  ChevronLeft,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  Lightbulb,
  BarChart3,
  Star,
} from "lucide-react";
import { upload } from "@vercel/blob/client";

// Types
interface AdImageProject {
  id: string;
  name: string | null;
  status: string;
  progress: number;
  productDescription: string | null;
  productUrl: string | null;
  headlines: string[];
  ctaText: string | null;
  goal: string | null;
  marketingAngles: string[];
  referenceImageUrl: string | null;
  referenceAnalysis: Record<string, unknown> | null;
  competitorDomain: string | null;
  competitorAnalysis: Record<string, unknown> | null;
  variationCount: number;
  createdAt: string;
  completedAt: string | null;
  processingError: string | null;
  images: AdImage[];
  campaignPlan: {
    id: string;
    name: string;
  } | null;
}

interface AdImage {
  id: string;
  compositeUrl: string;
  thumbnailUrl: string | null;
  backgroundUrl: string | null;
  headlineUsed: string | null;
  ctaUsed: string | null;
  angleUsed: string | null;
  creativeRationale: string | null;
  hookScore: number | null;
  clarityScore: number | null;
  ctaScore: number | null;
  overallScore: number | null;
  isFavorite: boolean;
}

interface ReferenceAnalysis {
  layout?: {
    textPosition: string;
    productPosition: string;
    ctaPosition: string;
    composition: string;
  };
  visualHierarchy?: string[];
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    mood: string;
  };
  hookMechanism?: string;
  ctaStyle?: string;
  whyItConverts?: string;
  suggestedImprovements?: string[];
  error?: string;
}

// Marketing angles
const MARKETING_ANGLES = [
  { id: "problem_solution", name: "Problem/Solution", description: "Show the pain, then the fix", icon: Lightbulb },
  { id: "social_proof", name: "Social Proof", description: "Reviews & testimonials", icon: Star },
  { id: "urgency_scarcity", name: "Urgency", description: "Limited time offers", icon: Zap },
  { id: "benefit_focused", name: "Benefit-Focused", description: "Lead with outcomes", icon: TrendingUp },
  { id: "curiosity", name: "Curiosity", description: "Pattern interrupt", icon: Eye },
  { id: "comparison", name: "Comparison", description: "Before/after", icon: BarChart3 },
  { id: "authority", name: "Authority", description: "Expert endorsement", icon: Target },
];

// Goals
const GOALS = [
  { id: "ctr", name: "Click-Through Rate", description: "Maximize clicks" },
  { id: "conversions", name: "Conversions", description: "Drive actions" },
  { id: "awareness", name: "Brand Awareness", description: "Build recognition" },
];

// ============================================================================
// HELPER: Get status message for processing view
// ============================================================================
function getStatusMessage(status: string, progress: number): { title: string; subtitle: string } {
  switch (status) {
    case "PENDING":
      return { title: "Queuing your request...", subtitle: "Setting up the creative generation pipeline" };
    case "ANALYZING":
      return {
        title: "AI analyzing your inputs...",
        subtitle: progress < 30
          ? "Understanding your product and target audience"
          : progress < 60
          ? "Analyzing reference images and competitor styles"
          : "Planning creative strategies and layouts"
      };
    case "GENERATING":
      return {
        title: "Generating ad images...",
        subtitle: progress < 50
          ? "Creating unique visual compositions with AI"
          : "Refining images for maximum impact"
      };
    case "COMPOSITING":
      return {
        title: "Adding text overlays...",
        subtitle: "Positioning headlines and CTAs for optimal engagement"
      };
    case "SCORING":
      return { title: "Scoring creatives...", subtitle: "AI evaluating hook strength and conversion potential" };
    default:
      return { title: "Processing...", subtitle: "Please wait while we generate your ads" };
  }
}

// ============================================================================
// MAIN VIEW COMPONENT
// ============================================================================

interface AdsImageCreatorViewProps {
  onBack?: () => void;
}

export function AdsImageCreatorView({ onBack }: AdsImageCreatorViewProps) {
  const [view, setView] = useState<"list" | "create" | "processing" | "detail">("list");
  const [projects, setProjects] = useState<AdImageProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<AdImageProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialCampaignPlanId, setInitialCampaignPlanId] = useState<string | null>(null);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);

  // Check for campaign plan ID from sessionStorage (from Campaign Planner integration)
  useEffect(() => {
    const storedPlanId = sessionStorage.getItem("adsImageCreator_campaignPlanId");
    if (storedPlanId) {
      setInitialCampaignPlanId(storedPlanId);
      sessionStorage.removeItem("adsImageCreator_campaignPlanId");
      // Automatically go to create view with campaign plan pre-selected
      setView("create");
    }
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log("[AdsImageCreator] Fetching projects...");
      const response = await fetch("/api/ai/ads-image-creator/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      console.log("[AdsImageCreator] Fetched", data.projects?.length || 0, "projects");
      setProjects(data.projects);
    } catch (err) {
      console.error("[AdsImageCreator] Error fetching projects:", err);
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single project status (for polling)
  const fetchProjectStatus = useCallback(async (projectId: string): Promise<AdImageProject | null> => {
    try {
      console.log("[AdsImageCreator] Polling project status:", projectId);
      const response = await fetch(`/api/ai/ads-image-creator/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = await response.json();
      console.log("[AdsImageCreator] Project status:", data.project.status, "Progress:", data.project.progress);
      return data.project;
    } catch (err) {
      console.error("[AdsImageCreator] Error polling project:", err);
      return null;
    }
  }, []);

  // Poll for updates when in processing view
  useEffect(() => {
    if (view === "processing" && selectedProject && !["COMPLETED", "FAILED"].includes(selectedProject.status)) {
      console.log("[AdsImageCreator] Starting polling for project:", selectedProject.id);
      const interval = setInterval(async () => {
        const updated = await fetchProjectStatus(selectedProject.id);
        if (updated) {
          setSelectedProject(updated);
          if (updated.status === "COMPLETED" || updated.status === "FAILED") {
            console.log("[AdsImageCreator] Generation finished:", updated.status);
            setView("detail");
            fetchProjects();
          }
        }
      }, 3000);
      return () => {
        console.log("[AdsImageCreator] Stopping polling");
        clearInterval(interval);
      };
    }
  }, [view, selectedProject?.id, selectedProject?.status, fetchProjectStatus, fetchProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Handle project selection
  const handleSelectProject = async (projectId: string) => {
    try {
      console.log("[AdsImageCreator] Selecting project:", projectId);
      const response = await fetch(`/api/ai/ads-image-creator/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = await response.json();
      setSelectedProject(data.project);

      // If still processing, go to processing view, otherwise detail view
      if (["PENDING", "ANALYZING", "GENERATING", "COMPOSITING", "SCORING"].includes(data.project.status)) {
        console.log("[AdsImageCreator] Project still processing, showing processing view");
        setView("processing");
      } else {
        setView("detail");
      }
    } catch (err) {
      console.error("[AdsImageCreator] Error selecting project:", err);
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  };

  // Handle project deletion
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(`/api/ai/ads-image-creator/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete project");
      await fetchProjects();
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setView("list");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  // Handle project creation - show background modal
  const handleProjectCreated = (project: AdImageProject) => {
    console.log("[AdsImageCreator] Project created:", project.id);
    setSelectedProject(project);
    setShowBackgroundModal(true);
    setInitialCampaignPlanId(null);
    fetchProjects();
  };

  // Render based on view
  if (view === "create") {
    return (
      <CreateProjectView
        onBack={() => {
          setView("list");
          setInitialCampaignPlanId(null);
        }}
        onCreated={handleProjectCreated}
        initialCampaignPlanId={initialCampaignPlanId}
      />
    );
  }

  if (view === "processing" && selectedProject) {
    return (
      <ProcessingView
        project={selectedProject}
        onCancel={() => {
          setView("list");
          setSelectedProject(null);
        }}
      />
    );
  }

  if (view === "detail" && selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        onBack={() => {
          setView("list");
          setSelectedProject(null);
          fetchProjects();
        }}
        onRefresh={async () => {
          const updated = await fetchProjectStatus(selectedProject.id);
          if (updated) setSelectedProject(updated);
        }}
        onDelete={() => handleDeleteProject(selectedProject.id)}
      />
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>
          )}
          <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-600 rounded-lg">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Ads Image Creator</h2>
            <p className="text-sm text-slate-400">AI-powered ad creative generation</p>
          </div>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create your first ad creative project to get started
          </p>
          <button
            onClick={() => setView("create")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        /* Projects grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleSelectProject(project.id)}
              onDelete={() => handleDeleteProject(project.id)}
            />
          ))}
        </div>
      )}

      {/* Background Processing Modal */}
      {showBackgroundModal && selectedProject && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 mb-4">
                <ImageIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">
                Generation Started
              </h3>
              <p className="text-sm text-slate-400">
                Your ad images are being generated. This may take 1-2 minutes.
                We&apos;ll notify you when it&apos;s ready.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowBackgroundModal(false);
                  setView("processing");
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90 text-white rounded-xl font-medium transition"
              >
                Watch Progress
              </button>
              <button
                onClick={() => {
                  setShowBackgroundModal(false);
                  setSelectedProject(null);
                }}
                className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition"
              >
                Continue Working
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROJECT CARD COMPONENT
// ============================================================================

function ProjectCard({
  project,
  onClick,
  onDelete,
}: {
  project: AdImageProject;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    PENDING: "bg-slate-500",
    ANALYZING: "bg-blue-500",
    GENERATING: "bg-orange-500",
    COMPOSITING: "bg-purple-500",
    COMPLETED: "bg-emerald-500",
    FAILED: "bg-red-500",
  };

  const thumbnailImage = project.images[0]?.compositeUrl || project.images[0]?.thumbnailUrl;

  return (
    <div
      className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-orange-500/50 transition cursor-pointer overflow-hidden group"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-slate-900/50 relative">
        {thumbnailImage ? (
          <img
            src={thumbnailImage}
            alt={project.name || "Project"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-slate-700" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`px-2 py-1 text-xs font-medium text-white rounded ${statusColors[project.status] || "bg-slate-500"}`}
          >
            {project.status === "GENERATING" ? `${project.progress}%` : project.status}
          </span>
        </div>

        {/* Image count */}
        {project.images.length > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
            {project.images.length} image{project.images.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-slate-200 truncate">
          {project.name || "Untitled Project"}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>
        {project.campaignPlan && (
          <p className="text-xs text-orange-400 mt-1 truncate">
            From: {project.campaignPlan.name}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROCESSING VIEW
// ============================================================================

function ProcessingView({
  project,
  onCancel,
}: {
  project: AdImageProject;
  onCancel: () => void;
}) {
  const status = getStatusMessage(project.status, project.progress);

  // Calculate image progress
  const totalExpected = project.variationCount;
  const completedImages = project.images.filter(img => img.compositeUrl).length;

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      {/* Animated Processing Icon */}
      <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-orange-500/20" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500 animate-spin"
          style={{ animationDuration: "1.5s" }}
        />
        <ImageIcon className="w-10 h-10 text-orange-400" />
      </div>

      {/* Status */}
      <h3 className="text-xl font-semibold text-slate-100 mb-2">
        {status.title}
      </h3>
      <p className="text-sm text-slate-400 mb-6">
        {status.subtitle}
      </p>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-pink-600 transition-all duration-500"
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mb-4">{project.progress}% complete</p>

      {/* Image Progress - show when generating */}
      {project.status === "GENERATING" && totalExpected > 0 && (
        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl text-left">
          <p className="text-xs text-slate-400 uppercase font-medium mb-3">Image Progress</p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: totalExpected }).map((_, index) => {
              const image = project.images[index];
              const isComplete = image?.compositeUrl;
              const isInProgress = index === completedImages;
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center ${
                    isComplete
                      ? "bg-emerald-500/20 border border-emerald-500/40"
                      : isInProgress
                      ? "bg-orange-500/20 border border-orange-500/40"
                      : "bg-slate-700/50 border border-slate-600"
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : isInProgress ? (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                  ) : (
                    <span className="text-xs text-slate-500">{index + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
            {completedImages}/{totalExpected} images generated
          </div>
        </div>
      )}

      {/* Project Info */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-xl text-left">
        <p className="text-xs text-slate-400 uppercase font-medium mb-2">Project</p>
        <p className="text-sm text-slate-200">{project.name || "Untitled Project"}</p>
        {project.headlines && project.headlines.length > 0 && (
          <p className="text-xs text-slate-500 mt-1 truncate">
            Headlines: {project.headlines.join(", ")}
          </p>
        )}
      </div>

      {/* Info message about background processing */}
      <p className="text-xs text-slate-500 mt-6 mb-4">
        Processing continues in the background. You can navigate away and come back later.
      </p>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
      >
        Continue Working
      </button>
    </div>
  );
}

// ============================================================================
// CREATE PROJECT VIEW
// ============================================================================

function CreateProjectView({
  onBack,
  onCreated,
  initialCampaignPlanId,
}: {
  onBack: () => void;
  onCreated: (project: AdImageProject) => void;
  initialCampaignPlanId?: string | null;
}) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [headlines, setHeadlines] = useState<string[]>([""]);
  const [ctaText, setCtaText] = useState("");
  const [goal, setGoal] = useState("ctr");
  const [selectedAngles, setSelectedAngles] = useState<string[]>(["benefit_focused"]);
  const [variationCount, setVariationCount] = useState(4);
  const [campaignPlanId, setCampaignPlanId] = useState<string | null>(initialCampaignPlanId || null);
  const [campaignPlanData, setCampaignPlanData] = useState<{
    name: string;
    productDescription: string | null;
    targetAudience: string | null;
    plan: { headlines?: string[]; uniqueSellingPoints?: string[] } | null;
  } | null>(null);

  // Fetch campaign plan data if initialCampaignPlanId is provided
  useEffect(() => {
    if (initialCampaignPlanId) {
      fetchCampaignPlanData(initialCampaignPlanId);
    }
  }, [initialCampaignPlanId]);

  const fetchCampaignPlanData = async (planId: string) => {
    try {
      const response = await fetch(`/api/ai/campaign-planner/${planId}`);
      if (!response.ok) return;
      const data = await response.json();
      const plan = data.plan;

      setCampaignPlanData({
        name: plan.name,
        productDescription: plan.productDescription,
        targetAudience: plan.targetAudience,
        plan: plan.plan,
      });

      // Pre-fill form fields from campaign plan
      if (plan.name) setName(`Ads for ${plan.name}`);
      if (plan.productDescription) setProductDescription(plan.productDescription);
      if (plan.productUrl) setProductUrl(plan.productUrl);

      // Extract headlines from the plan if available
      if (plan.plan?.headlines?.length > 0) {
        setHeadlines(plan.plan.headlines.slice(0, 5));
      }
    } catch (err) {
      console.error("Failed to fetch campaign plan:", err);
    }
  };

  // Reference image state
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Handle reference image upload
  const handleReferenceUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);

      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/ai/ads-image-creator/upload",
      });

      setReferenceImageUrl(blob.url);

      // Analyze the reference image
      setIsAnalyzing(true);
      const response = await fetch("/api/ai/ads-image-creator/reference/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: blob.url }),
      });

      if (response.ok) {
        const data = await response.json();
        setReferenceAnalysis(data.analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  };

  // Add/remove headlines
  const addHeadline = () => {
    if (headlines.length < 5) {
      setHeadlines([...headlines, ""]);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > 1) {
      setHeadlines(headlines.filter((_, i) => i !== index));
    }
  };

  const updateHeadline = (index: number, value: string) => {
    const newHeadlines = [...headlines];
    newHeadlines[index] = value;
    setHeadlines(newHeadlines);
  };

  // Toggle angle selection
  const toggleAngle = (angleId: string) => {
    if (selectedAngles.includes(angleId)) {
      if (selectedAngles.length > 1) {
        setSelectedAngles(selectedAngles.filter((a) => a !== angleId));
      }
    } else {
      setSelectedAngles([...selectedAngles, angleId]);
    }
  };

  // Create and generate
  const handleCreate = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[AdsImageCreator] Starting project creation...");

      // Validate
      if (!productDescription.trim()) {
        throw new Error("Product description is required");
      }

      const filteredHeadlines = headlines.filter((h) => h.trim());
      if (filteredHeadlines.length === 0) {
        throw new Error("At least one headline is required");
      }

      console.log("[AdsImageCreator] Creating project with:", {
        name: name.trim() || null,
        headlines: filteredHeadlines.length,
        angles: selectedAngles,
        variations: variationCount,
        hasReference: !!referenceImageUrl,
      });

      // Create project
      const createResponse = await fetch("/api/ai/ads-image-creator/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          productDescription: productDescription.trim(),
          productUrl: productUrl.trim() || null,
          headlines: filteredHeadlines,
          ctaText: ctaText.trim() || null,
          goal,
          marketingAngles: selectedAngles,
          variationCount,
          referenceImageUrl,
          referenceAnalysis,
          campaignPlanId: campaignPlanId || undefined,
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json();
        console.error("[AdsImageCreator] Failed to create project:", err);
        throw new Error(err.error || "Failed to create project");
      }

      const { project } = await createResponse.json();
      console.log("[AdsImageCreator] Project created:", project.id);

      // Start generation
      console.log("[AdsImageCreator] Starting generation...");
      const generateResponse = await fetch(
        `/api/ai/ads-image-creator/projects/${project.id}/generate`,
        { method: "POST" }
      );

      if (!generateResponse.ok) {
        const err = await generateResponse.json();
        console.error("[AdsImageCreator] Failed to start generation:", err);
        throw new Error(err.error || "Failed to start generation");
      }

      console.log("[AdsImageCreator] Generation started successfully");
      onCreated(project);
    } catch (err) {
      console.error("[AdsImageCreator] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Create New Project</h2>
          <p className="text-sm text-slate-400">Step {step} of 3</p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Campaign Plan Badge */}
      {campaignPlanData && (
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <Target className="w-5 h-5 text-violet-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-300">Linked to Campaign Plan</p>
            <p className="text-xs text-slate-400">{campaignPlanData.name}</p>
          </div>
          <button
            onClick={() => {
              setCampaignPlanId(null);
              setCampaignPlanData(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Unlink
          </button>
        </div>
      )}

      {/* Step 1: Product Details */}
      {step === 1 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-slate-200">Product Details</h3>

          <div className="space-y-4">
            {/* Project name */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Project Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Ad Campaign"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Product description */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Product/Offer Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe your product or offer. What problem does it solve? What makes it unique?"
                rows={4}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Product URL */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Product URL (optional)</label>
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://example.com/product"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!productDescription.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Headlines & Reference */}
      {step === 2 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-slate-200">Headlines & Reference</h3>

          <div className="space-y-4">
            {/* Headlines */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Headlines to Test <span className="text-red-400">*</span>
              </label>
              {headlines.map((headline, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => updateHeadline(index, e.target.value)}
                    placeholder={`Headline ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
                  />
                  {headlines.length > 1 && (
                    <button
                      onClick={() => removeHeadline(index)}
                      className="p-2 text-slate-500 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {headlines.length < 5 && (
                <button
                  onClick={addHeadline}
                  className="text-xs text-orange-400 hover:text-orange-300 transition"
                >
                  + Add another headline
                </button>
              )}
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Call to Action</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Learn More"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Reference image */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">Reference Image (optional)</label>
              <p className="text-xs text-slate-500 mb-3">
                Upload an ad that inspires you. AI will analyze it and create variations.
              </p>

              {referenceImageUrl ? (
                <div className="relative">
                  <img
                    src={referenceImageUrl}
                    alt="Reference"
                    className="w-full max-w-sm rounded-lg border border-slate-700"
                  />
                  <button
                    onClick={() => {
                      setReferenceImageUrl(null);
                      setReferenceAnalysis(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 rounded hover:bg-red-600 transition"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>

                  {/* Analysis results */}
                  {isAnalyzing && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing reference...
                    </div>
                  )}
                  {referenceAnalysis && !referenceAnalysis.error && (
                    <div className="mt-3 bg-slate-900/50 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-orange-400">AI Analysis</h4>
                      {referenceAnalysis.hookMechanism && (
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-300">Hook:</span> {referenceAnalysis.hookMechanism}
                        </p>
                      )}
                      {referenceAnalysis.whyItConverts && (
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-300">Why it works:</span> {referenceAnalysis.whyItConverts}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className="block">
                  <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-orange-500/50 transition cursor-pointer">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-slate-500 mx-auto animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Drop an image or click to upload</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleReferenceUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={headlines.filter((h) => h.trim()).length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Strategy & Generate */}
      {step === 3 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-slate-200">Strategy & Generation</h3>

          <div className="space-y-6">
            {/* Goal selection */}
            <div>
              <label className="block text-xs text-slate-400 mb-3">Campaign Goal</label>
              <div className="grid grid-cols-3 gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`p-3 rounded-lg border text-left transition ${
                      goal === g.id
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <h4 className="text-sm font-medium text-slate-200">{g.name}</h4>
                    <p className="text-xs text-slate-500">{g.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Marketing angles */}
            <div>
              <label className="block text-xs text-slate-400 mb-3">Marketing Angles</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MARKETING_ANGLES.map((angle) => {
                  const Icon = angle.icon;
                  const isSelected = selectedAngles.includes(angle.id);
                  return (
                    <button
                      key={angle.id}
                      onClick={() => toggleAngle(angle.id)}
                      className={`p-3 rounded-lg border text-left transition ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-2 ${isSelected ? "text-orange-400" : "text-slate-500"}`} />
                      <h4 className="text-xs font-medium text-slate-200">{angle.name}</h4>
                      <p className="text-xs text-slate-500 truncate">{angle.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Variation count */}
            <div>
              <label className="block text-xs text-slate-400 mb-3">
                Number of Variations: {variationCount}
              </label>
              <input
                type="range"
                min={1}
                max={4}
                value={variationCount}
                onChange={(e) => setVariationCount(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>4</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Ads
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROJECT DETAIL VIEW
// ============================================================================

function ProjectDetailView({
  project,
  onBack,
  onRefresh,
  onDelete,
}: {
  project: AdImageProject;
  onBack: () => void;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const [selectedImage, setSelectedImage] = useState<AdImage | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Export function
  const handleExport = async (formats: string[]) => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/ai/ads-image-creator/projects/${project.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formats }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Export failed");
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name || "ad-images"}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (err) {
      console.error("Export error:", err);
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // Poll for updates while generating
  useEffect(() => {
    if (project.status === "GENERATING" || project.status === "ANALYZING" || project.status === "COMPOSITING") {
      setIsPolling(true);
      const interval = setInterval(onRefresh, 3000);
      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    }
  }, [project.status, onRefresh]);

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "bg-slate-500/10", text: "text-slate-400" },
    ANALYZING: { bg: "bg-blue-500/10", text: "text-blue-400" },
    GENERATING: { bg: "bg-orange-500/10", text: "text-orange-400" },
    COMPOSITING: { bg: "bg-purple-500/10", text: "text-purple-400" },
    COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    FAILED: { bg: "bg-red-500/10", text: "text-red-400" },
  };

  const status = statusColors[project.status] || statusColors.PENDING;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {project.name || "Untitled Project"}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.text}`}>
                {project.status}
                {(project.status === "GENERATING" || project.status === "ANALYZING") && (
                  <span className="ml-1">{project.progress}%</span>
                )}
              </span>
              {project.campaignPlan && (
                <span className="text-xs text-slate-500">
                  From: {project.campaignPlan.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.status === "COMPLETED" && project.images && project.images.length > 0 && (
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500/20 to-pink-500/20 hover:from-orange-500/30 hover:to-pink-500/30 border border-orange-500/30 rounded-lg text-sm text-orange-300 transition"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          )}
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
            disabled={isPolling}
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${isPolling ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 rounded-lg transition text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error display */}
      {project.processingError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{project.processingError}</p>
        </div>
      )}

      {/* Progress bar for generating */}
      {(project.status === "GENERATING" || project.status === "ANALYZING" || project.status === "COMPOSITING") && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <span className="text-sm text-slate-300">
              {project.status === "ANALYZING" && "Analyzing reference and planning creatives..."}
              {project.status === "GENERATING" && "Generating ad images..."}
              {project.status === "COMPOSITING" && "Adding text overlays..."}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-600 transition-all duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Images grid */}
      {project.images.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">
            Generated Images ({project.images.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {project.images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className="relative aspect-square bg-slate-900/50 rounded-lg overflow-hidden cursor-pointer group hover:ring-2 hover:ring-orange-500/50 transition"
              >
                <img
                  src={image.compositeUrl}
                  alt="Generated ad"
                  className="w-full h-full object-cover"
                />

                {/* Score badge */}
                {image.overallScore && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400" />
                    {image.overallScore}
                  </div>
                )}

                {/* Favorite */}
                {image.isFavorite && (
                  <div className="absolute top-2 right-2">
                    <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-white text-sm">View Details</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : project.status === "COMPLETED" ? (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No images generated</h3>
          <p className="text-sm text-slate-500">
            Something went wrong during generation. Please try again.
          </p>
        </div>
      ) : null}

      {/* Image detail modal */}
      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Export modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          isExporting={isExporting}
        />
      )}
    </div>
  );
}

// ============================================================================
// EXPORT MODAL
// ============================================================================

function ExportModal({
  onClose,
  onExport,
  isExporting,
}: {
  onClose: () => void;
  onExport: (formats: string[]) => void;
  isExporting: boolean;
}) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    "facebook-feed",
    "instagram-square",
    "gdn-medium-rectangle",
  ]);

  const formatGroups = {
    "Google Display Network": [
      { key: "gdn-medium-rectangle", name: "Medium Rectangle", dimensions: "300×250" },
      { key: "gdn-large-rectangle", name: "Large Rectangle", dimensions: "336×280" },
      { key: "gdn-leaderboard", name: "Leaderboard", dimensions: "728×90" },
      { key: "gdn-half-page", name: "Half Page", dimensions: "300×600" },
      { key: "gdn-large-mobile-banner", name: "Mobile Banner", dimensions: "320×100" },
    ],
    "Facebook / Meta": [
      { key: "facebook-feed", name: "Feed", dimensions: "1200×628" },
      { key: "facebook-story", name: "Story", dimensions: "1080×1920" },
      { key: "facebook-carousel", name: "Carousel", dimensions: "1080×1080" },
    ],
    "Instagram": [
      { key: "instagram-square", name: "Square", dimensions: "1080×1080" },
      { key: "instagram-portrait", name: "Portrait", dimensions: "1080×1350" },
      { key: "instagram-story", name: "Story", dimensions: "1080×1920" },
    ],
    "LinkedIn": [
      { key: "linkedin-single", name: "Single Image", dimensions: "1200×627" },
      { key: "linkedin-square", name: "Square", dimensions: "1200×1200" },
    ],
    "Twitter / X": [
      { key: "twitter-single", name: "Single Image", dimensions: "1200×675" },
      { key: "twitter-card", name: "Card", dimensions: "800×418" },
    ],
  };

  const toggleFormat = (formatKey: string) => {
    if (selectedFormats.includes(formatKey)) {
      setSelectedFormats(selectedFormats.filter((f) => f !== formatKey));
    } else {
      setSelectedFormats([...selectedFormats, formatKey]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200">Export Images</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-slate-400">
            Select the ad formats you want to export. Images will be resized and packaged into a ZIP file.
          </p>

          {Object.entries(formatGroups).map(([groupName, formats]) => (
            <div key={groupName}>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{groupName}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {formats.map((format) => (
                  <button
                    key={format.key}
                    onClick={() => toggleFormat(format.key)}
                    className={`px-3 py-2 rounded-lg border text-left transition ${
                      selectedFormats.includes(format.key)
                        ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="text-sm font-medium">{format.name}</p>
                    <p className="text-xs text-slate-500">{format.dimensions}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-sm text-slate-400">
            {selectedFormats.length} format{selectedFormats.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(selectedFormats)}
              disabled={selectedFormats.length === 0 || isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IMAGE DETAIL MODAL
// ============================================================================

function ImageDetailModal({
  image,
  onClose,
}: {
  image: AdImage;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(image.compositeUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ad-creative-${image.id}.webp`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(image.compositeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-200">Image Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image */}
          <div>
            <img
              src={image.compositeUrl}
              alt="Generated ad"
              className="w-full rounded-lg"
            />

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleCopyUrl}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Scores */}
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-400 mb-3">AI Scores</h4>
              <div className="grid grid-cols-2 gap-3">
                <ScoreItem label="Hook" score={image.hookScore} />
                <ScoreItem label="Clarity" score={image.clarityScore} />
                <ScoreItem label="CTA" score={image.ctaScore} />
                <ScoreItem label="Overall" score={image.overallScore} highlight />
              </div>
            </div>

            {/* Creative details */}
            <div className="space-y-3">
              {image.headlineUsed && (
                <div>
                  <label className="text-xs text-slate-500">Headline</label>
                  <p className="text-sm text-slate-200">{image.headlineUsed}</p>
                </div>
              )}
              {image.ctaUsed && (
                <div>
                  <label className="text-xs text-slate-500">CTA</label>
                  <p className="text-sm text-slate-200">{image.ctaUsed}</p>
                </div>
              )}
              {image.angleUsed && (
                <div>
                  <label className="text-xs text-slate-500">Marketing Angle</label>
                  <p className="text-sm text-slate-200 capitalize">{image.angleUsed.replace(/_/g, " ")}</p>
                </div>
              )}
            </div>

            {/* Rationale */}
            {image.creativeRationale && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Why This Should Convert
                </h4>
                <p className="text-sm text-slate-300">{image.creativeRationale}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ScoreItem({
  label,
  score,
  highlight = false,
}: {
  label: string;
  score: number | null;
  highlight?: boolean;
}) {
  if (score === null) return null;

  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-emerald-400";
    if (s >= 80) return "text-orange-400";
    if (s >= 70) return "text-yellow-400";
    return "text-slate-400";
  };

  return (
    <div className={`p-2 rounded ${highlight ? "bg-orange-500/10" : "bg-slate-800/50"}`}>
      <label className="text-xs text-slate-500">{label}</label>
      <p className={`text-lg font-semibold ${getScoreColor(score)}`}>{score}</p>
    </div>
  );
}

export default AdsImageCreatorView;
