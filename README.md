# Pixel Perfect Portal

PIXEL-PERFECT IMPLEMENTATION REQUIREMENT

The attached Admin Login reference image is the exact visual source of truth for this page.

Recreate the UI as close to pixel-to-pixel as technically possible.

Do NOT redesign, reinterpret, simplify, modernize, or create your own variation of the design.

Match the reference precisely, including:

Overall 16:9 composition

Left/right panel proportions

Exact positioning and sizing of the CobraLearn logo

“LEARN • BUILD • GROW” placement

Main “CobraLearn Innotechcore” typography, sizing, spacing and alignment

“Admin Portal” text

Left-side futuristic environment

CobraLearn emblem/3D centerpiece

Floating dashboard panels

Rocks, floor reflections, lighting and atmospheric effects

Green/emerald glow

Controlled orange/gold lighting

Right login card position, dimensions and border radius

Glowing cyan/green border

Card transparency/glass effect

Heading hierarchy and exact text placement

Email and password field dimensions

Icons and their positions

Forgot password position

Sign In button dimensions, gradient/glow and arrow

Divider and “OR CONTINUE WITH”

SSO button

Internal spacing between every element

Shadows, reflections, glow intensity and visual depth

Do not change the layout simply because another arrangement may be considered better UX.

The reference image takes priority over generic design conventions.

The implementation should reproduce the same visual hierarchy, proportions, spacing, alignment, colors, lighting and composition.

Only make changes that are technically necessary for the page to function responsively.

This is an implementation of the provided design — not a new design based on the provided design.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Security & Deployment Architecture

### 1. Trusted Reverse Proxy & Edge IP Resolution
The application extracts client IP information to enforce server-side rate limits on administrative login and password recovery:
- Client IP headers such as `CF-Connecting-IP`, `True-Client-IP`, and `X-Real-IP` must only be trusted when supplied or overwritten by a verified, trusted edge proxy (such as Cloudflare, AWS CloudFront/ALB, or an enterprise reverse proxy).
- The edge proxy must explicitly strip or overwrite untrusted client-supplied versions of these headers before requests reach the application server.
- The application must not assume these headers are authentic when directly exposed to the public internet without an intervening verified proxy.
- Deployment-specific trusted-proxy assumptions must be independently verified in each target hosting environment before production deployment.

### 2. Production Secrets Configuration
- **`RATE_LIMIT_SECRET`**: Required production environment secret. Used to compute privacy-preserving keyed HMAC hashes of sensitive account identifiers and IP addresses for limiter keys.
- **Prerequisite**: This secret must be configured in production hosting environment variables before deployment. While the codebase contains an internal development fallback to prevent unhandled exceptions during local testing, this fallback must not be relied upon in production.
- Never commit or expose secret values in version control or client-side bundles.
