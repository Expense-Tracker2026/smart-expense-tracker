import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

  
const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const res = await axios.post('http://localhost:5000/api/forgot-password', { email });
        if (res.data.success) {
            Swal.fire('Success', 'The OTP has been sent to your email!', 'success');
            
            // ईमेल सबमिट केल्यावर युजरला थेट रिसेट पेजवर पाठवा
            navigate('/reset-password'); 
        }
    } catch (err) {
        Swal.fire('Error', 'An error occurred while sending the email!', 'error');
    }
};

    return (
        <div className="login-container"> {/* तुमची लॉगिनची CSS वापरा */}
            <div className="login-box">
                <h2>Forgot Password</h2>
                <p>Enter your email, and we will send you an OTP to reset your password.</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            required 
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Sending...' : 'Send OTP'}
                    </button>
                </form>
                <div className="login-footer">
                    <button onClick={() => navigate('/')} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;