"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Search,
  Loader2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Image as ImageIcon,
  Globe,
  Star,
  Tag,
  Link2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";
import type { AdSpyJob, Ad, AIAnalysis, LOCATIONS } from "./types";

interface AdSpyViewProps {
  onBack?: () => void;
}

const LOCATION_OPTIONS: { code: string; name: string }[] = [
  { code: "us", name: "United States" },
  { code: "uk", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "in", name: "India" },
  { code: "jp", name: "Japan" },
];

export function AdSpyView({ onBack }: AdSpyViewProps) {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("us");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [jobs, setJobs] = useState<AdSpyJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AdSpyJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showScreenshot, setShowScreenshot] = useState<string | null>(null);
  const [expandedAds, setExpandedAds] = useState<Set<number>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Poll for job updates
  useEffect(() => {
    const pendingJobs = jobs.filter(
      (j) =>
        j.status === "pending" ||
        j.status === "searching" ||
        j.status === "screenshotting"
    );

    if (pendingJobs.length > 0) {
      pollIntervalRef.current = setInterval(() => {
        fetchJobs();
      }, 2000);
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/adspy/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);

        // Update selected job if it exists
        if (selectedJob) {
          const updated = data.jobs?.find((j: AdSpyJob) => j.id === selectedJob.id);
          if (updated) {
            setSelectedJob(updated);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  };

  const startSearch = async () => {
    if (!keyword.trim()) {
      setError("Please enter a keyword to search");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/adspy/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Search failed");
        return;
      }

      // Add job to list and select it
      setJobs((prev) => [data.job, ...prev]);
      setSelectedJob(data.job);
      setKeyword("");
    } catch (err) {
      setError("Failed to start search. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!selectedJob || !selectedJob.ads?.length) return;

    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/adspy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJob.id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Analysis failed");
        return;
      }

      // Update the job with analysis
      setSelectedJob((prev) =>
        prev ? { ...prev, aiAnalysis: data.analysis } : null
      );
      fetchJobs(); // Refresh jobs list
    } catch (err) {
      setError("Failed to analyze. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/adspy/jobs/${jobId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (selectedJob?.id === jobId) {
          setSelectedJob(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleAdExpanded = (index: number) => {
    setExpandedAds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      case "searching":
      case "screenshotting":
      case "analyzing":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold">AdSpy Tool</h1>
            <p className="text-sm text-gray-400">
              Search competitor Google Ads and get AI copywriting recommendations
            </p>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Search & History */}
        <div className="w-80 border-r border-white/10 flex flex-col">
          {/* Search Form */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && startSearch()}
                placeholder="Enter keyword to spy on..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc.code} value={loc.code} className="bg-[#1a1a1a]">
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startSearch}
              disabled={loading || !keyword.trim()}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search Ads
            </button>

            {error && (
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Job History */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 text-xs font-medium text-gray-500 uppercase">
              Search History
            </div>
            {jobs.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No searches yet
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-3 rounded-lg cursor-pointer transition group ${
                      selectedJob?.id === job.id
                        ? "bg-blue-600/20 border border-blue-500/30"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{job.keyword}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Globe className="w-3 h-3" />
                          {job.location.toUpperCase()}
                          <span>•</span>
                          <span className={getStatusColor(job.status)}>
                            {job.status}
                          </span>
                        </div>
                        {job.ads && (
                          <div className="text-xs text-gray-500 mt-1">
                            {job.ads.length} ads found
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteJob(job.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {job.status !== "completed" && job.status !== "failed" && (
                      <div className="mt-2">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="flex-1 overflow-y-auto">
          {!selectedJob ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Search for a keyword to see competitor ads</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Results for "{selectedJob.keyword}"
                  </h2>
                  <p className="text-sm text-gray-400">
                    {selectedJob.ads?.length || 0} ads found •{" "}
                    {selectedJob.location.toUpperCase()}
                  </p>
                </div>
                {selectedJob.status === "completed" && selectedJob.ads?.length && (
                  <button
                    onClick={analyzeWithAI}
                    disabled={analyzing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2 transition"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Analyze with AI
                  </button>
                )}
              </div>

              {/* Ads List */}
              {selectedJob.ads && selectedJob.ads.length > 0 && (
                <div className="space-y-4">
                  {selectedJob.ads.map((ad, index) => (
                    <AdCard
                      key={index}
                      ad={ad}
                      index={index}
                      expanded={expandedAds.has(index)}
                      onToggle={() => toggleAdExpanded(index)}
                      onViewScreenshot={() =>
                        setShowScreenshot(ad.landing_page_screenshot_url || null)
                      }
                      onCopy={copyToClipboard}
                      copiedText={copiedText}
                    />
                  ))}
                </div>
              )}

              {/* AI Analysis */}
              {selectedJob.aiAnalysis && (
                <AIAnalysisSection
                  analysis={selectedJob.aiAnalysis}
                  onCopy={copyToClipboard}
                  copiedText={copiedText}
                />
              )}

              {/* Error State */}
              {selectedJob.status === "failed" && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Search Failed</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{selectedJob.error}</p>
                </div>
              )}

              {/* Loading State */}
              {(selectedJob.status === "searching" ||
                selectedJob.status === "screenshotting") && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                    <p className="text-gray-400">
                      {selectedJob.status === "searching"
                        ? "Searching for ads..."
                        : "Capturing landing page screenshots..."}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedJob.progress}% complete
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Modal */}
      {showScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowScreenshot(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto">
            <button
              onClick={() => setShowScreenshot(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={showScreenshot}
              alt="Landing page screenshot"
              className="rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Ad Card Component
function AdCard({
  ad,
  index,
  expanded,
  onToggle,
  onViewScreenshot,
  onCopy,
  copiedText,
}: {
  ad: Ad;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onViewScreenshot: () => void;
  onCopy: (text: string) => void;
  copiedText: string | null;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer hover:bg-white/5 transition"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                #{ad.position} {ad.block_position}
              </span>
              {ad.source && (
                <span className="text-sm text-gray-400">{ad.source}</span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-medium text-blue-400">{ad.title}</h3>
            <p className="text-sm text-green-400 mt-1">{ad.displayed_link}</p>
            {ad.description && (
              <p className="text-sm text-gray-400 mt-2">{ad.description}</p>
            )}
          </div>
          <div className="ml-4">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-2 mt-3">
          {ad.rating && (
            <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-xs">
              <Star className="w-3 h-3 text-yellow-400" />
              {ad.rating}
              {ad.reviews && <span className="text-gray-500">({ad.reviews})</span>}
            </span>
          )}
          {ad.price && (
            <span className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-xs">
              <Tag className="w-3 h-3 text-green-400" />
              {ad.price}
            </span>
          )}
          {ad.extensions?.map((ext, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400"
            >
              {ext}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* Sitelinks */}
          {ad.sitelinks && ad.sitelinks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Sitelinks</h4>
              <div className="grid grid-cols-2 gap-2">
                {ad.sitelinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/5 rounded hover:bg-white/10 transition"
                  >
                    <div className="text-sm text-blue-400">{link.title}</div>
                    {link.snippet && (
                      <div className="text-xs text-gray-500 mt-1">{link.snippet}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={ad.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Visit Landing Page
            </a>
            {ad.landing_page_screenshot_url && (
              <button
                onClick={onViewScreenshot}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm flex items-center justify-center gap-2 transition"
              >
                <ImageIcon className="w-4 h-4" />
                View Screenshot
              </button>
            )}
          </div>

          {/* Copy Buttons */}
          <div className="flex gap-2">
            <CopyButton
              text={ad.title}
              label="Copy Headline"
              onCopy={onCopy}
              copiedText={copiedText}
            />
            {ad.description && (
              <CopyButton
                text={ad.description}
                label="Copy Description"
                onCopy={onCopy}
                copiedText={copiedText}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// AI Analysis Section
function AIAnalysisSection({
  analysis,
  onCopy,
  copiedText,
}: {
  analysis: AIAnalysis;
  onCopy: (text: string) => void;
  copiedText: string | null;
}) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold">AI Analysis</h3>
      </div>

      {/* Market Overview */}
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-2">Market Overview</h4>
        <p className="text-sm">{analysis.marketOverview}</p>
      </div>

      {/* Winning Patterns */}
      {analysis.winningPatterns && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Winning Patterns
          </h4>
          <div className="grid md:grid-cols-3 gap-4">
            {analysis.winningPatterns.headlines?.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <h5 className="text-xs font-medium text-blue-400 mb-2">
                  Headlines
                </h5>
                <ul className="text-sm space-y-1">
                  {analysis.winningPatterns.headlines.map((p, i) => (
                    <li key={i} className="text-gray-400">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.winningPatterns.descriptions?.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <h5 className="text-xs font-medium text-green-400 mb-2">
                  Descriptions
                </h5>
                <ul className="text-sm space-y-1">
                  {analysis.winningPatterns.descriptions.map((p, i) => (
                    <li key={i} className="text-gray-400">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.winningPatterns.extensions?.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3">
                <h5 className="text-xs font-medium text-yellow-400 mb-2">
                  Extensions
                </h5>
                <ul className="text-sm space-y-1">
                  {analysis.winningPatterns.extensions.map((p, i) => (
                    <li key={i} className="text-gray-400">
                      • {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">
            Recommended Copy (Ready to Use)
          </h4>
          <div className="space-y-4">
            {/* Headlines */}
            {analysis.recommendations.headlines?.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-blue-400 mb-2">
                  Headlines (30 char max)
                </h5>
                <div className="space-y-2">
                  {analysis.recommendations.headlines.map((headline, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                    >
                      <span className="text-sm font-medium">{headline}</span>
                      <CopyButton
                        text={headline}
                        onCopy={onCopy}
                        copiedText={copiedText}
                        small
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descriptions */}
            {analysis.recommendations.descriptions?.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-green-400 mb-2">
                  Descriptions (90 char max)
                </h5>
                <div className="space-y-2">
                  {analysis.recommendations.descriptions.map((desc, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between bg-white/5 rounded-lg p-3"
                    >
                      <span className="text-sm flex-1">{desc}</span>
                      <CopyButton
                        text={desc}
                        onCopy={onCopy}
                        copiedText={copiedText}
                        small
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sitelinks & Extensions */}
            <div className="grid md:grid-cols-2 gap-4">
              {analysis.recommendations.sitelinks?.length > 0 && (
                <div className="bg-white/5 rounded-lg p-3">
                  <h5 className="text-xs font-medium text-purple-400 mb-2">
                    Suggested Sitelinks
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {analysis.recommendations.sitelinks.map((link, i) => (
                      <span
                        key={i}
                        onClick={() => onCopy(link)}
                        className="px-2 py-1 bg-white/10 rounded text-sm cursor-pointer hover:bg-white/20 transition"
                      >
                        {link}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.recommendations.extensions?.length > 0 && (
                <div className="bg-white/5 rounded-lg p-3">
                  <h5 className="text-xs font-medium text-yellow-400 mb-2">
                    Suggested Extensions
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {analysis.recommendations.extensions.map((ext, i) => (
                      <span
                        key={i}
                        onClick={() => onCopy(ext)}
                        className="px-2 py-1 bg-white/10 rounded text-sm cursor-pointer hover:bg-white/20 transition"
                      >
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Differentiation Opportunities */}
      {analysis.differentiationOpportunities?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Differentiation Opportunities
          </h4>
          <ul className="space-y-2">
            {analysis.differentiationOpportunities.map((opp, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm bg-white/5 rounded-lg p-3"
              >
                <span className="text-green-400">💡</span>
                {opp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Competitor Insights */}
      {analysis.competitorInsights?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Competitor Insights
          </h4>
          <div className="space-y-3">
            {analysis.competitorInsights.map((insight, i) => (
              <details key={i} className="bg-white/5 rounded-lg">
                <summary className="p-3 cursor-pointer font-medium">
                  {insight.advertiser}
                </summary>
                <div className="px-3 pb-3 grid md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <h6 className="text-green-400 text-xs mb-1">Strengths</h6>
                    <ul className="text-gray-400">
                      {insight.strengths?.map((s, j) => (
                        <li key={j}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h6 className="text-red-400 text-xs mb-1">Weaknesses</h6>
                    <ul className="text-gray-400">
                      {insight.weaknesses?.map((w, j) => (
                        <li key={j}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h6 className="text-blue-400 text-xs mb-1">Copy Tactics</h6>
                    <ul className="text-gray-400">
                      {insight.copyTactics?.map((t, j) => (
                        <li key={j}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Copy Button Component
function CopyButton({
  text,
  label,
  onCopy,
  copiedText,
  small,
}: {
  text: string;
  label?: string;
  onCopy: (text: string) => void;
  copiedText: string | null;
  small?: boolean;
}) {
  const isCopied = copiedText === text;

  return (
    <button
      onClick={() => onCopy(text)}
      className={`flex items-center gap-1 transition ${
        small
          ? "p-1 hover:bg-white/10 rounded"
          : "px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm"
      }`}
    >
      {isCopied ? (
        <Check className={`${small ? "w-4 h-4" : "w-3 h-3"} text-green-400`} />
      ) : (
        <Copy className={`${small ? "w-4 h-4" : "w-3 h-3"} text-gray-400`} />
      )}
      {label && <span>{label}</span>}
    </button>
  );
}
