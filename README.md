# 🔮 Epimetheus - Advanced Personality Profiling Platform

A comprehensive web application for personality assessment, analysis, and insights using advanced AI models and modern web technologies.

## 🚀 Features

### Core Functionality
- **Personality Assessments**: Comprehensive MBTI-based personality profiling
- **AI-Powered Analysis**: Advanced insights using OpenRouter API with Gemini models
- **Field Reports**: Community-driven case studies and tactical analysis
- **Profile Management**: User profiles with photo uploads and customization
- **Real-time Chat**: AI advisor conversations with persistent sessions
- **Progress Tracking**: Detailed analytics and achievement system

### Technical Features
- **Row-Level Security**: Complete database security with Supabase RLS
- **Progressive Web App**: Offline-capable PWA with service workers
- **Responsive Design**: Mobile-first design with modern animations
- **Type-Safe**: Full TypeScript implementation
- **Performance Optimized**: Code splitting, lazy loading, and caching

## 🛠️ Tech Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **Vite 6** - Next-generation frontend tooling
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern utility-first styling
- **Framer Motion** - Advanced animations and transitions
- **React Router 7** - Modern routing with data loading

### Backend & Database
- **Supabase** - PostgreSQL database with real-time features
- **Express.js** - API server for custom endpoints
- **Row Level Security** - Database-level access control
- **Supabase Storage** - File upload and management

### AI & Integrations
- **OpenRouter API** - Multi-model AI provider (Gemini, GPT-4, Claude)
- **Google OAuth** - Secure authentication
- **Google reCAPTCHA** - Bot protection
- **Google Cloud Storage** - Scalable file storage

### Developer Experience
- **ESLint** - Code quality and consistency
- **Vite PWA Plugin** - Progressive Web App support
- **Bundle Analyzer** - Performance monitoring
- **Hot Module Replacement** - Fast development

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenRouter API key
- Gmail account (for email verification)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd Final-Ghostcode
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Supabase Setup
```bash
# Run the complete schema in Supabase SQL Editor
# Copy the entire supabase-schema.sql content
# Execute it in: https://supabase.com/dashboard → SQL Editor
```

### 4. Development
```bash
npm run dev  # Starts both frontend (5173) and API (3000)
```

## 🔧 Environment Variables

See `.env.example` for complete configuration. Key variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# AI
OPENROUTER_API_KEY=your_openrouter_key

# Email
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Security
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_key
```

## 📊 Database Schema

The application uses a comprehensive PostgreSQL schema with:

- **16 Tables**: Users, assessments, reports, AI sessions, etc.
- **RLS Policies**: Secure access control for all tables
- **Performance Indexes**: Optimized queries
- **Storage Policies**: Secure file upload management

Run `supabase-schema.sql` in Supabase SQL Editor to set up the complete database.

## 🏗️ Build & Deployment

### Development
```bash
npm run dev          # Start development servers
npm run dev:frontend # Frontend only (port 5173)
npm run dev:api      # API only (port 3000)
```

### Production Build
```bash
npm run build        # Production build
npm run build:analyze # Build with bundle analysis
npm run preview      # Preview production build
```

### Deployment
- **Vercel**: Automatic deployment on push to main branch
- **Manual**: Build and deploy `dist/` folder to any static host

## 🔍 Code Quality

### Linting & Type Checking
```bash
npm run lint         # TypeScript type checking
```

### Bundle Analysis
```bash
npm run build:analyze # Opens bundle size analysis
```

## 🛡️ Security Features

- **Row Level Security**: Database-level access control
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Comprehensive data sanitization
- **reCAPTCHA Integration**: Bot protection
- **CORS Configuration**: Proper cross-origin handling
- **Environment Security**: Sensitive data in environment variables

## 🐛 Known Issues & Fixes Applied

### ✅ Fixed Issues
- **Infinite Recursion**: Fixed `is_admin()` function causing database loops
- **Upload Failures**: Implemented direct Supabase storage uploads
- **TypeScript Errors**: Fixed unused variables and missing type declarations
- **Build Errors**: Resolved JSX structure and module import issues

### 🔧 Security Vulnerabilities
- **9 vulnerabilities found** (5 low, 4 high) in dependencies
- **Recommendation**: Run `npm audit fix --force` (may include breaking changes)

## 📈 Performance

- **Code Splitting**: Automatic chunk splitting for optimal loading
- **Lazy Loading**: Components loaded on-demand
- **Image Optimization**: Automatic compression and WebP conversion
- **Caching**: Service worker for offline capability
- **Bundle Size**: Optimized with tree shaking and minification

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and run tests: `npm run lint`
4. Commit your changes: `git commit -m 'Add your feature'`
5. Push to the branch: `git push origin feature/your-feature`
6. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues or questions:
1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure Supabase schema is properly deployed
4. Check network connectivity for API calls

---

**Built with ❤️ using modern web technologies**