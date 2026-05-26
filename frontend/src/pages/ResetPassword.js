import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';

const ResetPassword = () => {
    const [otp, setOtp] = useState(''); // OTP साठी स्टेट
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const navigate = useNavigate();

    const handleReset = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return Swal.fire('Error', 'Passwords do not match!', 'error');
        }

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await axios.post(`${API_URL}/api/reset-password`, {
                otp, // टोकन ऐवजी OTP पाठवत आहोत
                password
            });

            if (res.data.success) {
                Swal.fire('Success', 'Password reset successful!', 'success');
                navigate('/');
            }
        } catch (err) {
            Swal.fire('Error', err.response?.data?.message || 'Error', 'error');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Reset Password</h2>
                <form onSubmit={handleReset}>
                    <div className="form-group">
                        <label>Enter 6-Digit OTP</label>
                        <input 
                            type="text" 
                            maxLength="6"
                            placeholder="123456"
                            required
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>New Password</label>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input 
                            type="password" 
                            required 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="login-btn">Update Password</button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;