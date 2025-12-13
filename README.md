# Sentinel

Portfolio dashboard for military software projects - track apps, collect ideas, and manage development tasks.

## Features

### Public User Features
- **Portfolio Dashboard**: Browse all managed applications with health indicators
- **App Details**: View app information, version history, and pending tasks
- **Submit Ideas**: Propose new app concepts for consideration
- **Feedback Comments**: Add comments and feedback to existing ideas
- **Suggest Improvements**: Submit improvement suggestions for active apps

### Admin Features
- **Full App Management**: Edit app details, manage tasks, and track reviews
- **Idea Management**: Review, edit, and activate submitted ideas
- **Task Triage**: Prioritize and assign tasks from public feedback
- **View Submitter Info**: See name and email of public submissions (hidden from regular users)
- **Quarterly Reviews**: Schedule and track app review cycles

### Privacy Controls
- Public submissions collect name and email
- Submitter details visible only to admins
- Regular users see feedback attributed to "Semper Squad"

## Dashboard View

- Grid layout of app cards with color-coded health indicators
- Key metrics: version, last commit, next review, pending tasks
- Search functionality to filter apps
- Sort options for organization
- Responsive design for mobile and desktop

## App Detail View

**Overview Tab:**
- Quarterly review schedule with overdue indicators
- Review checklist functionality
- Repository information and health metrics

**Tasks Tab:**
- Task list with priority levels and status tracking
- Public feedback submissions highlighted
- Admin actions: edit, delete, change status

**Developer Notes Tab:**
- Persistent notes with auto-save
- Templates for decisions, technical notes, TODOs, and bugs

## Innovation Ideas

- Submit new app concepts with problem description, target audience, and tech stack
- Risk assessment ratings (Low/Medium/High)
- Comment system for community feedback
- Admin activation to convert ideas to active projects

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+ modules), HTML5, CSS3
- **Build Tool**: Vite
- **Data Storage**: IndexedDB (offline-first)
- **Styling**: CSS custom properties with dark theme

## Project Structure

```
Sentinel/
├── index.html              # Main HTML file
├── src/
│   ├── App.js              # Main application
│   ├── components/
│   │   ├── AppCard.js      # App card component
│   │   ├── TabbedDetail.js # Detail view with tabs
│   │   ├── IdeasList.js    # Ideas list component
│   │   ├── SearchFilter.js # Search functionality
│   │   └── modals/         # Modal dialogs
│   │       ├── IdeaDetailModal.js
│   │       ├── ImprovementModal.js
│   │       ├── PublicIdeaModal.js
│   │       └── TodoDialog.js
│   ├── controllers/
│   │   └── DataController.js
│   ├── data/
│   │   ├── DataStore.js    # IndexedDB management
│   │   └── ApiService.js   # API integration
│   ├── state/
│   │   └── AppState.js     # Centralized state
│   ├── styles/
│   │   └── main.css        # Stylesheet
│   ├── types/
│   │   └── index.d.ts      # TypeScript definitions
│   └── utils/
│       ├── helpers.js
│       └── uiComponents.js
├── server/
│   └── index.js            # Proxy server
├── package.json
└── vite.config.js
```

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

### For Public Users
1. Browse the dashboard to view all apps
2. Click on any app to see details and pending tasks
3. Use "Suggest Improvement" to submit feedback on active apps
4. Navigate to Ideas to view and comment on proposed concepts
5. Submit new ideas using the idea submission form

### For Admins
1. Log in with admin credentials
2. Manage apps, tasks, and ideas with full edit capabilities
3. View submitter details on public feedback
4. Activate ideas to create new app projects
5. Conduct quarterly reviews

## Design

- Dark theme optimized for extended use
- Color-coded health indicators (green/yellow/red)
- Mobile-responsive layout
- Accessible contrast ratios

## License

MIT License
