import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  AD_TEMPLATES,
  getTemplatesByCategory,
  getTemplatesByStyle,
  searchTemplates,
  getRecommendedTemplates,
  getTemplateById,
  COLOR_SCHEMES,
} from "@/lib/ads-templates";

// GET /api/ai/ads-image-creator/templates - Get available templates
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const style = searchParams.get("style");
    const query = searchParams.get("q");
    const id = searchParams.get("id");
    const goal = searchParams.get("goal");
    const industry = searchParams.get("industry");

    // Get specific template by ID
    if (id) {
      const template = getTemplateById(id);
      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ template });
    }

    // Get recommended templates
    if (goal || industry || style) {
      const templates = getRecommendedTemplates({
        goal: goal || undefined,
        industry: industry || undefined,
        style: style || undefined,
      });
      return NextResponse.json({ templates, colorSchemes: COLOR_SCHEMES });
    }

    // Search templates
    if (query) {
      const templates = searchTemplates(query);
      return NextResponse.json({ templates, colorSchemes: COLOR_SCHEMES });
    }

    // Filter by category
    if (category) {
      const templates = getTemplatesByCategory(category as any);
      return NextResponse.json({ templates, colorSchemes: COLOR_SCHEMES });
    }

    // Filter by style
    if (style) {
      const templates = getTemplatesByStyle(style as any);
      return NextResponse.json({ templates, colorSchemes: COLOR_SCHEMES });
    }

    // Return all templates
    return NextResponse.json({
      templates: AD_TEMPLATES,
      colorSchemes: COLOR_SCHEMES,
      categories: [
        "ecommerce",
        "saas",
        "lead-gen",
        "brand-awareness",
        "app-install",
        "event",
        "offer",
        "comparison",
      ],
      styles: [
        "minimal",
        "bold",
        "elegant",
        "playful",
        "professional",
        "urgent",
        "lifestyle",
        "product-focused",
      ],
    });
  } catch (error) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
