import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

const handleLogin = async (e) => {
    e.preventDefault();
    try {
        console.log("Attempting login for:", email);

       const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const res = await axios.post(`${API_URL}/api/login`, { email, password });
        
        if (res.data.success) {
            const user = res.data.user;
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userEmail', email);
            // हा मेसेज तपासा, यात काय येतेय ते महत्त्वाचे आहे!
            console.log("User Profession from Database:", user.profession);

            Swal.fire({
                title: 'Success',
                text: `Welcome back, ${user.username}!`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

            // रिडायरेक्शन लॉजिक
   if (user.role === 'Admin') {
    navigate('/admin-dashboard');
} else if (user.profession === 'Student') {
    navigate('/stud-dash');
} else {
    navigate('/employee-dashboard');
}
        } else {
            Swal.fire('Error', res.data.message || 'Invalid Credentials', 'error');
        }
    } catch (err) {
        console.error("Login Error:", err);
        Swal.fire('Error', 'Server error or Connection failed!', 'error');
    }
};

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>Welcome Back</h2>
                    <p>Login to Smart AI Expense Tracker</p>
                </div>
                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            placeholder="example@mail.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="login-btn">Login</button>
                  
<div className="forgot-password-link">
    <span onClick={() => navigate('/forgot-password')} style={{cursor: 'pointer', color: 'blue'}}>
        Forgot Password?
    </span>
</div>
                </form>
                <div className="login-footer">
                  <p>Don't have an account? <Link to="/register">Register</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Login;