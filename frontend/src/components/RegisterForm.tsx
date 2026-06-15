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
  Person,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { RegisterData } from '../types/auth';
import { useAuth } from '../contexts/AuthContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register, isLoading } = useAuth();
  const theme = useTheme();
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const { control, handleSubmit, formState: { errors }, watch } = useForm<RegisterData & { confirmPassword: string }>({
    defaultValues: { email: '', name: '', password: '', confirmPassword: '' },
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterData & { confirmPassword: string }) => {
    try {
      const { confirmPassword: _, ...registerData } = data;
      await register(registerData);
    } catch (_err) {}
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
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
            Get Started
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 400, maxWidth: 360 }}>
            Create your account and take control of your finances today.
          </Typography>
        </Box>
      </Box>

      {/* Right register card */}
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
            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 3 }}>
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
              Create account
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join your personal expense manager
            </Typography>

            <form onSubmit={handleSubmit(onSubmit)}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Full name is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Full name"
                    fullWidth
                    margin="normal"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

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
                rules={{
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Password must be at least 6 characters' },
                }}
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
                          <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small" tabIndex={-1}>
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />

              <Controller
                name="confirmPassword"
                control={control}
                rules={{
                  required: 'Please confirm your password',
                  validate: (value) => value === password || 'Passwords do not match',
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Confirm password"
                    type={showConfirm ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end" size="small" tabIndex={-1}>
                            {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
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
                {isLoading ? <CircularProgress size={22} color="inherit" /> : 'Create Account'}
              </Button>

              <Box textAlign="center">
                <Button
                  variant="text"
                  onClick={onSwitchToLogin}
                  disabled={isLoading}
                  size="small"
                  sx={{ color: 'text.secondary' }}
                >
                  Already have an account?{' '}
                  <Typography component="span" variant="body2" color="primary" fontWeight={600} sx={{ ml: 0.5 }}>
                    Sign In
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

export default RegisterForm;
