import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  AccountBalanceWallet,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { LoginCredentials } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, isLoading } = useAuth();
  const theme = useTheme();
  const [showPassword, setShowPassword] = React.useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginCredentials>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data);
    } catch (_err) {}
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* Left branded panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${alpha(theme.palette.secondary.main, 0.8)} 100%)`,
          px: 6,
          py: 8,
          gap: 4,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <AccountBalanceWallet sx={{ color: '#fff', fontSize: 40 }} />
        </Box>

        <Box textAlign="center" color="#fff">
          <Typography variant="h3" fontWeight={700} gutterBottom>
            Expense Manager
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 400, maxWidth: 360 }}>
            Track your finances, understand your spending, and reach your goals.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
            maxWidth: 320,
          }}
        >
          {[
            { label: 'Smart AI categorization', value: 'Powered by Claude' },
            { label: 'Multi-account tracking', value: 'Banks & credit cards' },
            { label: 'Detailed reports', value: 'Month-wise & by category' },
          ].map((feat) => (
            <Box
              key={feat.label}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                px: 2.5,
                py: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Typography variant="body2" color="rgba(255,255,255,0.9)" fontWeight={500}>
                {feat.label}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.65)">
                {feat.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right login card */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: 6,
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 420,
            boxShadow: theme.palette.mode === 'light'
              ? '0 4px 24px rgba(0,0,0,0.08)'
              : '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Mobile logo */}
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 2.5,
                  bgcolor: theme.palette.primary.main,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWallet sx={{ color: '#fff', fontSize: 28 }} />
              </Box>
            </Box>

            <Typography variant="h5" fontWeight={700} gutterBottom>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sign in to your account to continue
            </Typography>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email address"
                    type="email"
                    fullWidth
                    margin="normal"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Controller
                name="password"
                control={control}
                rules={{ required: 'Password is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                            size="small"
                            tabIndex={-1}
                          >
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  mt: 3,
                  mb: 1.5,
                  py: 1.4,
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                  },
                }}
              >
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>

              <Box textAlign="center">
                <Button
                  variant="text"
                  onClick={onSwitchToRegister}
                  disabled={isLoading}
                  size="small"
                  sx={{ color: 'text.secondary' }}
                >
                  Don't have an account?{' '}
                  <Typography
                    component="span"
                    variant="body2"
                    color="primary"
                    fontWeight={600}
                    sx={{ ml: 0.5 }}
                  >
                    Sign Up
                  </Typography>
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LoginForm;
