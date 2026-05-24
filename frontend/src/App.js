import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; // इथे Navigate ॲड केला आहे
import Register from './pages/Register';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// ProtectedRoute फंक्शन App च्या बाहेर ठेवा जेणेकरून कोड क्लीन राहील
const ProtectedRoute = ({ children }) => {
  // localStorage मधून पूर्ण 'user' ऑब्जेक्ट मिळवा
  const user = JSON.parse(localStorage.getItem('user')); 
  
  // एकदम कडक चेक: जर ईमेल नसेल तर सरळ बाहेर काढा
  if (!user || !user.email) {
    return <Navigate to="/" replace />; 
  }
  
  return children;
};

function App() {
  return (
   <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* पाथ स्पेलिंग चेक करा: /admin-dash की /admin-dashboard? */}
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/stud-dash" 
            element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/employee-dashboard" 
            element={
              <ProtectedRoute>
                <EmployeeDashboard />
              </ProtectedRoute>
            } 
          />

          <Route path="/edit-profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />

        
<Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;