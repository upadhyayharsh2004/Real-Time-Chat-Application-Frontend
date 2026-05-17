// import React from 'react';
// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { ChatProvider } from './context/ChatContext';
// import LoginPage from './pages/LoginPage';
// import RegisterPage from './pages/RegisterPage';
// import ChatLayout from './pages/ChatLayout';
// import './App.css';

// function PrivateRoute({ children }) {
//   const { user } = useAuth();
//   return user ? children : <Navigate to="/login" replace />;
// }

// function PublicRoute({ children }) {
//   const { user } = useAuth();
//   return !user ? children : <Navigate to="/" replace />;
// }

// function AppRoutes() {
//   return (
//     <Routes>
//       <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
//       <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
//       <Route path="/*" element={
//         <PrivateRoute>
//           <ChatProvider>
//             <ChatLayout />
//           </ChatProvider>
//         </PrivateRoute>
//       } />
//     </Routes>
//   );
// }

// export default function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <AppRoutes />
//       </BrowserRouter>
//     </AuthProvider>
//   );
// }


import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatLayout from './pages/ChatLayout';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import './App.css';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* ✅ OAuth callback — PublicRoute nahi, kyunki token abhi set ho raha hai */}
      <Route path="/oauth-callback" element={<OAuthCallbackPage />} />

      <Route path="/*" element={
        <PrivateRoute>
          <ChatProvider>
            <ChatLayout />
          </ChatProvider>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}