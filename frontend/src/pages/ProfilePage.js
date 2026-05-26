import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import './Login.css'; // आपण याचे CSS बनवूया
import { FaUser } from 'react-icons/fa';
const ProfilePage = () => {
    const [userData, setUserData] = useState({ username: '', email: '', profession: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // LocalStorage मधून सध्याचा डेटा मिळवा
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            setUserData({ 
                username: user.username, 
                email: user.email, 
                profession: user.profession 
            });
        }
    }, []);

const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    if (!currentUser || !currentUser.id) {
        Swal.fire('Error', 'Session expired, please login again.', 'error');
        navigate('/');
        return;
    }

    const updatePayload = {
        id: currentUser.id,
        newName: userData.username.trim(),
        newEmail: userData.email.trim(),
        newProfession: userData.profession
    };

    try {

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await axios.put(`${API_URL}/api/update-profile`, updatePayload);
        
        if (res.data.success) {
            // १. नवीन डेटा तयार करा
            const updatedUserData = { 
                ...currentUser, 
                username: userData.username, 
                email: userData.email, 
                profession: userData.profession 
            };
            
            // २. LocalStorage अपडेट करा
            localStorage.setItem('user', JSON.stringify(updatedUserData));

            await Swal.fire('Success', 'Profile updated successfully!', 'success');

            // ३. रिडायरेक्शन लॉजिक (येथे 'updatedUserData' किंवा 'currentUser' वापरा)
            // टीप: 'role' नुसार रिडायरेक्ट करणे जास्त सुरक्षित असते
            if (currentUser.role === 'Admin') {
                navigate('/admin-dashboard');
            } else if (updatedUserData.profession === 'Student') {
                navigate('/stud-dash');
            } else if (updatedUserData.profession === 'Employee') {
                navigate('/employee-dashboard');
            } else {
                navigate('/'); 
            }
        }
    } catch (err) {
        console.error("Update error:", err);
        Swal.fire('Error', 'Update failed', 'error');
    } finally {
        setLoading(false);
    }
};
const updateData = {
    email: userData.email.trim(), // स्पेस काढून टाकेल
    newName: userData.username.trim(),
    newProfession: userData.profession
};

const handleBack = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (user.profession === 'Student') {
        navigate('/stud-dash');
    } else if (user.profession === 'Admin') {
        navigate('/admin-dashboard');
    } else if (user.profession === 'Employee') {
        navigate('/employee-dashboard');
    } else {
        navigate('/'); // काहीच न सापडल्यास लॉगिनला पाठवा
    }
};
    return (
        <div className="profile-page-container">
            <div className="profile-card">
                <h2 className="profile-heading">
    <FaUser className="profile-icon" /> Edit Profile
</h2>
                <form onSubmit={handleUpdate}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input 
                            type="text" 
                            value={userData.username}
                            onChange={(e) => setUserData({...userData, username: e.target.value})}
                        />
                    </div>
                   <div className="form-group">
    <label>Email Address</label>
    <input 
        type="email" 
        value={userData.email} 
        onChange={(e) => setUserData({...userData, email: e.target.value})} // हा भाग महत्त्वाचा आहे
    />
</div>
                    {/* 'user' object मधून रोल तपासा, जर तो 'Admin' नसेल तरच हे दिसेल */}
{JSON.parse(localStorage.getItem('user'))?.role !== 'Admin' && (
    <div className="form-group">
        <label>Profession</label>
        <select 
            className="form-select-profile"
            value={userData.profession} 
            onChange={(e) => setUserData({...userData, profession: e.target.value})}
        >
            <option value="Student">Student</option>
            <option value="Employee">Employee</option>
        </select>
    </div>
)}
                    <div className="profile-actions">
                        <button type="submit" className="save-btn" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" className="back-btn" onClick={handleBack}>
    Back to Dashboard
</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;