# Sentinel

A centralized, single-page application that provides a systematic, data-driven dashboard for managing the improvement, maintenance rhythm, and incubation of a portfolio of external software projects (mobile/web apps).

## Features

### 🎯 Core Functionality
- **Portfolio Dashboard**: Visual overview of all managed applications
- **Health Indicators**: Color-coded status based on commit activity and review schedules
- **Quarterly Review System**: Enforced review cycles with scheduling and tracking
- **Idea Incubation**: Document and manage app concepts before development
- **GitHub Integration**: Real-time repository metadata fetching
- **Local Persistence**: All management data stored locally using IndexedDB

### 📊 Dashboard View
- Grid layout of app cards with health indicators
- Key metrics: version, last commit, next review, pending todos
- Interactive cards with hover effects and click navigation
- Responsive design for mobile and desktop

### 🔍 App Detail View (Tabbed Interface)
**Overview & System Checks Tab:**
- Quarterly review schedule with overdue indicators
- Start Review Checklist functionality
- Technical status display
- Repository information and health metrics

**To-Do & Improvements Tab:**
- Improvement budget tracker (20% allocation simulation)
- Task list with priority levels (P0, P1, P2)
- External task tracker integration button
- Quick action buttons for task management

**Developer Notes Tab:**
- Persistent notes storage with auto-save
- Note-taking templates (Decision, Technical, TODO, Bug)
- Character counter and formatting helpers
- Rich text area with monospace font

### 💡 Idea Incubation Area
- Comprehensive form for documenting new concepts
- Required fields: name, problem, audience, features, tech stack, risk
- Risk assessment with Low/Medium/High ratings
- Technology stack selection (React Native, Flutter, Web, iOS Native, Android Native)
- One-click activation to convert ideas to active apps

## Technology Stack

### Frontend
- **HTML5**: Semantic markup structure
- **CSS3**: Modern styling with CSS custom properties (Semper Admin aesthetic)
- **ES6+ Modules**: Native JavaScript modules for code organization
- **Vite**: Build tool and development server for Sentinel

### Data Management
- **IndexedDB**: Local database for persistent storage
- **Local API**: Simulated GitHub API with retry logic and error handling

### Architecture
- **Component-based**: Modular UI components
- **State Management**: Centralized state with subscription pattern
- **Data Layer**: Separate services for API and persistence
- **Utility Functions**: Reusable helper functions

## Project Structure

```
Sentinel/
├── public/                 # Static assets and entry point
│   ├── index.html         # Main HTML file
│   └── assets/            # Static assets (images, icons)
├── src/                   # Source code
│   ├── components/        # Reusable UI components
│   │   ├── AppCard.js     # App card component
│   │   ├── TabbedDetail.js # Detail view with tabs
│   │   └── IdeaForm.js    # Idea creation form
│   ├── data/              # Data layer
│   │   ├── DataStore.js   # IndexedDB management
│   │   └── ApiService.js  # GitHub API integration
│   ├── state/             # State management
│   │   └── AppState.js    # Centralized application state
│   ├── utils/             # Utility functions
│   │   └── helpers.js     # Date formatting, health calculations, etc.
│   ├── styles/            # Styling
│   │   └── main.css       # Main stylesheet
│   └── App.js             # Main application orchestration
├── package.json           # Dependencies and scripts
├── vite.config.js        # Build configuration
└── README.md             # Project documentation
```

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure GitHub API** (Optional)
   - Open `public/index.html`
   - Replace `YOUR_API_KEY_HERE` with your GitHub personal access token
   - Or leave as-is to use fallback data

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   - Opens at http://localhost:3000
   - Hot module replacement enabled

4. **Build for Production**
   ```bash
   npm run build
   ```

## Usage

### Initial Setup
1. The app loads with sample data automatically
2. Navigate between Dashboard, App Details, and Idea Incubation views
3. Click on app cards to view detailed information
4. Use the navigation buttons to switch between views

### Managing Apps
1. **View App Details**: Click on any app card
2. **Update Notes**: Navigate to Developer Notes tab and save changes
3. **Start Review**: Click "Start Review Checklist" in Overview tab
4. **Track Tasks**: View and manage tasks in To-Do tab

### Creating Ideas
1. Navigate to Idea Incubation view
2. Click "New Idea" button
3. Fill out the comprehensive form
4. Save the idea for future consideration
5. Activate ideas by converting them to active apps

### GitHub Integration
- Automatically fetches repository metadata (commits, tags, stars)
- Implements exponential backoff for rate limit handling
- Provides fallback data when API is unavailable
- Shows health indicators based on commit activity

## Design System (Semper Admin Aesthetic)

### Color Palette
- **Primary Dark**: #1a2332 (Header and actions)
- **Primary Blue**: #007bff (Primary actions)
- **Success Green**: #28a745 (Healthy status)
- **Warning Orange**: #ffc107 (Needs attention)
- **Danger Red**: #dc3545 (Critical/Overdue)
- **Light Background**: #f8f9fa (Content areas)

### Typography
- System font stack for optimal readability
- Clear hierarchy with consistent font weights
- Responsive sizing for mobile and desktop

### Layout
- Mobile-first responsive design
- 12-column grid system for dashboard
- Card-based layout with consistent spacing
- High contrast for accessibility

## API Integration

### GitHub API Features
- Repository metadata fetching
- Commit history and latest tag retrieval
- Rate limit handling with exponential backoff
- Error handling with fallback data
- Configurable authentication

### Local Data Storage
- IndexedDB for persistent storage
- Automatic data initialization with sample data
- Schema versioning for future updates
- Transaction-based operations for data integrity

## Error Handling

### GitHub API Errors
- Network failures: Automatic retry with exponential backoff
- Rate limiting: Wait for reset time before retry
- Repository not found: Graceful fallback to local data
- Authentication issues: Informative error messages

### Application Errors
- Form validation with real-time feedback
- Data persistence error handling
- UI state management for error states
- User-friendly error messages

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **ES6+ Features**: Native modules, async/await, arrow functions
- **IndexedDB**: Local storage with fallback support
- **Responsive Design**: Mobile-first approach

## Future Enhancements

- Export/import functionality for data portability
- Advanced filtering and search capabilities
- Integration with more Git providers (GitLab, Bitbucket)
- Team collaboration features
- Advanced analytics and reporting
- Dark mode support
- PWA capabilities for offline usage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues and questions:
1. Check the browser console for error messages
2. Verify GitHub API configuration
3. Ensure IndexedDB is supported in your browser
4. Report issues with detailed reproduction steps