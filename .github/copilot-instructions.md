# GitHub Copilot Instructions

## 🏗 Project Architecture & Overview

This is a **Next.js 16 (App Router)** application focused on AI-powered slide generation. The core logic resides in a "Slide Generator" domain that streams progress and results to the client.

- **Framework**: Next.js 16, React 19 (Server Actions + Client Components).
- **Language**: TypeScript (Strict).
- **Styling**: Tailwind CSS v4, Shadcn/UI (in `components/ui`).
- **AI Integration**: Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/rsc`).
- **Linter**: Biome (`biome.json`).

## 🧱 Core Concepts & Data Flow

### 1. Slide Generation Engine (`lib/slide-generator/`)
- **Orchestration**: The `SlideGenerator` class (`slide-generator.ts`) is the heart of the app. It implements an `async *run(input)` generator pattern.
- **Streaming**: It `yield`s `Event` objects (e.g., `plan:start`, `slide:generating`) which are streamed to the client via `createStreamableValue` in Server Actions (`app/actions.ts`).
- **Models**: Currently uses Gemini models (`gemini-3-flash-preview`) via `@ai-sdk/google`.
- **Isolation**: Generated slides are **self-contained HTML strings**. They include their own Tailwind CDN script and `@theme` configuration to ensure consistent rendering in iframes and export contexts.

### 2. Client-Side State (`app/client-page.tsx`)
- **State Management**: Uses `useState` to accumulate streamed events.
- **Form Handling**: `@tanstack/react-form` with Zod validation (`primaryInputSchema`).
- **Preview**: `SlidePreview` uses an `iframe` with `srcDoc` to render the self-contained slide HTML.
- **Scaling**: A custom `ResizeObserver` implementation (`ScaledFrame`) scales the 1920x1080 slides to fit the UI.

### 3. Rendering Strategy
- **Isolation**: Do NOT try to render generated slides as React components directly. They must remain as raw HTML strings injected into iframes to prevent style bleeding and ensure the `dom-to-pptx` export works correctly.

## 💻 Critical Workflows

- **Linting**: Run `npm run lint` which triggers `biome check`.
- **Server Actions**: Defined in `app/actions.ts`. Use `use server` directive.

## 📁 Project Conventions

- **File Structure**:
  - `app/`: Next.js App Router (Routes & Actions).
  - `components/ui/`: Primitive UI components (Shadcn/UI).
  - `lib/slide-generator/`: core domain logic (Class, Types, Schemas).
- **Naming**: Use kebab-case for filenames (e.g., `slide-preview.tsx`).
- **Type Safety**:
  - Use Zod schemas (`lib/slide-generator/schemas.ts`) for all AI inputs/outputs and form structure.
  - Share types via `lib/slide-generator/types.ts`.
- **Slide Dimensions**: Hardcoded to 1920x1080 in `components/slide-preview.tsx` and the generator logic.

## ⚠️ Important Implementation Details

- **Tailwind v4**: The project uses Tailwind v4. Configuration is predominantly in CSS, not `tailwind.config.js`.
- **PPTX Export**: The `dom-to-pptx` library is used. Ensure generated HTML is compatible (avoid complex CSS specific to browsers that might break export).
- **Streamable Values**: When modifying the generator flow, ensure the `Event` union type in `types.ts` is updated and handled in the `client-page.tsx` switch statement.
