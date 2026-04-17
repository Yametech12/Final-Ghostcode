# Ghostnamee - Web App

## Tech Stack
- **Framework**: React + Vite
- **AI**: OpenRouter API (Gemini models via OpenRouter)
- **Backend**: Express.js
- **Styling**: Tailwind CSS
- **Component Library**: Lucide React icons

## Setup
1. Copy `.env.example` to `.env` and add your OpenRouter API key
2. Install dependencies: `npm install`
3. Start development: `npm run dev`

## Migration Notes
- Firebase has been completely removed and replaced with Supabase
- All Firebase references have been cleaned from the codebase
- Development server runs on port 5173
- API server runs on port 3000

## Scripts
- `npm run dev` - Start both API and frontend dev servers
- `npm run build` - Build for production
- `npm run lint` - TypeScript type checking