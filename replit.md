# G Marques Imóveis - Real Estate Portal

## Overview

G Marques Imóveis is a modern real estate portal designed for the Brazilian market, focusing exclusively on properties for sale. It provides advanced property browsing, neighborhood exploration, and direct agency contact for users. The platform includes a comprehensive admin panel for managing properties, clients, owners, financial transactions, and site content. The project aims to deliver a robust, user-friendly experience for both property seekers and administrators, with a professional blue and gold aesthetic.

## User Preferences

Preferred communication style: Simple, everyday language.
UI/UX Preferences: No toast notifications - user prefers silent operations without popup notifications.
Business Rules: The system works EXCLUSIVELY with properties for sale. Rental properties are not accepted.

## Recent Updates

### Property Image Gallery Modernization (October 2025)
The property detail page image gallery was redesigned for optimal viewing experience and modern aesthetics:

**Modal Popup:**
- **Viewport Containment**: All modal content (header, image, navigation, footer) fits within the viewport without scrolling on any screen size
- **Image Sizing**: Images use `object-contain` with calculated padding (64px top for header, 80px bottom for footer) ensuring they never exceed modal bounds
- **Modern Navigation**: Navigation arrows feature gradient backgrounds, subtle borders, shadow effects, and smooth hover/active transitions for a clean, contemporary look
- **Responsive Design**: Navigation controls adapt sizing from mobile (left-3, h-6 icons) to desktop (left-6, h-8 icons)

**Main Gallery:**
- **Consistent Design**: Navigation arrows and expand button now share the same modern styling as the modal
- **Visual Effects**: Gradient backgrounds (from-white/20 to-white/10), borders (border-white/30), shadows (shadow-lg), and smooth animations
- **Hover Reveal**: Controls appear elegantly on image hover with opacity transitions
- **Shape**: Modern rounded-xl corners replacing older rounded-full/rounded-lg styles

**General:**
- **Accessibility**: Added aria-labels to all navigation buttons
- **Icon Enhancement**: Increased strokeWidth to 2.5 for better contrast and visibility
- **Performance**: Maintained existing functionality while improving visual appeal

## System Architecture

### Frontend

The frontend uses React 18 with TypeScript and Vite. Routing is handled by Wouter, and server state by TanStack Query. UI components are built with shadcn/ui, styled with Tailwind CSS and CVA, following a custom blue and gold gradient palette. Framer Motion provides page entry animations. State management utilizes React Query, React Hook Form with Zod, and custom hooks. The design is mobile-first and responsive.

### Backend

The backend is an Express.js server on Node.js with TypeScript, providing a RESTful API. It uses Supabase PostgreSQL with Drizzle ORM for data persistence. Key entities include Users, Properties (sale only, with auto-generated SEO-friendly slugs), Neighborhoods, Clients, and Financial Transactions. Authentication is handled by simple login/password with role-based access control. Ollama AI (`gpt-oss:20b-cloud`) generates property descriptions and titles, always assuming "sale" status. Supabase Storage is used for image uploads, with Sharp library applying watermarks and generating multiple optimized WebP image sizes (thumbnail, medium, original) and handling responsive images.

### API Architecture

The API includes public endpoints for property listings, details, and content, and protected admin endpoints for CRUD operations. Special admin endpoints support web scraping, batch data correction, image re-import, slug regeneration, AI suggestions, watermark image upload, and audio transcription via OpenAI Whisper API. All communication uses JSON with Zod validation.

#### Batch Data Correction Tools

The system includes automated tools for bulk data maintenance:

- **Condominium Type Correction**: `/api/admin/fix-condominium-types` endpoint analyzes property titles and descriptions using regex patterns to identify condominiums (keywords: "condomínio", "cond.", "em condomínio", etc.) and automatically updates the property type to 'condominio'. This ensures consistent classification across the database.

### Design System

The design system features a primary blue gradient and an accent gold gradient, with a neutral palette. It uses modern sans-serif fonts and emphasizes card-based layouts, rounded corners, subtle shadows, and Lucide React icons.

### Admin Intelligence Features

The admin panel includes an "Evolut IA" page with:
- **Chat Interface with Audio Recording**: Allows recording audio, which is transcribed using OpenAI Whisper API and inserted into the chat input.
- **Property Search with AI**: Enables natural language property searches using a two-step AI process:
  1. **Perplexity API** (`sonar-pro` model) searches for properties exclusively in São Sebastião - SP region
  2. **OpenAI API** (`gpt-4o-mini` model) creates an elaborate, professional response based on the user's question and Perplexity's search results
  - Search results are restricted to properties for sale in São Sebastião - SP only
- **Action Confirmation UI**: When the bot requests confirmation for an action (e.g., creating a client, property, etc.), a simple blue "Confirmar" button appears directly below the bot's message, using the same primary color as the send button for visual consistency.

### Image Security System

The platform includes a comprehensive image protection system to prevent unauthorized downloads and sharing:

#### Security Features
- **Token-based Access Control**: Temporary, time-limited tokens (default: 30min) for image viewing
- **SSRF Protection**: Strict domain whitelist - only exact Supabase project hostname allowed
- **Canvas Rendering**: Images rendered via HTML5 canvas, original URLs never exposed
- **Frontend Protections**: Disabled right-click, drag-drop, text selection, copy/paste, and transparent overlay
- **DevTools Detection**: Alerts when developer tools are opened
- **Rate Limiting**: IP-based access limits to prevent abuse
- **Comprehensive Logging**: All access attempts logged with IP, user-agent, timestamp, and outcome
- **Security Alerts**: Automated detection of suspicious patterns (SSRF attempts, excessive failed attempts, etc.)

#### Components
- **SecuredImage Component** (`client/src/components/SecuredImage.tsx`): Frontend component with all protection layers
- **Image Security Module** (`server/imageSecurity.ts`): Backend token generation, validation, and logging
- **Admin Panel** (`/admin/image-security`): Real-time monitoring, access logs, security settings, and alerts
- **Database Schema** (`shared/schema.ts`): Tables for tokens, access logs, and security settings

#### Usage
Protected images are accessed through `/api/secure-image?token=...` endpoint, which validates tokens, streams image bytes, and logs access. Frontend components use the SecuredImage wrapper to automatically handle token generation and security measures.

For detailed documentation, see `SECURITY_IMAGES.md`.

## External Dependencies

### Third-Party Services

-   **Supabase**: PostgreSQL database and object storage.
-   **Ollama AI**: AI for content generation.
-   **Perplexity AI**: AI for property search.
-   **OpenAI Whisper API**: Audio transcription.

### Key NPM Packages

-   `@radix-ui/react-*`: UI component primitives.
-   `@tanstack/react-query`: Server state management.
-   `@supabase/supabase-js`: Supabase client.
-   `drizzle-orm`, `drizzle-kit`, `pg`: Database ORM.
-   `zod`: Runtime type validation.
-   `react-hook-form`: Form management.
-   `wouter`: Routing.
-   `sharp`: Image processing.

### Environment Variables Required

-   `SUPABASE`: PostgreSQL connection string.
-   `SUPABASE_ANON_KEY`, `SUPABASE_URL`: Supabase project keys.
-   `SESSION_SECRET`: Session encryption key.
-   `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`: Ollama AI configuration.
-   `LOGIN`, `SENHA`: Admin credentials for simple login/password authentication.
-   `PERPLEXITY_API_KEY`: Perplexity AI access.
-   `NODE_ENV`: Set to `production` for production deployments.
-   `PORT`: Application port (automatically set by hosting platform, defaults to 5000).

## Deployment

### Easypanel with Heroku Buildpacks

The project is configured to deploy on Easypanel using the Heroku Buildpacks method with `heroku/builder:24`. 

#### Configuration Files

1. **project.toml**: Specifies the Heroku builder and Node.js buildpack
2. **Procfile**: Defines the production start command (`web: npm start`)
3. **package.json**: Includes `build` and `start` scripts, plus `engines` section specifying Node.js 20.x and npm 10.x

#### Build Process

The Heroku buildpack automatically executes the following steps:
1. **Install Phase**: Runs `npm ci` to install all dependencies from package-lock.json
2. **Build Phase**: Executes `npm run build` which runs `vite build` to compile the frontend to `dist/public/`
3. **Prune Phase**: Runs `npm prune` to remove dev dependencies (but keeps all deps since TypeScript is needed in production)

#### Production Configuration

In production mode (`NODE_ENV=production`):
- Server uses `tsx` to run TypeScript directly: `tsx server/index.ts`
- Server binds to `0.0.0.0` (container-compatible) on the port specified by `PORT` env var (defaults to 5000)
- Server serves pre-built static files from `dist/public/` directory instead of running Vite dev server
- The `serveStatic` function in `server/vite.ts` validates that `dist/public/` exists and serves files from there

**Important**: The server must find the built frontend at `dist/public/` (not just `public/`). This path is configured in:
- `vite.config.ts`: `build.outDir = "dist/public"`
- `server/vite.ts`: `serveStatic` function looks for `dist/public/`

#### Deployment Steps on Easypanel

1. Create a new App in Easypanel
2. Connect your Git repository
3. Select "Buildpacks" as the build method
4. Specify `heroku/builder:24` as the builder (automatically configured via `project.toml`)
5. Set all required environment variables in the Environment tab:
   - `SUPABASE`: PostgreSQL connection string
   - `SUPABASE_ANON_KEY`: Supabase anonymous key
   - `SUPABASE_URL`: Supabase project URL
   - `SESSION_SECRET`: Secret for session encryption
   - `LOGIN`: Admin username
   - `SENHA`: Admin password
   - `AI_INTEGRATIONS_OPENAI_BASE_URL`: Ollama AI base URL
   - `AI_INTEGRATIONS_OPENAI_API_KEY`: Ollama AI API key
   - `PERPLEXITY_API_KEY`: Perplexity AI API key
   - `NODE_ENV`: Set to `production`
   - `PORT`: (Optional) Set by platform, defaults to 5000
6. Deploy the application

The buildpack will automatically detect Node.js via `package.json`, install dependencies, run the build script, and start the application using the command defined in the Procfile.

#### Troubleshooting

**Error: "Could not find the build directory"**
- This error occurs if `dist/public/` doesn't exist after build
- Ensure `npm run build` completes successfully during the build phase
- Verify that `vite.config.ts` has `outDir: "dist/public"`
- Confirm that `server/vite.ts` `serveStatic` function references `dist/public` (not just `public`)

**Error: "Connection terminated unexpectedly"**
- This is a PostgreSQL connection error (fixed in latest version)
- Ensure `SUPABASE` connection string is correct: `postgresql://postgres:PASSWORD@HOST.supabase.co:5432/postgres`
- The application automatically adds SSL configuration in production
- Verify the `sessions` table exists in your database
- Check that your database is online and accessible

**Build succeeds but server crashes on start**
- Check that all required environment variables are set
- Verify the database connection string is correct
- Review application logs for specific error messages
- Ensure `NODE_ENV=production` is set

