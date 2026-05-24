import React from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const HelpButton = ({ role }) => {
    const showHelp = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/get-help/${role}`);
            const helpData = res.data.length > 0 ? res.data[0].help_content : "No instructions available.";
            
            Swal.fire({
                title: `${role} Guide`,
                html: `<div style="text-align:left">${helpData}</div>`,
                icon: 'info'
            });
        } catch (error) {
            console.error("Error fetching help:", error);
        }
    };

    return (
        <button 
            onClick={showHelp} 
            style={{ 
                borderRadius: '50%', 
                width: '40px', 
                height: '40px', 
                cursor: 'pointer',
                backgroundColor: '#f39c12',
                border: 'none',
                color: 'white',
                fontSize: '20px'
            }}
        >
            ❓
        </button>
    );
};

export default HelpButton;