/**
 * Embedded Website Templates
 *
 * Templates are embedded directly in the code for serverless compatibility.
 * No filesystem access required at runtime.
 */

// ============================================================================
// Base Templates
// ============================================================================

export const INDEX_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{META_DESCRIPTION}}">
  <title>{{SITE_NAME}} - {{TAGLINE}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{{GOOGLE_FONTS_URL}}" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{{FAVICON_SVG}}">
</head>
<body>
  <!-- Cookie Consent Banner -->
  <div id="cookie-banner" class="cookie-banner">
    <div class="cookie-content">
      <p>We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.</p>
      <div class="cookie-buttons">
        <button onclick="acceptCookies()" class="btn btn-primary">Accept</button>
        <a href="privacy.html" class="btn btn-secondary">Learn More</a>
      </div>
    </div>
  </div>

  <!-- Age Verification Modal (for social casino) -->
  {{AGE_VERIFICATION_MODAL}}

  <!-- Navigation -->
  {{NAV_HTML}}

  <!-- Mobile Menu -->
  <div id="mobile-menu" class="mobile-menu">
    <a href="index.html" class="active">Home</a>
    {{NAV_PLAY_LINK}}
    <a href="terms.html">Terms</a>
    <a href="privacy.html">Privacy</a>
  </div>

  <!-- Hero Section -->
  <section class="hero hero-{{LAYOUT_STYLE}}">
    <div class="hero-background">
      <img src="images/hero.png" alt="{{HERO_IMAGE_ALT}}" class="hero-image">
      <div class="hero-overlay"></div>
    </div>
    <div class="container hero-content">
      <h1 class="hero-title animate-fade-in">{{HERO_HEADLINE}}</h1>
      <p class="hero-subtitle animate-fade-in-delay">{{HERO_SUBHEADLINE}}</p>
      <div class="hero-cta animate-fade-in-delay-2">
        {{HERO_CTA_BUTTON}}
      </div>
      {{HERO_DISCLAIMER}}
    </div>
  </section>

  <!-- Features Section -->
  <section class="features" id="features">
    <div class="container">
      <h2 class="section-title">{{FEATURES_TITLE}}</h2>
      {{FEATURES_HTML}}
    </div>
  </section>

  <!-- About Section -->
  <section class="about">
    <div class="container">
      <div class="about-content animate-on-scroll">
        <h2>{{ABOUT_TITLE}}</h2>
        <p>{{ABOUT_DESCRIPTION}}</p>
        {{ABOUT_CTA}}
      </div>
    </div>
  </section>

  <!-- Optional Sections (Stats, Testimonials, FAQ, CTA Banner) -->
  {{OPTIONAL_SECTIONS_HTML}}

  <!-- Footer -->
  {{FOOTER_HTML}}

  <script>
    // Cookie consent
    function acceptCookies() {
      localStorage.setItem('cookiesAccepted', 'true');
      document.getElementById('cookie-banner').style.display = 'none';
    }

    if (localStorage.getItem('cookiesAccepted') === 'true') {
      document.getElementById('cookie-banner').style.display = 'none';
    }

    // Mobile menu
    function toggleMobileMenu() {
      document.getElementById('mobile-menu').classList.toggle('active');
      document.querySelector('.mobile-menu-btn').classList.toggle('active');
    }

    // Scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    {{AGE_VERIFICATION_SCRIPT}}
  </script>
</body>
</html>`;

export const TERMS_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Terms of Service for {{SITE_NAME}}">
  <title>Terms of Service - {{SITE_NAME}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{{GOOGLE_FONTS_URL}}" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{{FAVICON_SVG}}">
</head>
<body>
  <!-- Navigation -->
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">{{LOGO_ICON}}</span>
        <span class="logo-text">{{SITE_NAME}}</span>
      </a>
      <div class="nav-links">
        <a href="index.html">Home</a>
        {{NAV_PLAY_LINK}}
        <a href="terms.html" class="active">Terms</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </nav>

  <!-- Mobile Menu -->
  <div id="mobile-menu" class="mobile-menu">
    <a href="index.html">Home</a>
    {{NAV_PLAY_LINK}}
    <a href="terms.html" class="active">Terms</a>
    <a href="privacy.html">Privacy</a>
  </div>

  <!-- Content -->
  <main class="legal-page">
    <div class="container">
      <h1>Terms of Service</h1>
      <p class="last-updated">Last Updated: {{CURRENT_DATE}}</p>

      <section class="legal-section">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using {{SITE_NAME}} ("the Service"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.</p>
      </section>

      <section class="legal-section">
        <h2>2. Description of Service</h2>
        <p>{{TERMS_SERVICE_DESCRIPTION}}</p>
        {{TERMS_NO_GAMBLING_CLAUSE}}
      </section>

      <section class="legal-section">
        <h2>3. User Eligibility</h2>
        <p>You must be at least 18 years of age to use this Service. By using the Service, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.</p>
      </section>

      <section class="legal-section">
        <h2>4. User Accounts</h2>
        <p>Some features of the Service may require you to create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.</p>
      </section>

      <section class="legal-section">
        <h2>5. Virtual Items and Currency</h2>
        {{TERMS_VIRTUAL_CURRENCY}}
      </section>

      <section class="legal-section">
        <h2>6. Prohibited Conduct</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to any portion of the Service</li>
          <li>Use any automated system to access the Service</li>
          <li>Interfere with or disrupt the Service</li>
          <li>Impersonate any person or entity</li>
          {{TERMS_PROHIBITED_GAMBLING}}
        </ul>
      </section>

      <section class="legal-section">
        <h2>7. Intellectual Property</h2>
        <p>All content, features, and functionality of the Service are owned by {{SITE_NAME}} and are protected by international copyright, trademark, and other intellectual property laws.</p>
      </section>

      <section class="legal-section">
        <h2>8. Disclaimer of Warranties</h2>
        <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.</p>
      </section>

      <section class="legal-section">
        <h2>9. Limitation of Liability</h2>
        <p>IN NO EVENT SHALL {{SITE_NAME}} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE.</p>
      </section>

      <section class="legal-section">
        <h2>10. Changes to Terms</h2>
        <p>We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page with an updated effective date.</p>
      </section>

      <section class="legal-section">
        <h2>11. Contact Information</h2>
        <p>If you have any questions about these Terms, please contact us through our website.</p>
      </section>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <span class="logo-icon">{{LOGO_ICON}}</span>
            <span class="logo-text">{{SITE_NAME}}</span>
          </a>
        </div>
        <div class="footer-links">
          <h4>Legal</h4>
          <a href="terms.html">Terms of Service</a>
          <a href="privacy.html">Privacy Policy</a>
        </div>
      </div>
      {{RESPONSIBLE_GAMING_FOOTER}}
      <div class="footer-bottom">
        <p>&copy; {{CURRENT_YEAR}} {{SITE_NAME}}. All rights reserved.</p>
        {{NO_REAL_MONEY_DISCLAIMER}}
      </div>
    </div>
  </footer>

  <script>
    function toggleMobileMenu() {
      document.getElementById('mobile-menu').classList.toggle('active');
      document.querySelector('.mobile-menu-btn').classList.toggle('active');
    }
  </script>
</body>
</html>`;

export const PRIVACY_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Privacy Policy for {{SITE_NAME}}">
  <title>Privacy Policy - {{SITE_NAME}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{{GOOGLE_FONTS_URL}}" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{{FAVICON_SVG}}">
</head>
<body>
  <!-- Navigation -->
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">{{LOGO_ICON}}</span>
        <span class="logo-text">{{SITE_NAME}}</span>
      </a>
      <div class="nav-links">
        <a href="index.html">Home</a>
        {{NAV_PLAY_LINK}}
        <a href="terms.html">Terms</a>
        <a href="privacy.html" class="active">Privacy</a>
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </nav>

  <!-- Mobile Menu -->
  <div id="mobile-menu" class="mobile-menu">
    <a href="index.html">Home</a>
    {{NAV_PLAY_LINK}}
    <a href="terms.html">Terms</a>
    <a href="privacy.html" class="active">Privacy</a>
  </div>

  <!-- Content -->
  <main class="legal-page">
    <div class="container">
      <h1>Privacy Policy</h1>
      <p class="last-updated">Last Updated: {{CURRENT_DATE}}</p>

      <section class="legal-section">
        <h2>1. Introduction</h2>
        <p>{{SITE_NAME}} ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
      </section>

      <section class="legal-section">
        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li>Account information (email, username)</li>
          <li>Profile information you choose to share</li>
          <li>Communications with us</li>
        </ul>

        <h3>2.2 Automatically Collected Information</h3>
        <ul>
          <li>Device information (browser type, operating system)</li>
          <li>Usage data (pages visited, time spent)</li>
          <li>IP address and location data</li>
          <li>Cookies and similar technologies</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>3. How We Use Your Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide and maintain our Service</li>
          <li>Improve and personalize your experience</li>
          <li>Communicate with you about updates and promotions</li>
          <li>Analyze usage patterns to enhance our Service</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>4. Cookies and Tracking Technologies</h2>
        <p>We use cookies and similar tracking technologies to track activity on our Service and store certain information. You can instruct your browser to refuse all cookies or indicate when a cookie is being sent.</p>
        <h3>Types of Cookies We Use:</h3>
        <ul>
          <li><strong>Essential Cookies:</strong> Required for the Service to function</li>
          <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our Service</li>
          <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>5. Information Sharing</h2>
        <p>We may share your information with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Third parties that help us operate our Service</li>
          <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
          <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </section>

      <section class="legal-section">
        <h2>6. Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
      </section>

      <section class="legal-section">
        <h2>7. Data Retention</h2>
        <p>We retain your personal information for as long as necessary to provide our Service and fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law.</p>
      </section>

      <section class="legal-section">
        <h2>8. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Delete your information</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent</li>
        </ul>
      </section>

      <section class="legal-section">
        <h2>9. Children's Privacy</h2>
        <p>Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected such information, we will take steps to delete it.</p>
      </section>

      <section class="legal-section">
        <h2>10. International Data Transfers</h2>
        <p>Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws.</p>
      </section>

      <section class="legal-section">
        <h2>11. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>
      </section>

      <section class="legal-section">
        <h2>12. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or our data practices, please contact us through our website.</p>
      </section>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <span class="logo-icon">{{LOGO_ICON}}</span>
            <span class="logo-text">{{SITE_NAME}}</span>
          </a>
        </div>
        <div class="footer-links">
          <h4>Legal</h4>
          <a href="terms.html">Terms of Service</a>
          <a href="privacy.html">Privacy Policy</a>
        </div>
      </div>
      {{RESPONSIBLE_GAMING_FOOTER}}
      <div class="footer-bottom">
        <p>&copy; {{CURRENT_YEAR}} {{SITE_NAME}}. All rights reserved.</p>
        {{NO_REAL_MONEY_DISCLAIMER}}
      </div>
    </div>
  </footer>

  <script>
    function toggleMobileMenu() {
      document.getElementById('mobile-menu').classList.toggle('active');
      document.querySelector('.mobile-menu-btn').classList.toggle('active');
    }
  </script>
</body>
</html>`;

export const STYLE_TEMPLATE = `/* ============================================================================
   CSS Variables (replaced by generator)
   ============================================================================ */
:root {
  /* Colors */
  --color-primary: {{COLOR_PRIMARY}};
  --color-primary-rgb: {{COLOR_PRIMARY_RGB}};
  --color-secondary: {{COLOR_SECONDARY}};
  --color-secondary-rgb: {{COLOR_SECONDARY_RGB}};
  --color-accent: {{COLOR_ACCENT}};
  --color-accent-rgb: {{COLOR_ACCENT_RGB}};
  --color-background: {{COLOR_BACKGROUND}};
  --color-background-rgb: {{COLOR_BACKGROUND_RGB}};
  --color-surface: {{COLOR_SURFACE}};
  --color-surface-rgb: {{COLOR_SURFACE_RGB}};
  --color-text: {{COLOR_TEXT}};
  --color-text-muted: {{COLOR_TEXT_MUTED}};

  /* Fonts */
  --font-heading: '{{FONT_HEADING}}', sans-serif;
  --font-body: '{{FONT_BODY}}', sans-serif;

  /* Typography */
  --heading-weight: {{HEADING_WEIGHT}};
  --heading-transform: {{HEADING_TRANSFORM}};
  --heading-letter-spacing: {{HEADING_LETTER_SPACING}};
  --body-line-height: {{BODY_LINE_HEIGHT}};

  /* Animations */
  --animation-fade-in: {{ANIMATION_FADE_IN}};
  --animation-hover: {{ANIMATION_HOVER}};

  /* Spacing */
  --container-width: 1200px;
  --section-padding: 100px;
  --card-radius: 20px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.2);
  --shadow-glow: 0 0 40px rgba(var(--color-primary-rgb), 0.3);
}

/* ============================================================================
   Reset & Base
   ============================================================================ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  background-color: var(--color-background);
  color: var(--color-text);
  line-height: var(--body-line-height);
  min-height: 100vh;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--heading-weight);
  line-height: 1.2;
  text-transform: var(--heading-transform);
  letter-spacing: var(--heading-letter-spacing);
}

a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--color-secondary);
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

.container {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: 0 20px;
}

/* ============================================================================
   Buttons
   ============================================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 32px;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  {{BUTTON_STYLE_CSS}}
  border: none;
  cursor: pointer;
  transition: var(--animation-hover);
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
}

.btn-primary:hover {
  {{BUTTON_HOVER_EFFECT}}
  color: white;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-text-muted);
}

.btn-secondary:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.btn-large {
  padding: 18px 48px;
  font-size: 1.125rem;
  position: relative;
  overflow: hidden;
}

/* Shimmer effect on primary buttons */
.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.btn-primary:hover::before {
  left: 100%;
}

/* Button Style Variants */
.btn-pill {
  border-radius: 50px;
}

.btn-sharp {
  border-radius: 0;
}

.btn-gradient {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  background-size: 200% 200%;
  animation: gradient-shift 3s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.btn-neon {
  box-shadow:
    0 0 10px var(--color-primary),
    0 0 20px rgba(var(--color-primary-rgb), 0.3),
    0 0 30px rgba(var(--color-primary-rgb), 0.1);
}

.btn-neon:hover {
  box-shadow:
    0 0 20px var(--color-primary),
    0 0 40px rgba(var(--color-primary-rgb), 0.5),
    0 0 60px rgba(var(--color-primary-rgb), 0.3);
}

.btn-outline-style {
  background: transparent;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
}

.btn-outline-style:hover {
  background: var(--color-primary);
  color: white;
}

/* ============================================================================
   Navigation
   ============================================================================ */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.navbar .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 70px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.logo:hover {
  color: var(--color-primary);
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--color-primary);
}

.logo-icon svg {
  width: 32px;
  height: 32px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-links a {
  color: var(--color-text-muted);
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav-links a:hover,
.nav-links a.active {
  color: var(--color-text);
}

.mobile-menu-btn {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
}

.mobile-menu-btn span {
  width: 24px;
  height: 2px;
  background: var(--color-text);
  transition: transform 0.3s ease;
}

.mobile-menu-btn.active span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.mobile-menu-btn.active span:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.active span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.mobile-menu {
  display: none;
  position: fixed;
  top: 70px;
  left: 0;
  right: 0;
  background: var(--color-background);
  padding: 20px;
  flex-direction: column;
  gap: 16px;
  z-index: 999;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.mobile-menu.active {
  display: flex;
}

.mobile-menu a {
  color: var(--color-text);
  font-size: 1.125rem;
  padding: 10px 0;
}

/* ============================================================================
   Hero Section
   ============================================================================ */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding-top: 70px;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: {{HERO_OVERLAY_STYLE}};
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: var(--section-padding) 20px;
}

.hero-centered .hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero-left .hero-content {
  text-align: left;
  max-width: 600px;
}

.hero-title {
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  margin-bottom: 24px;
  background: linear-gradient(135deg, var(--color-text), var(--color-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: clamp(1.125rem, 2vw, 1.5rem);
  color: var(--color-text);
  margin-bottom: 40px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  opacity: 0.95;
}

.hero-left .hero-subtitle {
  margin-left: 0;
}

.hero-cta {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-left .hero-cta {
  justify-content: flex-start;
}

.hero-disclaimer {
  margin-top: 24px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  opacity: 0.7;
}

/* ============================================================================
   Features Section
   ============================================================================ */
.features {
  padding: var(--section-padding) 0;
  background: var(--color-surface);
}

.section-title {
  text-align: center;
  font-size: clamp(2rem, 4vw, 3rem);
  margin-bottom: 60px;
}

/* Base Features Grid - Simple responsive layout */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

/* Ensure consistent card sizing */
.features-grid .feature-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Feature Layout Variants - All use consistent grid */
.features-grid-equal,
.features-grid-large-first,
.features-grid-alternating,
.features-grid-stacked,
.features-grid-masonry {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  max-width: 1000px;
  margin: 0 auto;
}

/* Spacing between multiple feature grids (images section + icons section) */
.features-grid + .features-grid {
  margin-top: 48px;
}

/* Features with images section */
.features-with-images .feature-card {
  overflow: hidden;
}

.features-with-images .feature-image {
  margin: -32px -32px 0 -32px;
  overflow: hidden;
}

.features-with-images .feature-image img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.features-with-images .feature-content {
  padding: 24px 0 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Features with icons section */
.features-with-icons .feature-card {
  padding-top: 40px;
}

.features-with-icons .feature-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  border-radius: 16px;
  color: white;
  box-shadow: 0 8px 24px rgba(var(--color-primary-rgb), 0.3);
}

.features-with-icons .feature-icon svg {
  width: 36px;
  height: 36px;
}

.features-with-icons .feature-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Base Feature Card with Dynamic Styling */
.feature-card {
  {{CARD_STYLE_CSS}}
  padding: 32px;
  text-align: center;
  transition: var(--animation-hover);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-card:hover {
  {{CARD_HOVER_STYLE}}
}

/* Card Style Variants */
.card-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.card-gradient-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  border-radius: calc(var(--card-radius) + 2px);
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card-gradient-border:hover::before {
  opacity: 1;
}

.card-neon {
  box-shadow:
    0 0 20px rgba(var(--color-primary-rgb), 0.2),
    inset 0 0 20px rgba(var(--color-primary-rgb), 0.05);
}

.card-neon:hover {
  box-shadow:
    0 0 40px rgba(var(--color-primary-rgb), 0.4),
    inset 0 0 30px rgba(var(--color-primary-rgb), 0.1);
}

.feature-image {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
}

.feature-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feature-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  border-radius: 20px;
  color: white;
}

.feature-icon svg {
  width: 40px;
  height: 40px;
}

.feature-content {
  padding: 16px 0 0;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 12px;
  color: var(--color-text);
}

.feature-card p {
  color: var(--color-text-muted);
  line-height: 1.6;
}

/* ============================================================================
   About Section
   ============================================================================ */
.about {
  padding: var(--section-padding) 0;
}

.about-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.about h2 {
  font-size: clamp(2rem, 4vw, 3rem);
  margin-bottom: 24px;
}

.about p {
  font-size: 1.125rem;
  color: var(--color-text-muted);
  margin-bottom: 32px;
}

/* ============================================================================
   Footer
   ============================================================================ */
.footer {
  background: var(--color-surface);
  padding: 60px 0 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand .logo {
  margin-bottom: 16px;
}

.footer-tagline {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.footer-links h4 {
  font-size: 1rem;
  margin-bottom: 16px;
  color: var(--color-text);
}

.footer-links a {
  display: block;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  font-size: 0.875rem;
}

.footer-links a:hover {
  color: var(--color-primary);
}

.responsible-gaming {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
  text-align: center;
}

.responsible-gaming h4 {
  color: var(--color-secondary);
  margin-bottom: 8px;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.responsible-gaming p {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.footer-bottom {
  text-align: center;
  padding-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-bottom p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.no-real-money {
  margin-top: 12px;
  padding: 12px 24px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  display: inline-block;
}

.no-real-money p {
  color: #ffc107;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ============================================================================
   Legal Pages
   ============================================================================ */
.legal-page {
  padding: 120px 0 var(--section-padding);
}

.legal-page h1 {
  font-size: clamp(2rem, 4vw, 3rem);
  margin-bottom: 16px;
}

.last-updated {
  color: var(--color-text-muted);
  margin-bottom: 48px;
}

.legal-section {
  margin-bottom: 40px;
}

.legal-section h2 {
  font-size: 1.5rem;
  margin-bottom: 16px;
  color: var(--color-primary);
}

.legal-section h3 {
  font-size: 1.125rem;
  margin: 24px 0 12px;
  color: var(--color-secondary);
}

.legal-section p {
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

.legal-section ul {
  list-style: none;
  padding-left: 0;
}

.legal-section li {
  color: var(--color-text-muted);
  padding-left: 24px;
  position: relative;
  margin-bottom: 8px;
}

.legal-section li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: 50%;
}

/* ============================================================================
   Cookie Banner
   ============================================================================ */
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  z-index: 1001;
}

.cookie-content {
  max-width: var(--container-width);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.cookie-content p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  flex: 1;
  min-width: 200px;
}

.cookie-buttons {
  display: flex;
  gap: 12px;
}

.cookie-buttons .btn {
  padding: 10px 20px;
  font-size: 0.875rem;
}

/* ============================================================================
   Age Verification Modal
   ============================================================================ */
.age-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.age-modal-content {
  background: var(--color-surface);
  border-radius: var(--card-radius);
  padding: 48px;
  max-width: 500px;
  text-align: center;
  border: 1px solid var(--color-primary);
}

.age-modal h2 {
  font-size: 2rem;
  margin-bottom: 16px;
  color: var(--color-secondary);
}

.age-modal p {
  color: var(--color-text-muted);
  margin-bottom: 32px;
}

.age-modal .age-warning {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 32px;
}

.age-modal .age-warning p {
  color: #ffc107;
  font-size: 0.875rem;
  margin: 0;
}

.age-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* ============================================================================
   Animations
   ============================================================================ */
.animate-fade-in {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeIn 0.6s ease-out forwards;
}

.animate-fade-in-delay {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeIn 0.6s ease-out 0.2s forwards;
}

.animate-fade-in-delay-2 {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeIn 0.6s ease-out 0.4s forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-on-scroll {
  opacity: 0;
  transform: translateY(30px);
  transition: var(--animation-fade-in);
}

.animate-on-scroll.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ============================================================================
   Responsive
   ============================================================================ */
@media (max-width: 768px) {
  :root {
    --section-padding: 60px;
  }

  .nav-links {
    display: none;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .hero-content {
    padding: 60px 20px;
  }

  .hero-cta {
    flex-direction: column;
    align-items: center;
  }

  .hero-cta .btn {
    width: 100%;
    max-width: 300px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .footer-content {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .cookie-content {
    flex-direction: column;
    text-align: center;
  }

  .age-modal-content {
    padding: 32px 24px;
  }

  .age-buttons {
    flex-direction: column;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .testimonials-grid {
    grid-template-columns: 1fr;
  }

  .cta-banner {
    flex-direction: column;
    text-align: center;
    gap: 24px;
  }

  .footer-columns .footer-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
}

/* ============================================================================
   STATS SECTION
   ============================================================================ */
.stats-section {
  padding: 80px 0;
  background: linear-gradient(180deg, transparent 0%, rgba(var(--color-primary-rgb), 0.05) 50%, transparent 100%);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 40px;
  max-width: 1000px;
  margin: 0 auto;
}

.stat-item {
  text-align: center;
  padding: 30px 20px;
  background: var(--color-surface);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: var(--animation-hover);
}

.stat-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.stat-number {
  display: block;
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ============================================================================
   TESTIMONIALS SECTION
   ============================================================================ */
.testimonials-section {
  padding: var(--section-padding) 0;
  background: var(--color-surface);
}

.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  margin-top: 50px;
}

.testimonial-card {
  padding: 30px;
  border-radius: 16px;
  text-align: center;
  transition: var(--animation-hover);
}

.testimonial-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
}

.testimonial-stars {
  font-size: 1.5rem;
  margin-bottom: 20px;
}

.testimonial-text {
  font-size: 1rem;
  color: var(--color-text);
  line-height: 1.7;
  margin-bottom: 24px;
  font-style: italic;
}

.testimonial-author {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-name {
  font-weight: 600;
  color: var(--color-text);
}

.author-title {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* ============================================================================
   FAQ SECTION
   ============================================================================ */
.faq-section {
  padding: var(--section-padding) 0;
}

.faq-list {
  max-width: 800px;
  margin: 50px auto 0;
}

.faq-item {
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  transition: var(--animation-hover);
}

.faq-question {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-text);
  transition: background 0.3s ease;
}

.faq-question:hover {
  background: rgba(var(--color-primary-rgb), 0.1);
}

.faq-icon {
  font-size: 1.5rem;
  color: var(--color-primary);
  transition: transform 0.3s ease;
}

.faq-item.active .faq-icon {
  transform: rotate(45deg);
}

.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
}

.faq-item.active .faq-answer {
  max-height: 200px;
  padding: 0 24px 20px;
}

.faq-answer p {
  color: var(--color-text-muted);
  line-height: 1.7;
}

/* ============================================================================
   CTA BANNER SECTION
   ============================================================================ */
.cta-banner-section {
  padding: var(--section-padding) 0;
}

.cta-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 50px 60px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.2) 0%, rgba(var(--color-secondary-rgb), 0.2) 100%);
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
}

.cta-content h2 {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  margin-bottom: 12px;
}

.cta-content p {
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

/* ============================================================================
   NAV LAYOUT VARIANTS
   ============================================================================ */
.navbar-centered .container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 60px;
}

.navbar-centered .nav-left,
.navbar-centered .nav-right {
  display: flex;
  gap: 24px;
}

.navbar-centered .nav-left a,
.navbar-centered .nav-right a {
  color: var(--color-text-muted);
  font-weight: 500;
  transition: color 0.2s ease;
}

.navbar-centered .nav-left a:hover,
.navbar-centered .nav-right a:hover,
.navbar-centered .nav-left a.active,
.navbar-centered .nav-right a.active {
  color: var(--color-text);
}

.navbar-centered .logo {
  order: 0;
}

.navbar-minimal {
  background: transparent;
  box-shadow: none;
}

.navbar-minimal .container {
  justify-content: space-between;
}

.navbar-minimal .logo-text {
  display: none;
}

.navbar-split .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-split .nav-center {
  display: flex;
  gap: 24px;
}

.navbar-split .nav-center a {
  color: var(--color-text-muted);
  font-weight: 500;
  transition: color 0.2s ease;
}

.navbar-split .nav-center a:hover,
.navbar-split .nav-center a.active {
  color: var(--color-text);
}

.navbar-split .nav-cta .btn {
  padding: 8px 20px;
  font-size: 0.875rem;
}

/* ============================================================================
   FOOTER LAYOUT VARIANTS
   ============================================================================ */
.footer-centered {
  text-align: center;
}

.footer-centered .logo {
  display: inline-flex;
  margin-bottom: 16px;
}

.footer-centered .footer-tagline {
  margin-bottom: 24px;
}

.footer-links-inline {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 30px;
}

.footer-links-inline a {
  color: var(--color-text-muted);
}

.footer-links-inline a:hover {
  color: var(--color-primary);
}

.footer-links-inline .separator {
  color: var(--color-text-muted);
}

.footer-minimal {
  padding: 30px 0;
}

.footer-minimal .footer-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.footer-columns .footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-col h4 {
  font-size: 1rem;
  margin-bottom: 16px;
  color: var(--color-text);
}

.footer-col a {
  display: block;
  color: var(--color-text-muted);
  margin-bottom: 10px;
  font-size: 0.875rem;
}

.footer-col a:hover {
  color: var(--color-primary);
}

.footer-contact {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}`;

// ============================================================================
// Social Casino Templates
// ============================================================================

export const PLAY_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Play free social slots at {{SITE_NAME}} - No real money, just fun!">
  <title>Play Now - {{SITE_NAME}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="{{GOOGLE_FONTS_URL}}" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/slots.css">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,{{FAVICON_SVG}}">
</head>
<body>
  <!-- Cookie Consent Banner -->
  <div id="cookie-banner" class="cookie-banner">
    <div class="cookie-content">
      <p>We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.</p>
      <div class="cookie-buttons">
        <button onclick="acceptCookies()" class="btn btn-primary">Accept</button>
        <a href="privacy.html" class="btn btn-secondary">Learn More</a>
      </div>
    </div>
  </div>

  <!-- Age Verification Modal -->
  <div id="age-modal" class="age-modal">
    <div class="age-modal-content">
      <h2>Age Verification Required</h2>
      <p>You must be 18 years or older to access this site.</p>
      <div class="age-warning">
        <p>This is a social gaming site. No real money gambling. For entertainment purposes only.</p>
      </div>
      <div class="age-buttons">
        <button onclick="verifyAge()" class="btn btn-primary btn-large">I am 18 or older</button>
        <button onclick="denyAge()" class="btn btn-secondary">I am under 18</button>
      </div>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="logo">
        <span class="logo-icon">{{LOGO_ICON}}</span>
        <span class="logo-text">{{SITE_NAME}}</span>
      </a>
      <div class="nav-links">
        <a href="index.html">Home</a>
        <a href="play.html" class="active">Play</a>
        <a href="terms.html">Terms</a>
        <a href="privacy.html">Privacy</a>
      </div>
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </nav>

  <!-- Mobile Menu -->
  <div id="mobile-menu" class="mobile-menu">
    <a href="index.html">Home</a>
    <a href="play.html" class="active">Play</a>
    <a href="terms.html">Terms</a>
    <a href="privacy.html">Privacy</a>
  </div>

  <!-- Game Section -->
  <main class="game-page">
    <div class="container">
      <!-- Credits Display -->
      <div class="credits-bar">
        <div class="credits-display">
          <span class="credits-label">Credits</span>
          <span class="credits-value" id="credits">1,000</span>
        </div>
        <div class="win-display">
          <span class="win-label">Last Win</span>
          <span class="win-value" id="last-win">0</span>
        </div>
      </div>

      <!-- Slot Machine -->
      <div class="slot-machine">
        <div class="slot-header">
          <h1>{{GAME_NAME}}</h1>
          <p class="slot-tagline">{{GAME_TAGLINE}}</p>
        </div>

        <!-- Reels Container -->
        <div class="reels-container">
          <div class="reel-window">
            <div class="reel" id="reel-0">
              <div class="symbol">🍒</div>
              <div class="symbol">🍋</div>
              <div class="symbol">🍊</div>
            </div>
          </div>
          <div class="reel-window">
            <div class="reel" id="reel-1">
              <div class="symbol">🍇</div>
              <div class="symbol">💎</div>
              <div class="symbol">7️⃣</div>
            </div>
          </div>
          <div class="reel-window">
            <div class="reel" id="reel-2">
              <div class="symbol">📊</div>
              <div class="symbol">⭐</div>
              <div class="symbol">🍒</div>
            </div>
          </div>
          <div class="reel-window">
            <div class="reel" id="reel-3">
              <div class="symbol">🍋</div>
              <div class="symbol">🍊</div>
              <div class="symbol">🍇</div>
            </div>
          </div>
          <div class="reel-window">
            <div class="reel" id="reel-4">
              <div class="symbol">💎</div>
              <div class="symbol">7️⃣</div>
              <div class="symbol">📊</div>
            </div>
          </div>
        </div>

        <!-- Win Line Indicator -->
        <div class="win-line"></div>

        <!-- Controls -->
        <div class="slot-controls">
          <div class="bet-controls">
            <button class="btn btn-secondary" onclick="decreaseBet()">-</button>
            <div class="bet-display">
              <span class="bet-label">Bet</span>
              <span class="bet-value" id="current-bet">10</span>
            </div>
            <button class="btn btn-secondary" onclick="increaseBet()">+</button>
          </div>
          <button class="btn btn-primary btn-spin" id="spin-btn" onclick="spin()">
            <span class="spin-text">SPIN</span>
          </button>
          <button class="btn btn-secondary btn-max" onclick="maxBet()">MAX BET</button>
        </div>

        <!-- Win Message -->
        <div class="win-message" id="win-message">
          <div class="win-message-content">
            <span class="win-type" id="win-type">BIG WIN!</span>
            <span class="win-amount" id="win-amount">+500</span>
          </div>
        </div>
      </div>

      <!-- Paytable -->
      <div class="paytable">
        <h3>Paytable</h3>
        <div class="paytable-grid">
          <div class="paytable-item">
            <span class="paytable-symbols">7️⃣ 7️⃣ 7️⃣ 7️⃣ 7️⃣</span>
            <span class="paytable-multiplier">x100</span>
          </div>
          <div class="paytable-item">
            <span class="paytable-symbols">💎 💎 💎 💎 💎</span>
            <span class="paytable-multiplier">x50</span>
          </div>
          <div class="paytable-item">
            <span class="paytable-symbols">📊 📊 📊 📊 📊</span>
            <span class="paytable-multiplier">x25</span>
          </div>
          <div class="paytable-item">
            <span class="paytable-symbols">⭐ ⭐ ⭐ ⭐ ⭐</span>
            <span class="paytable-multiplier">x15</span>
          </div>
          <div class="paytable-item">
            <span class="paytable-symbols">🍇 🍇 🍇 🍇 🍇</span>
            <span class="paytable-multiplier">x10</span>
          </div>
          <div class="paytable-item">
            <span class="paytable-symbols">Any 3+ matching</span>
            <span class="paytable-multiplier">x2-x5</span>
          </div>
        </div>
      </div>

      <!-- Disclaimers -->
      <div class="game-disclaimers">
        <div class="disclaimer-box">
          <p><strong>FOR ENTERTAINMENT ONLY</strong></p>
          <p>This is a social gaming experience. No real money is involved. Virtual credits have no cash value and cannot be exchanged for real money or prizes.</p>
        </div>
        <div class="disclaimer-box warning">
          <p><strong>18+ ONLY</strong></p>
          <p>This site is intended for adult audiences only. Please play responsibly.</p>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <span class="logo-icon">{{LOGO_ICON}}</span>
            <span class="logo-text">{{SITE_NAME}}</span>
          </a>
        </div>
        <div class="footer-links">
          <h4>Legal</h4>
          <a href="terms.html">Terms of Service</a>
          <a href="privacy.html">Privacy Policy</a>
        </div>
      </div>
      <div class="responsible-gaming">
        <h4>Responsible Gaming</h4>
        <p>This is a free-to-play social gaming site. No real money gambling. If you or someone you know has a gambling problem, please seek help.</p>
      </div>
      <div class="footer-bottom">
        <p>&copy; {{CURRENT_YEAR}} {{SITE_NAME}}. All rights reserved.</p>
        <div class="no-real-money">
          <p>NO REAL MONEY - FOR ENTERTAINMENT PURPOSES ONLY</p>
        </div>
      </div>
    </div>
  </footer>

  <script src="js/slots.js"></script>
  <script>
    // Cookie consent
    function acceptCookies() {
      localStorage.setItem('cookiesAccepted', 'true');
      document.getElementById('cookie-banner').style.display = 'none';
    }

    if (localStorage.getItem('cookiesAccepted') === 'true') {
      document.getElementById('cookie-banner').style.display = 'none';
    }

    // Age verification
    function verifyAge() {
      localStorage.setItem('ageVerified', 'true');
      document.getElementById('age-modal').style.display = 'none';
    }

    function denyAge() {
      window.location.href = 'https://www.google.com';
    }

    // Check age verification status - show modal if not verified
    (function checkAge() {
      const modal = document.getElementById('age-modal');
      if (localStorage.getItem('ageVerified') === 'true') {
        modal.style.display = 'none';
      } else {
        // Ensure modal is visible and on top
        modal.style.display = 'flex';
        modal.style.zIndex = '9999';
      }
    })();

    // Mobile menu
    function toggleMobileMenu() {
      document.getElementById('mobile-menu').classList.toggle('active');
      document.querySelector('.mobile-menu-btn').classList.toggle('active');
    }
  </script>
</body>
</html>`;

export const SLOTS_CSS_TEMPLATE = `/* ============================================================================
   Slot Machine Styles
   ============================================================================ */

.game-page {
  padding: 100px 0 60px;
  min-height: 100vh;
}

/* Credits Bar */
.credits-bar {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 30px;
  padding: 20px;
  background: var(--color-surface);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.credits-display,
.win-display {
  text-align: center;
}

.credits-label,
.win-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.credits-value {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-secondary);
}

.win-value {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
}

/* Slot Machine Container */
.slot-machine {
  position: relative;
  max-width: 800px;
  margin: 0 auto 40px;
  padding: 40px;
  background: linear-gradient(180deg, var(--color-surface) 0%, rgba(0, 0, 0, 0.5) 100%);
  border-radius: 24px;
  border: 2px solid var(--color-primary);
  box-shadow:
    0 0 60px rgba(var(--color-primary-rgb, 107, 33, 168), 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.slot-header {
  text-align: center;
  margin-bottom: 30px;
}

.slot-header h1 {
  font-size: 2rem;
  background: linear-gradient(135deg, var(--color-secondary), var(--color-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.slot-tagline {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* Reels Container */
.reels-container {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.reel-window {
  width: 100px;
  height: 260px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 10%, rgba(0, 0, 0, 0.4) 90%, rgba(0, 0, 0, 0.8) 100%);
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  position: relative;
}

.reel-window::before,
.reel-window::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 2;
  pointer-events: none;
}

.reel-window::before {
  top: 0;
  background: linear-gradient(180deg, var(--color-background) 0%, transparent 100%);
}

.reel-window::after {
  bottom: 0;
  background: linear-gradient(0deg, var(--color-background) 0%, transparent 100%);
}

.reel {
  display: flex;
  flex-direction: column;
  transition: transform 0.1s ease-out;
}

.symbol {
  width: 100px;
  height: 86.67px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  flex-shrink: 0;
}

/* Win Line */
.win-line {
  position: absolute;
  left: 50px;
  right: 50px;
  top: 50%;
  height: 4px;
  background: var(--color-secondary);
  border-radius: 2px;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 0 20px var(--color-secondary);
  z-index: 10;
}

.win-line.active {
  animation: winLinePulse 0.5s ease-in-out infinite;
}

@keyframes winLinePulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Controls */
.slot-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
}

.bet-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bet-controls .btn {
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.bet-display {
  text-align: center;
  min-width: 80px;
}

.bet-label {
  display: block;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-muted);
}

.bet-value {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.btn-spin {
  width: 140px;
  height: 60px;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 2px;
  position: relative;
  overflow: hidden;
}

.btn-spin::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transform: rotate(45deg);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%) rotate(45deg); }
  100% { transform: translateX(100%) rotate(45deg); }
}

.btn-spin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-spin.spinning .spin-text {
  animation: spinTextPulse 0.3s infinite;
}

@keyframes spinTextPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.btn-max {
  padding: 12px 20px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Win Message */
.win-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 24px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 20;
}

.win-message.active {
  opacity: 1;
  visibility: visible;
}

.win-message-content {
  text-align: center;
  animation: winBounce 0.5s ease-out;
}

@keyframes winBounce {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.win-type {
  display: block;
  font-family: var(--font-heading);
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-secondary);
  text-shadow: 0 0 20px var(--color-secondary);
  margin-bottom: 10px;
}

.win-amount {
  display: block;
  font-family: var(--font-heading);
  font-size: 4rem;
  font-weight: 900;
  color: var(--color-accent);
  text-shadow: 0 0 30px var(--color-accent);
}

/* Paytable */
.paytable {
  max-width: 600px;
  margin: 0 auto 40px;
  padding: 24px;
  background: var(--color-surface);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.paytable h3 {
  text-align: center;
  font-size: 1.25rem;
  margin-bottom: 20px;
  color: var(--color-secondary);
}

.paytable-grid {
  display: grid;
  gap: 12px;
}

.paytable-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.paytable-symbols {
  font-size: 1.25rem;
  letter-spacing: 4px;
}

.paytable-multiplier {
  font-family: var(--font-heading);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-accent);
}

/* Game Disclaimers */
.game-disclaimers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.disclaimer-box {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.disclaimer-box strong {
  color: var(--color-text);
}

.disclaimer-box p {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin: 0;
}

.disclaimer-box p + p {
  margin-top: 8px;
}

.disclaimer-box.warning {
  border-color: rgba(255, 193, 7, 0.3);
  background: rgba(255, 193, 7, 0.05);
}

.disclaimer-box.warning strong {
  color: #ffc107;
}

/* Responsive */
@media (max-width: 600px) {
  .slot-machine {
    padding: 20px;
  }

  .reels-container {
    gap: 4px;
    padding: 12px;
  }

  .reel-window {
    width: 60px;
    height: 180px;
  }

  .symbol {
    width: 60px;
    height: 60px;
    font-size: 2rem;
  }

  .slot-controls {
    flex-direction: column;
    gap: 16px;
  }

  .credits-bar {
    flex-direction: column;
    gap: 16px;
  }

  .credits-value,
  .win-value {
    font-size: 1.5rem;
  }

  .win-type {
    font-size: 1.5rem;
  }

  .win-amount {
    font-size: 2.5rem;
  }

  .paytable-symbols {
    font-size: 1rem;
    letter-spacing: 2px;
  }
}`;

export const SLOTS_JS_TEMPLATE = `/**
 * Social Casino Slot Machine
 *
 * A free-to-play slot machine game for entertainment only.
 * No real money involved - virtual credits have no cash value.
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration (Themed Symbols)
  // ============================================================================

  // Theme: {{SLOT_THEME_NAME}}
  const SYMBOLS = {{SLOT_SYMBOLS_JSON}};
  const MULTIPLIERS = {{SLOT_MULTIPLIERS_JSON}};

  const REEL_COUNT = 5;
  const VISIBLE_SYMBOLS = 3;
  const SYMBOL_HEIGHT = 86.67;
  const SPIN_DURATION = 2000;
  const REEL_DELAY = 200;

  const MIN_BET = 10;
  const MAX_BET = 100;
  const BET_INCREMENT = 10;
  const STARTING_CREDITS = 1000;

  // ============================================================================
  // State
  // ============================================================================

  let credits = parseInt(localStorage.getItem('slotCredits')) || STARTING_CREDITS;
  let currentBet = MIN_BET;
  let isSpinning = false;
  let reelSymbols = [];

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const creditsDisplay = document.getElementById('credits');
  const lastWinDisplay = document.getElementById('last-win');
  const betDisplay = document.getElementById('current-bet');
  const spinButton = document.getElementById('spin-btn');
  const winMessage = document.getElementById('win-message');
  const winType = document.getElementById('win-type');
  const winAmount = document.getElementById('win-amount');
  const winLine = document.querySelector('.win-line');

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    // Initialize each reel with random symbols
    for (let i = 0; i < REEL_COUNT; i++) {
      reelSymbols[i] = generateReelSymbols();
      renderReel(i);
    }

    updateDisplay();
  }

  function generateReelSymbols() {
    // Generate a strip of symbols (more than visible for smooth animation)
    const strip = [];
    for (let i = 0; i < 30; i++) {
      strip.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }
    return strip;
  }

  function renderReel(reelIndex) {
    const reel = document.getElementById(\`reel-\${reelIndex}\`);
    reel.innerHTML = '';

    reelSymbols[reelIndex].forEach(symbol => {
      const div = document.createElement('div');
      div.className = 'symbol';
      div.textContent = symbol;
      reel.appendChild(div);
    });
  }

  // ============================================================================
  // Display Updates
  // ============================================================================

  function updateDisplay() {
    creditsDisplay.textContent = credits.toLocaleString();
    betDisplay.textContent = currentBet;

    // Save credits to localStorage
    localStorage.setItem('slotCredits', credits);
  }

  function showWinMessage(amount, type) {
    winType.textContent = type;
    winAmount.textContent = \`+\${amount.toLocaleString()}\`;
    winMessage.classList.add('active');
    winLine.classList.add('active');

    setTimeout(() => {
      winMessage.classList.remove('active');
      winLine.classList.remove('active');
    }, 2000);
  }

  // ============================================================================
  // Bet Controls
  // ============================================================================

  window.increaseBet = function() {
    if (currentBet < MAX_BET && currentBet < credits) {
      currentBet = Math.min(currentBet + BET_INCREMENT, MAX_BET, credits);
      updateDisplay();
    }
  };

  window.decreaseBet = function() {
    if (currentBet > MIN_BET) {
      currentBet = Math.max(currentBet - BET_INCREMENT, MIN_BET);
      updateDisplay();
    }
  };

  window.maxBet = function() {
    currentBet = Math.min(MAX_BET, credits);
    updateDisplay();
  };

  // ============================================================================
  // Spin Logic
  // ============================================================================

  window.spin = function() {
    if (isSpinning || credits < currentBet) return;

    isSpinning = true;
    spinButton.disabled = true;
    spinButton.classList.add('spinning');

    // Deduct bet
    credits -= currentBet;
    lastWinDisplay.textContent = '0';
    updateDisplay();

    // Generate new results
    const results = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      results.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }

    // Animate each reel
    const promises = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      promises.push(spinReel(i, results[i], i * REEL_DELAY));
    }

    // Wait for all reels to stop
    Promise.all(promises).then(() => {
      // Check for wins
      const win = calculateWin(results);

      if (win > 0) {
        credits += win;
        lastWinDisplay.textContent = win.toLocaleString();
        updateDisplay();

        // Show win message based on amount
        let type = 'WIN!';
        if (win >= currentBet * 10) type = 'MEGA WIN!';
        else if (win >= currentBet * 5) type = 'BIG WIN!';
        else if (win >= currentBet * 2) type = 'NICE WIN!';

        showWinMessage(win, type);
      }

      // Reset for next spin
      isSpinning = false;
      spinButton.disabled = false;
      spinButton.classList.remove('spinning');

      // Auto-refill if out of credits (it's free to play!)
      if (credits < MIN_BET) {
        setTimeout(() => {
          credits = STARTING_CREDITS;
          updateDisplay();
        }, 1500);
      }
    });
  };

  function spinReel(reelIndex, targetSymbol, delay) {
    return new Promise(resolve => {
      setTimeout(() => {
        const reel = document.getElementById(\`reel-\${reelIndex}\`);

        // Regenerate symbols with target at center position
        const newSymbols = [];

        // Add random symbols before
        for (let i = 0; i < 20; i++) {
          newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        }

        // Add final symbols (target in center)
        newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
        newSymbols.push(targetSymbol);
        newSymbols.push(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

        reelSymbols[reelIndex] = newSymbols;
        renderReel(reelIndex);

        // Reset position
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';

        // Force reflow
        reel.offsetHeight;

        // Animate to final position
        const finalOffset = -(newSymbols.length - VISIBLE_SYMBOLS) * SYMBOL_HEIGHT;
        reel.style.transition = \`transform \${SPIN_DURATION - delay}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)\`;
        reel.style.transform = \`translateY(\${finalOffset}px)\`;

        setTimeout(resolve, SPIN_DURATION - delay);
      }, delay);
    });
  }

  // ============================================================================
  // Win Calculation
  // ============================================================================

  function calculateWin(results) {
    let totalWin = 0;

    // Check for consecutive matches from left
    let matchCount = 1;
    const firstSymbol = results[0];

    for (let i = 1; i < results.length; i++) {
      if (results[i] === firstSymbol) {
        matchCount++;
      } else {
        break;
      }
    }

    // Calculate win based on matches
    if (matchCount >= 3) {
      const baseMultiplier = MULTIPLIERS[firstSymbol] || 2;
      let winMultiplier = baseMultiplier;

      // Bonus for more matches
      if (matchCount === 4) winMultiplier *= 2;
      if (matchCount === 5) winMultiplier *= 5;

      totalWin = currentBet * winMultiplier;
    }

    // Check for any 3 of a kind (not consecutive)
    if (totalWin === 0) {
      const symbolCounts = {};
      results.forEach(s => {
        symbolCounts[s] = (symbolCounts[s] || 0) + 1;
      });

      for (const [symbol, count] of Object.entries(symbolCounts)) {
        if (count >= 3) {
          const baseMultiplier = MULTIPLIERS[symbol] || 2;
          // Reduced multiplier for non-consecutive
          totalWin = Math.max(totalWin, currentBet * Math.floor(baseMultiplier / 2));
        }
      }
    }

    return totalWin;
  }

  // ============================================================================
  // Initialize on Load
  // ============================================================================

  init();

})();`;
