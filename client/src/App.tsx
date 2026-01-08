import { Notifications } from '@mantine/notifications';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { GlobalTemplatesPage } from './pages/GlobalTemplatesPage';
import { CredentialsPage } from './pages/CredentialsPage';
import { LoginPage } from './pages/LoginPage';
import { useAuthStore } from './stores/authStore';
import { authApi } from './services/api';

// Component to handle auth callback from URL hash
function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, setLoading } = useAuthStore();
  
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check for auth tokens in URL hash
      const hash = window.location.hash;
      if (hash.includes('auth=')) {
        try {
          const authParams = new URLSearchParams(hash.split('auth=')[1]);
          const accessToken = authParams.get('access_token');
          const refreshToken = authParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Store tokens temporarily to make API call
            useAuthStore.setState({ accessToken, refreshToken });
            
            // Fetch user info
            const user = await authApi.getCurrentUser();
            
            // Set full auth state
            setAuth(user, accessToken, refreshToken);
            
            // Clean URL hash and navigate
            const cleanPath = location.pathname || '/';
            window.history.replaceState(null, '', cleanPath);
            navigate(cleanPath, { replace: true });
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          useAuthStore.getState().logout();
          navigate('/login?error=callback_failed', { replace: true });
        }
      } else {
        setLoading(false);
      }
    };
    
    handleAuthCallback();
  }, []);
  
  return null;
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  // Show loading state while checking auth
  if (isLoading) {
    return (
      <>
        <AuthCallback />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}>
          Loading...
        </div>
      </>
    );
  }
  
  return (
    <>
      <AuthCallback />
      <Notifications zIndex={9999} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {isAuthenticated ? (
          <Route element={<AppLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/templates" element={<GlobalTemplatesPage />} />
            <Route path="/credentials" element={<CredentialsPage />} />
          </Route>
        ) : (
          <Route path="*" element={<LoginPage />} />
        )}
      </Routes>
    </>
  );
}
