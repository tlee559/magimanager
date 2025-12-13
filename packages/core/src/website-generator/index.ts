/**
 * Website Generator Module
 *
 * Generates unique websites using AI (Gemini + Imagen) with preset themes.
 */

// Presets
export {
  // Types
  type ColorTheme,
  type LayoutPreset,
  type FontPairing,
  type AnimationPreset,
  type LogoIcon,
  type NicheType,
  type NicheDefinition,
  type FeatureLayout,
  type ButtonStyle,
  type CardStyle,
  type TypographyStyle,
  type HeroBackground,
  type HoverEffect,
  type OptionalSection,
  type NavLayout,
  type FooterLayout,
  type ThemedSymbolSet,

  // Data
  COLOR_THEMES,
  LAYOUT_PRESETS,
  FONT_PAIRINGS,
  ANIMATION_PRESETS,
  LOGO_ICONS,
  NICHES,
  SLOT_SYMBOLS,
  FEATURE_LAYOUTS,
  BUTTON_STYLES,
  CARD_STYLES,
  TYPOGRAPHY_STYLES,
  HERO_BACKGROUNDS,
  HOVER_EFFECTS,
  OPTIONAL_SECTIONS,
  NAV_LAYOUTS,
  FOOTER_LAYOUTS,
  THEMED_SYMBOL_SETS,

  // Functions
  selectRandomPresets,
  getTotalCombinations,
  selectOptionalSections,
  selectSymbolSet,
} from "./presets";

// Assembler
export {
  // Types
  type GeneratedContent,
  type GeneratedImages,
  type SelectedPresets,
  type AssembleOptions,

  // Functions
  assembleWebsiteFromFiles,
  getPresetInfo,
} from "./assembler";

// AI Services
export {
  // Types
  type GenerateContentOptions,
  type GenerateImagesOptions,
  type GenerateWebsiteContentOptions,
  type GeneratedWebsiteContent,
  type GeneratedImagesResult,

  // Functions
  generateContent,
  generateImages,
  generateWebsiteContent,
} from "./ai-services";
