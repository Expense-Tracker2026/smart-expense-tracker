import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        profession: 'Student' // Default value
    });
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // बॅकएंडला पूर्ण formData पाठवा
            console.log("Sending Data to Register:", formData); 
         const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const res = await axios.post(`${API_URL}/api/register`, formData);
            
            if (res.data.success) {
                Swal.fire({
                    title: 'Success!',
                    text: 'Registration Successful! Please Login.',
                    icon: 'success',
                    confirmButtonText: 'Go to Login',
                    confirmButtonColor: '#667eea',
                }).then((result) => {
                    if (result.isConfirmed) {
                        navigate('/'); 
                    }
                });
            }
        } catch (err) {
            Swal.fire({
                title: 'Error!',
                text: err.response?.data?.message || "Registration failed. Try again!",
                icon: 'error',
                confirmButtonText: 'Try Again',
                confirmButtonColor: '#d33',
            });
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <div className="register-header">
                    <h2>Create Account</h2>
                    <p>Start Your Smart Tracker Journey!!!</p>
                </div>
                <form onSubmit={handleSubmit} className="register-form">
                    <div className="input-group">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            placeholder="Enter your name" 
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            placeholder="example@mail.com" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})} 
                            required 
                        />
                    </div>
                  <div className="input-group">
    <label>Select Your Profession</label>
    <select 
        className="profession-select" 
        value={formData.profession} 
        onChange={(e) => setFormData({...formData, profession: e.target.value})}
    >
        {/* value="Student" हे डेटाबेसमध्ये 'Student' पाठवेल */}
        <option value="Student">Student</option>

        {/* 'Working/Business' निवडले तरी value "Employee" च पाठवा */}
        <option value="Employee">Working/Business</option> 
    </select>
</div>  
                    <button type="submit" className="register-btn">Sign Up</button>
                </form>
                <div className="register-footer">
                    <p>Already have an account? <Link to="/">Login</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Register;