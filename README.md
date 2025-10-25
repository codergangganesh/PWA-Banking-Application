# PWA Banking Application

![Project Status](https://img.shields.io/badge/status-in%20development-orange) ![License](https://img.shields.io/badge/license-MIT-blue)

A modern Progressive Web App (PWA) for banking built with React, Vite, and Supabase. This application provides a secure and responsive banking experience that works across all devices.

## 📋 Table of Contents
- [PWA Banking Application](#pwa-banking-application)
  - [📋 Table of Contents](#-table-of-contents)
  - [✨ Features](#-features)
  - [🛠 Tech Stack](#-tech-stack)
  - [🏗 Architecture](#-architecture)
  - [📋 Prerequisites](#-prerequisites)
  - [🚀 Installation](#-installation)
  - [🔐 Environment Variables](#-environment-variables)
  - [📋 Supabase Database Setup](#-supabase-database-setup)
  - [🧪 Development](#-development)
  - [🏗 Building for Production](#-building-for-production)
  - [☁️ Deployment](#️-deployment)
    - [Netlify](#netlify)
    - [Vercel](#vercel)
    - [GitHub Pages](#github-pages)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)
  - [✍️ Author](#️-author)

## ✨ Features

- 🔐 Secure authentication with Supabase
- 💳 Account dashboard with transaction history
- 📊 Financial data visualization
- 📱 Fully responsive design (mobile, tablet, desktop)
- ⚡ Fast performance with Vite
- 🌐 Progressive Web App support (installable on devices)
- 🎨 Modern UI with Tailwind CSS
- 📈 Data visualization with Recharts

## 🛠 Tech Stack

- **Frontend**: React 18, Tailwind CSS
- **Build Tool**: Vite
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Charts**: Recharts
- **Animations**: Framer Motion
- **State Management**: React Context API

## 🏗 Architecture

```
src/
├── components/         # Reusable UI components
├── services/           # Business logic and API integrations
├── App.jsx             # Main application component
├── main.jsx            # Application entry point
└── index.css           # Global styles
```

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account (free tier available)

## 🚀 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/codergangganesh/PWA-Banking-Application.git
   ```

2. Navigate to the project directory:
   ```bash
   cd PWA-Banking-Application
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## 🔐 Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```bash
cp .env.example .env
```

Then edit the `.env` file with your actual Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

To get these values:
1. Create a Supabase project at [https://app.supabase.io/](https://app.supabase.io/)
2. Go to Project Settings > API
3. Copy the Project URL and anon public key

## 📋 Supabase Database Setup

After creating your Supabase project, you need to set up the database tables. Run the following SQL commands in your Supabase SQL editor:

### Accounts Table
```sql
-- Create the accounts table
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  account_number TEXT,
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on owner_email for faster queries
CREATE INDEX idx_accounts_owner_email ON accounts (owner_email);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for accounts table
CREATE POLICY "Users can view their own account" ON accounts
  FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own account" ON accounts
  FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own account" ON accounts
  FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');
```

### Existing Tables (Transactions, Recurring Payments, Bill Reminders)
The application also uses the following tables which should already be set up:
- `transactions`
- `recurring_payments`
- `bill_reminders`

Make sure Row Level Security is enabled for all tables with appropriate policies to ensure users can only access their own data.

## 🧪 Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🏗 Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## ☁️ Deployment

### Netlify
1. Push your code to a GitHub repository
2. Connect your repository to Netlify
3. Set the build command to `npm run build`
4. Set the publish directory to `dist/`

### Vercel
1. Push your code to a GitHub repository
2. Import the project to Vercel
3. Set the build command to `npm run build`
4. Set the output directory to `dist/`

### GitHub Pages
1. Install the gh-pages package:
   ```bash
   npm install gh-pages --save-dev
   ```
2. Add these scripts to your `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Deploy with:
   ```bash
   npm run deploy
   ```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ✍️ Author

**codergangganesh**

- GitHub: [@codergangganesh](https://github.com/codergangganesh)
- LinkedIn: [codergangganesh](https://linkedin.com/in/codergangganesh)

---

Made with ❤️ using React, Vite, and Supabase