import React from 'react';
import {
  AppBar,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Dashboard,
  AccountBalance,
  Receipt,
  Person,
  Category,
  Upload,
  Backup,
  Logout,
  Analytics,
  Psychology,
  Lock,
  CalendarMonth,
  Loyalty,
  AccountBalanceWallet,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useColorMode } from '../contexts/ThemeContext';
import { ChangePassword } from './ChangePassword';

const drawerWidth = 248;

interface LayoutProps {
  children: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: {
    text: string;
    icon: React.ReactNode;
    path: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { text: 'Dashboard', icon: <Dashboard fontSize="small" />, path: '/' },
      { text: 'Accounts', icon: <AccountBalance fontSize="small" />, path: '/accounts' },
      { text: 'Transactions', icon: <Receipt fontSize="small" />, path: '/transactions' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { text: 'All Reports', icon: <Analytics fontSize="small" />, path: '/reports' },
      { text: 'Month-wise', icon: <CalendarMonth fontSize="small" />, path: '/reports/monthwise' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { text: 'Reward Points', icon: <Loyalty fontSize="small" />, path: '/reward-points' },
      { text: 'AI Learning', icon: <Psychology fontSize="small" />, path: '/learning' },
    ],
  },
  {
    label: 'Data',
    items: [
      { text: 'Import', icon: <Upload fontSize="small" />, path: '/import' },
      { text: 'Backup', icon: <Backup fontSize="small" />, path: '/backup' },
      { text: 'Payees', icon: <Person fontSize="small" />, path: '/payees' },
      { text: 'Categories', icon: <Category fontSize="small" />, path: '/categories' },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/reports': 'Reports',
  '/reports/monthwise': 'Month-wise Reports',
  '/reward-points': 'Reward Points',
  '/reward-points/history': 'Points History',
  '/learning': 'AI Learning',
  '/import': 'Import',
  '/backup': 'Backup',
  '/payees': 'Payees',
  '/categories': 'Categories',
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  const pageTitle = pageTitles[location.pathname] ?? 'Expense Manager';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleUserMenuClose();
  };

  const handleChangePassword = () => {
    setChangePasswordOpen(true);
    handleUserMenuClose();
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
      >
        <Toolbar sx={{ px: 3, gap: 2 }}>
          <Typography variant="h6" noWrap fontWeight={600} sx={{ flexGrow: 1 }}>
            {pageTitle}
          </Typography>

          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton onClick={toggleColorMode} size="medium" color="inherit">
                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {user?.name}
            </Typography>

            <Tooltip title="Account settings">
              <IconButton onClick={handleUserMenuOpen} size="small">
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              PaperProps={{
                elevation: 3,
                sx: { mt: 1, minWidth: 180, borderRadius: 2 },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleChangePassword} sx={{ mt: 0.5, borderRadius: 1, mx: 0.5 }}>
                <ListItemIcon>
                  <Lock fontSize="small" />
                </ListItemIcon>
                Change Password
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ borderRadius: 1, mx: 0.5, mb: 0.5 }}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Sign Out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {/* Brand Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AccountBalanceWallet sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              Expense
            </Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1}>
              Manager
            </Typography>
          </Box>
        </Box>

        {/* Navigation */}
        <Box sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, pt: 1 }}>
          {navGroups.map((group, groupIdx) => (
            <Box key={group.label}>
              {groupIdx > 0 && (
                <Divider sx={{ my: 1, mx: 2 }} />
              )}
              <Typography
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{
                  display: 'block',
                  px: 2.5,
                  pt: groupIdx > 0 ? 1 : 0.5,
                  pb: 0.5,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                }}
              >
                {group.label}
              </Typography>
              <List dense disablePadding>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItem key={item.text} disablePadding>
                      <ListItemButton
                        selected={isActive}
                        onClick={() => navigate(item.path)}
                        sx={{
                          borderLeft: isActive
                            ? `3px solid ${theme.palette.primary.main}`
                            : '3px solid transparent',
                          borderRadius: '0 8px 8px 0 !important',
                          ml: '8px !important',
                          mr: '8px !important',
                          width: 'calc(100% - 16px) !important',
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 36,
                            color: isActive
                              ? theme.palette.primary.main
                              : theme.palette.text.secondary,
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? theme.palette.primary.main : 'inherit',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>

        {/* User Footer */}
        <Box
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              color: theme.palette.primary.main,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <Typography variant="caption" fontWeight={600} display="block" noWrap>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap fontSize="0.65rem">
              {user?.email}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {children}
      </Box>

      <ChangePassword
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Box>
  );
};

export default Layout;
