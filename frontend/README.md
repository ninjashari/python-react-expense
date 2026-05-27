# 🎨 Frontend - Expense Manager

[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Material-UI](https://img.shields.io/badge/MUI-5.18+-007FFF.svg)](https://mui.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5.83+-FF4154.svg)](https://tanstack.com/query)

A modern React TypeScript frontend for the Expense Manager application, featuring Material-UI components, advanced state management, and intuitive user experiences.

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Development](#-development)
- [Architecture](#-architecture)
- [Components](#-components)
- [State Management](#-state-management)
- [Styling](#-styling)
- [Testing](#-testing)
- [Build & Deployment](#-build--deployment)

## ✨ Features

### Core UI Features
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Material-UI Components** - Consistent, accessible UI components
- **Dark/Light Theme** - Automatic theme switching support
- **Form Validation** - React Hook Form with Yup validation
- **Toast Notifications** - User-friendly success/error messages
- **Loading States** - Skeleton loaders and progress indicators

### Advanced Features
- **Multi-Select Dropdowns** - Advanced filtering with search
- **File Upload Drag & Drop** - Intuitive file import interface
- **Data Virtualization** - Optimized rendering for large datasets
- **Optimistic Updates** - Instant UI feedback with server reconciliation
- **Error Boundaries** - Graceful error handling and recovery
- **Progressive Web App** - Offline capability and app-like experience

### User Experience
- **Keyboard Navigation** - Full keyboard accessibility
- **Screen Reader Support** - ARIA labels and semantic HTML
- **Auto-save Drafts** - Form state persistence
- **Breadcrumb Navigation** - Clear navigation hierarchy
- **Search & Filtering** - Advanced search across all entities

## 🚀 Installation

### Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

### Setup Steps

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server:**
   ```bash
   npm start
   # or
   yarn start
   ```

The application will open at `http://localhost:3000` and automatically reload when you make changes.

## 🛠️ Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Runs development server with hot reload |
| `npm test` | Launches test runner in interactive watch mode |
| `npm run build` | Builds optimized production bundle |
| `npm run eject` | ⚠️ One-way operation to expose configuration |

### Environment Variables

Create a `.env` file in the frontend directory:

```bash
# API Configuration
REACT_APP_API_BASE_URL=http://localhost:8000/api

# Optional: Feature Flags
REACT_APP_ENABLE_DEBUG=true
REACT_APP_ENABLE_ANALYTICS=false

# Optional: Styling
REACT_APP_THEME=light
```

### Development Workflow

1. **Start the backend API** (see [backend README](../backend/README.md))
2. **Start the frontend development server:**
   ```bash
   npm start
   ```
3. **Open your browser** to `http://localhost:3000`
4. **Make changes** - Hot reload will automatically update the browser

### Code Quality Tools

**Linting:**
```bash
# ESLint (configured in package.json)
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

**Formatting:**
```bash
# Prettier (if configured)
npm run format

# Check formatting
npm run format:check
```

**Type Checking:**
```bash
# TypeScript compiler check
npx tsc --noEmit
```

## 🏗️ Architecture

### Project Structure

```
frontend/src/
├── App.tsx                 # Main application component
├── index.tsx              # Application entry point
├── components/            # Reusable UI components
│   ├── CategorySelect.tsx
│   ├── ErrorBoundary.tsx
│   ├── FileUploadZone.tsx
│   ├── Layout.tsx
│   ├── LoginForm.tsx
│   └── ...
├── contexts/              # React contexts
│   ├── AuthContext.tsx    # Authentication state
│   └── ToastContext.tsx   # Toast notification system
├── hooks/                 # Custom React hooks
│   ├── useApiWithToast.ts
│   ├── useAppNotifications.ts
│   ├── useFormNotifications.ts
│   └── ...
├── pages/                 # Main application pages
│   ├── Accounts.tsx
│   ├── Dashboard.tsx
│   ├── Import.tsx
│   ├── Transactions.tsx
│   └── index.ts
├── services/              # API service layer
│   ├── api.ts            # HTTP client configuration
│   ├── apiWithToast.ts   # API wrapper with notifications
│   └── authApi.ts        # Authentication services
├── types/                 # TypeScript type definitions
│   ├── auth.ts
│   └── index.ts
└── utils/                 # Utility functions
    └── formatters.ts     # Data formatting helpers
```

### Key Design Patterns

**Component Architecture:**
```typescript
// Functional components with hooks
const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  onEdit, 
  onDelete 
}) => {
  const { toast } = useToast();
  const { mutate: deleteTransaction } = useDeleteTransaction();
  
  // Component logic here
  return (
    // JSX here
  );
};
```

**Custom Hooks Pattern:**
```typescript
// Custom hook for API operations
const useTransactions = () => {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.getTransactions(),
    onError: (error) => toast.error(error.message)
  });
};
```

**Context Pattern:**
```typescript
// Global state management
const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## 🧩 Components

### Core Components

#### Layout Components
- **`Layout`** - Main application shell with navigation
- **`ErrorBoundary`** - Error handling and recovery
- **`LoginForm`** - Authentication interface
- **`RegisterForm`** - User registration interface

#### Form Components
- **`CategorySelect`** - Category dropdown with search
- **`PayeeSelect`** - Payee dropdown with autocomplete
- **`MultiSelectDropdown`** - Advanced multi-selection component
- **`FileUploadZone`** - Drag-and-drop file upload

#### Import Components
- **`ColumnMappingStep`** - CSV/Excel column mapping interface
- **`ImportPreview`** - Data preview before import
- **`ImportResults`** - Import completion status
- **`PDFLLMStep`** - PDF processing with LLM configuration
- **`TransactionReviewStep`** - Transaction validation interface

### Component Guidelines

**Props Interface:**
```typescript
interface ComponentProps {
  // Required props first
  data: TransactionData[];
  onSubmit: (data: FormData) => void;
  
  // Optional props
  className?: string;
  isLoading?: boolean;
  
  // Event handlers
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

**Error Handling:**
```typescript
const Component: React.FC<Props> = ({ data }) => {
  if (!data) {
    return <ErrorMessage message=\"No data available\" />;
  }
  
  return <div>{/* Component content */}</div>;
};
```

## 📊 State Management

### TanStack Query (React Query)

Used for server state management:

```typescript
// Query for fetching data
const { data: transactions, isLoading, error } = useQuery({
  queryKey: ['transactions', filters],
  queryFn: () => api.getTransactions(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutation for data updates
const { mutate: createTransaction } = useMutation({
  mutationFn: api.createTransaction,
  onSuccess: () => {
    queryClient.invalidateQueries(['transactions']);
    toast.success('Transaction created successfully!');
  },
  onError: (error) => {
    toast.error(error.message);
  }
});
```

### React Context

Used for global application state:

**Authentication Context:**
```typescript
const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Toast Context:**
```typescript
const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts(prev => [...prev, { ...toast, id: Date.now() }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
    </ToastContext.Provider>
  );
};
```

### Local State Management

**Form State:**
```typescript
const TransactionForm: React.FC = () => {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(transactionSchema),
    defaultValues: {
      amount: 0,
      description: '',
      date: new Date(),
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

## 🎨 Styling

### Material-UI Theme

**Theme Configuration:**
```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: ['Roboto', 'Arial', 'sans-serif'].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});
```

**Custom Styling:**
```typescript
// Using sx prop (preferred)
<Box
  sx={{
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    p: 3,
  }}
>
  Content
</Box>

// Using styled components
const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));
```

### Responsive Design

```typescript
// Breakpoint usage
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    Content for mobile (full width) and desktop (half width)
  </Grid>
</Grid>

// Custom responsive styles
<Box
  sx={{
    display: { xs: 'block', md: 'flex' },
    flexDirection: { xs: 'column', md: 'row' },
  }}
>
  Responsive content
</Box>
```

## 🧪 Testing

### Testing Setup

The project uses Jest and React Testing Library:

```bash
# Run tests
npm test

# Run tests in CI mode
npm run test:ci

# Run with coverage
npm run test:coverage
```

### Writing Tests

**Component Testing:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionList from './TransactionList';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('TransactionList', () => {
  it('renders transaction items', () => {
    const queryClient = createTestQueryClient();
    const mockTransactions = [
      { id: '1', description: 'Test transaction', amount: 100 }
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <TransactionList transactions={mockTransactions} />
      </QueryClientProvider>
    );

    expect(screen.getByText('Test transaction')).toBeInTheDocument();
  });
});
```

**Hook Testing:**
```typescript
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'initial'));

    act(() => {
      result.current[1]('new value');
    });

    expect(localStorage.getItem('key')).toBe('\"new value\"');
  });
});
```

### Testing Guidelines

- **Test user interactions**, not implementation details
- **Use semantic queries** (getByRole, getByLabelText)
- **Mock API calls** using MSW or similar
- **Test error states** and loading states
- **Ensure accessibility** with screen reader tests

## 📦 Build & Deployment

### Production Build

```bash
# Create optimized production build
npm run build

# Preview production build locally
npx serve -s build
```

### Build Output

The build creates:
- **`build/static/js/`** - JavaScript bundles
- **`build/static/css/`** - CSS files
- **`build/static/media/`** - Images and other assets
- **`build/index.html`** - Main HTML file

### Deployment Options

**Static Hosting (Recommended):**
```bash
# Deploy to Netlify
netlify deploy --prod --dir=build

# Deploy to Vercel
vercel --prod build

# Deploy to AWS S3
aws s3 sync build/ s3://your-bucket-name --delete
```

**Docker Deployment:**
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD [\"nginx\", \"-g\", \"daemon off;\"]
```

### Performance Optimization

**Code Splitting:**
```typescript
// Lazy loading pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path=\"/dashboard\" element={<Dashboard />} />
    <Route path=\"/transactions\" element={<Transactions />} />
  </Routes>
</Suspense>
```

**Bundle Analysis:**
```bash
# Install bundle analyzer
npm install --save-dev webpack-bundle-analyzer

# Analyze bundle
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

## 📱 Progressive Web App

The application includes PWA features:

- **Service Worker** - Offline caching
- **Web App Manifest** - Install prompt
- **Icons** - App icons for different devices

### PWA Configuration

**manifest.json:**
```json
{
  \"name\": \"Expense Manager\",
  \"short_name\": \"ExpenseApp\",
  \"description\": \"Personal expense management application\",
  \"start_url\": \".\",
  \"display\": \"standalone\",
  \"theme_color\": \"#1976d2\",
  \"background_color\": \"#ffffff\",
  \"icons\": [
    {
      \"src\": \"logo192.png\",
      \"sizes\": \"192x192\",
      \"type\": \"image/png\"
    }
  ]
}
```

## 🔧 Troubleshooting

### Common Issues

**Module Resolution Errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Port Already in Use:**
```bash
# Use different port
PORT=3001 npm start

# Or find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**TypeScript Errors:**
```bash
# Type check without emit
npx tsc --noEmit

# Clear TypeScript cache
rm -rf node_modules/.cache
```

**Build Failures:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS=\"--max_old_space_size=4096\" npm run build

# Check for unused dependencies
npx depcheck
```

### Performance Issues

- **Large Bundle Size:** Use bundle analyzer to identify heavy dependencies
- **Slow Rendering:** Implement React.memo and useMemo for expensive operations
- **Memory Leaks:** Check for uncleared intervals/timeouts and event listeners

### Browser Compatibility

The application supports:
- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

For older browsers, consider:
- Adding polyfills
- Using Babel preset-env
- Testing with BrowserStack

---

For more information, see the [main README](../README.md) or [backend documentation](../backend/README.md).