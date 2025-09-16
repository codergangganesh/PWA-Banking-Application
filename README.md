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
  - [📈 Contribution Tracking](#-contribution-tracking)
    - [Vercel](#vercel)
    - [GitHub Pages](#github-pages)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)
  - [✍️ Author](#️-author)

## ✨ Features

- 🔐 Secure authentication with Supabase Auth (email/password, session management)
- 💳 Account dashboard with real-time transaction history
- 📊 Financial data visualization with interactive charts
- 📱 Fully responsive design (mobile, tablet, desktop)
- ⚡ Fast performance with Vite bundling
- 🌐 Progressive Web App support (installable on devices)
- 🎨 Modern UI with Tailwind CSS
- 📈 Data visualization with Recharts
- 💰 Recurring payments management
- 📅 Bill reminders with due date tracking
- 📤 Import/Export transaction data (JSON format)
- 🔄 Real-time data synchronization with Supabase
- 🔒 Row Level Security ensuring data isolation
- 📦 Local data storage with IndexedDB fallback

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
│   ├── AuthContext.jsx      # Authentication context and hooks
│   ├── supabaseClient.js    # Supabase client initialization
│   └── supabaseDataClient.js # Database operations and data fetching
├── App.jsx             # Main application component
├── main.jsx            # Application entry point
└── index.css           # Global styles
```

## 🔐 Authentication

The application uses Supabase Auth for secure user authentication with the following features:
- Email and password authentication
- Session management with automatic token refresh
- Password reset functionality
- User metadata updates
- Protected routes and components

Authentication is implemented using React Context API in [AuthContext.jsx](src/services/AuthContext.jsx) which provides:
- `useAuth()` hook for accessing authentication state and methods
- Session persistence across page reloads
- Automatic session restoration on app load
- Protected route handling

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

**Important Notes:**
- Environment variables must be prefixed with `VITE_` to be accessible in the browser
- The anon key allows access to Supabase services as an anonymous user
- Never expose the service role key in client-side code
- For production deployments, configure environment variables in your hosting platform

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

### Transactions Table
```sql
-- Create the transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  category TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_transactions_owner_email ON transactions (owner_email);
CREATE INDEX idx_transactions_date ON transactions (date);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions table
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own transactions" ON transactions
  FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own transactions" ON transactions
  FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own transactions" ON transactions
  FOR DELETE USING (owner_email = auth.jwt() ->> 'email');
```

### Recurring Payments Table
```sql
-- Create the recurring_payments table
CREATE TABLE recurring_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  category TEXT,
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')) NOT NULL,
  next_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_recurring_payments_owner_email ON recurring_payments (owner_email);
CREATE INDEX idx_recurring_payments_next_date ON recurring_payments (next_date);

-- Enable Row Level Security
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for recurring_payments table
CREATE POLICY "Users can view their own recurring payments" ON recurring_payments
  FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own recurring payments" ON recurring_payments
  FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own recurring payments" ON recurring_payments
  FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own recurring payments" ON recurring_payments
  FOR DELETE USING (owner_email = auth.jwt() ->> 'email');
```

### Bill Reminders Table
```sql
-- Create the bill_reminders table
CREATE TABLE bill_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  category TEXT,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_bill_reminders_owner_email ON bill_reminders (owner_email);
CREATE INDEX idx_bill_reminders_due_date ON bill_reminders (due_date);

-- Enable Row Level Security
ALTER TABLE bill_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for bill_reminders table
CREATE POLICY "Users can view their own bill reminders" ON bill_reminders
  FOR SELECT USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert their own bill reminders" ON bill_reminders
  FOR INSERT WITH CHECK (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update their own bill reminders" ON bill_reminders
  FOR UPDATE USING (owner_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete their own bill reminders" ON bill_reminders
  FOR DELETE USING (owner_email = auth.jwt() ->> 'email');
```

### Data Relationships and Flow

The application maintains data consistency through the following relationships:
- Each user has one account record in the `accounts` table
- All financial transactions are stored in the `transactions` table, linked to the user's account
- Recurring payments in `recurring_payments` automatically generate transactions when processed
- Bill reminders in `bill_reminders` can be converted to transactions when marked as paid
- All tables use Row Level Security to ensure users only access their own data
- Account balance is calculated from the sum of all transactions for that account

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

## 📈 Contribution Tracking

This project follows a structured Git workflow to maintain consistent contributions and track progress effectively.

### 🚀 Additional Features

This project now includes enhanced contribution tracking tools to help maintain consistent development activity.

### 🛠️ Tools Included

- Automated changelog generation
- Daily contribution logging
- Git workflow helpers
- Contribution statistics

### 📊 Tracking Progress

We maintain detailed records of our development progress to ensure consistent contributions.

### Development Strategy

We maintain a consistent development rhythm with approximately 5 meaningful contributions per day during active development periods. Our approach includes:

- Small, focused commits that represent single logical changes
- Clear, descriptive commit messages following conventional commit format
- Regular feature branching for isolated development
- Daily progress tracking

For detailed guidelines on our development strategy, see [DEVELOPMENT_STRATEGY.md](DEVELOPMENT_STRATEGY.md).

### Contribution Log

All significant contributions are tracked in [CONTRIBUTION_LOG.md](CONTRIBUTION_LOG.md), which documents daily activities and progress.

### Git Aliases

To streamline Git operations, we use helpful aliases documented in [GIT_ALIASES.md](GIT_ALIASES.md).

### Contribution Scripts

For demonstration purposes, we've included several scripts to help with consistent contributions:

#### Simulation Script

```bash
npm run simulate-contributions
```

>Note: The simulation script is commented out by default to prevent accidental execution. Uncomment the `simulateContributions()` call in `scripts/simulate_contributions.cjs` to run the simulation.

#### Contribution Statistics

```bash
npm run contribution-stats
```

Shows statistics about your contributions including total commits, recent activity, and daily averages.

#### Changelog Generator

```bash
npm run generate-changelog
```

Automatically generates a `CHANGELOG.md` file from your Git commit history, grouping commits by type (features, fixes, etc.) following conventional commit format.

#### Daily Log Tracker

```bash
npm run daily-log
```

Creates a daily log file in the `daily_logs/` directory to help track your contributions. You can also add completed contributions to today's log:

```bash
npm run daily-log add "Implemented user authentication flow"
npm run daily-log add "Fixed login redirect issue"
npm run daily-log add "Updated documentation for API endpoints"
```

This helps maintain accountability and provides a clear record of daily progress.

#### Git Workflow Helper

We've included helper scripts for both Bash (`scripts/git-workflow-helper.sh`) and PowerShell (`scripts/git-workflow-helper.ps1`) to simplify common Git operations:

##### Bash (Linux/macOS)
```bash
# Create a new feature branch
./scripts/git-workflow-helper.sh feature new-feature-name

# Make a conventional commit
./scripts/git-workflow-helper.sh commit feat "add new authentication flow"

# Publish current branch
./scripts/git-workflow-helper.sh publish

# Show contribution statistics
./scripts/git-workflow-helper.sh stats
```

##### PowerShell (Windows)
```powershell
# Create a new feature branch
.\scripts\git-workflow-helper.ps1 feature new-feature-name

# Make a conventional commit
.\scripts\git-workflow-helper.ps1 commit feat "add new authentication flow"

# Publish current branch
.\scripts\git-workflow-helper.ps1 publish

# Show contribution statistics
.\scripts\git-workflow-helper.ps1 stats
```

These scripts help maintain consistency in branch naming, commit messages, and publishing workflow.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ✍️ Author

**codergangganesh**

- GitHub: [@codergangganesh](https://github.com/codergangganesh)
- LinkedIn: [codergangganesh](https://linkedin.com/in/codergangganesh)

---

Made with ❤️ using React, Vite, and Supabase