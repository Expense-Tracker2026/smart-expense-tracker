import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Bar } from 'react-chartjs-2'; // ही फाईलच्या वरती इंपोर्ट करा
import './AdminDashboard.css';
import shieldImage from '../images/logo.png';


ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const AdminDashboard = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ active: 0, inactive: 0 });
    const [totalExpense, setTotalExpense] = useState(0);
    const navigate = useNavigate();
    const [selectedUserExpenses, setSelectedUserExpenses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedUserName, setSelectedUserName] = useState("");
    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState({ id: '', username: '', role: '', budget: '' });
    const [chartData, setChartData] = useState({ labels: [], datasets: [] });
    const [showReportsModal, setShowReportsModal] = useState(false);
    const actionBtnStyle = {
    padding: '6px 12px',
    margin: '0 3px',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
    };
        const [profession, setProfession] = useState('Student'); // Dropdown साठी
    const [newCategory, setNewCategory] = useState(''); // Input box साठी
    const [allCategories, setAllCategories] = useState([]); // लिस्ट दाखवण्यासाठी
   // १. प्रोफेशननुसार कॅटेगरीज फिल्टर करा
const studentCats = allCategories.filter(c => c.profession === 'Student');
const employeeCats = allCategories.filter(c => c.profession === 'Employee');

// २. फक्त नावांची लिस्ट (Array) तयार करा
const studentNames = studentCats.map(c => c.category_name); // उदा: ["Gym", "Library"]
const employeeNames = employeeCats.map(c => c.category_name); // उदा: ["Salary"]


const professionChartData = {
    labels: ['Student', 'Employee'],
    datasets: [
        {
            label: 'Total Categories',
            data: [studentCats.length, employeeCats.length],
            backgroundColor: ['#3498db', '#2ecc71'],
            // आपण ही नावे 'extra' डेटा म्हणून साठवून ठेवतोय जेणेकरून टूलटिपमध्ये वापरता येतील
            namesData: [studentNames, employeeNames] 
        },
    ],
};
const chartOptions = {
    responsive: true,
    plugins: {
        tooltip: {
            callbacks: {
                // ही फंक्शन टूलटिपमध्ये जास्तीची माहिती जोडते
                afterLabel: function(context) {
                    const index = context.dataIndex; // 0 (Student) किंवा 1 (Employee)
                    const names = context.dataset.namesData[index];
                    if (names && names.length > 0) {
                        return `Categories: ${names.join(', ')}`; // नावे स्वल्पविराम देऊन जोडेल
                    }
                    return 'No categories added';
                }
            }
        }
    },
    scales: {
        y: { 
            beginAtZero: true, 
            ticks: { stepSize: 1 } // संख्या १, २, ३ अशीच दाखवण्यासाठी
        }
    }
};

    const fetchAdminData = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/all-users');
            if (res.data.success) {
                setUsers(res.data.users); 
                setTotalExpense(res.data.totalSystemExpense);
                if (res.data.stats) {
                    setStats(res.data.stats);
                }
            }
        } catch (err) {
            console.error("Admin Data Error:", err);
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.role === 'Admin') {
            fetchAdminData();
        } else {
            navigate('/');
        }
    }, []);

 

    // const handleDeleteUser = async (id, name) => {
    //     const confirm = await Swal.fire({
    //         title: `Delete ${name}?`,
    //         text: "This will remove all their data forever!",
    //         icon: 'warning',
    //         showCancelButton: true,
    //         confirmButtonColor: '#d33',
    //         confirmButtonText: 'Yes, Delete'
    //     });

    //     if (confirm.isConfirmed) {
    //         try {
    //             const res = await axios.delete(`http://localhost:5000/api/admin/delete-user/${id}`);
    //             if (res.data.success) {
    //                 Swal.fire('Deleted!', 'User has been removed.', 'success');
    //                 fetchAdminData();
    //             }
    //         } catch (err) {
    //             Swal.fire('Error', 'Could not delete user', 'error');
    //         }
    //     }
    // };

    const handleToggleStatus = async (userId, status, name) => {
        try {
            const res = await axios.put(`http://localhost:5000/api/admin/toggle-user/${userId}`, {
                currentStatus: status
            });
            if (res.data.success) {
                Swal.fire('Updated!', `${name} status changed.`, 'success');
                fetchAdminData(); 
            }
        } catch (err) {
            Swal.fire('Error', 'Something went wrong!', 'error');
        }
    };

    // SEARCH LOGIC: Username, Role, किंवा Email नुसार फिल्टर
    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleViewExpenses = async (userId, username) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/admin/user-expenses/${userId}`);
            if (res.data.success) {
                setSelectedUserExpenses(res.data.expenses);
                setSelectedUserName(username);
                setShowModal(true);
            }
        } catch (err) {
            Swal.fire('Error', 'Failed to load expenses!', 'error');
        }
    };

    const handleEditClick = (user) => {
        setEditData({ id: user.id, username: user.username, role: user.role, budget: user.budget });
        setShowEditModal(true);
    };

    const handleUpdateUser = async () => {
        try {
            const res = await axios.post(`http://localhost:5000/api/admin/update-user/${editData.id}`, editData);
            if (res.data.success) {
                Swal.fire('Success!', 'Updated successfully.', 'success');
                setShowEditModal(false);
                fetchAdminData();
            }
        } catch (err) {
            Swal.fire('Error', 'An error occurred while updating!', 'error');
        }
    };

    const exportSingleUserExpenses = () => {
        if (selectedUserExpenses.length === 0) return Swal.fire('Error', 'No data', 'info');
        const worksheet = XLSX.utils.json_to_sheet(selectedUserExpenses);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
        XLSX.writeFile(workbook, `${selectedUserName}_Expenses.xlsx`);
    };

    const handleDeleteExpense = async (expenseId, userId, username) => {
        const result = await Swal.fire({ title: 'Are You Sure?', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) {
            const res = await axios.delete(`http://localhost:5000/api/admin/delete-expense/${expenseId}`);
            if (res.data.success) {
                Swal.fire('Deleted!', '', 'success');
                handleViewExpenses(userId, username);
            }
        }
    };

    const fetchChartData = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/analytics/category-expenses');
            if (res.data.success) {
                setChartData({
                    labels: res.data.labels,
                    datasets: [{
                        data: res.data.data,
                        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
                    }]
                });
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => { if (showReportsModal) fetchChartData(); }, [showReportsModal]);

    const handleMasterReport = async () => {
        const res = await axios.get('http://localhost:5000/api/admin/master-report');
        if (res.data.success) {
            const ws = XLSX.utils.json_to_sheet(res.data.data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MasterReport");
            XLSX.writeFile(wb, "Master_Expense_Report.xlsx");
        }
    };

    // CORRECTED BUDGET OVERRUN LOGIC
    const handleBudgetOverrunReport = () => {
        const overruns = users.filter(u => Number(u.budget) > 0 && Number(u.total_spent) > Number(u.budget));
        if (overruns.length > 0) {
            const ws = XLSX.utils.json_to_sheet(overruns.map(u => ({
                "User": u.username, "Budget": u.budget, "Spent": u.total_spent, "Overrun": (u.total_spent - u.budget)
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Overrun");
            XLSX.writeFile(wb, "Budget_Overrun_Report.xlsx");
            Swal.fire('Alert', 'Overrun Report Downloaded', 'warning');
        } else {
            Swal.fire('Safe', 'No overruns found', 'success');
        }
    };

    // CORRECTED DATA FINDING (KEYWORD SEARCH)
    const handleDataFindingReport = async () => {
        const { value: keyword } = await Swal.fire({ title: 'Find Data', input: 'text', showCancelButton: true });
        if (keyword) {
            const results = users.filter(u => u.username.toLowerCase().includes(keyword.toLowerCase()));
            if (results.length > 0) {
                const ws = XLSX.utils.json_to_sheet(results);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Results");
                XLSX.writeFile(wb, `Search_${keyword}.xlsx`);
            } else {
                Swal.fire('Empty', 'No results', 'info');
            }
        }
    };

   const handleCategoryReport = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/admin/analytics/category-expenses');
        
        console.log("API Response:", res.data); // हे तपासा

        if (res.data && res.data.success) {
            // डेटा आहे की नाही याची खात्री करा
            if (!res.data.labels || res.data.labels.length === 0) {
                return Swal.fire('Info', 'No Category Data Available.', 'info');
            }

           const categoryData = res.data.labels.map((label, index) => {
    // व्हॅल्यूला नंबरमध्ये कन्व्हर्ट करा आणि ती नसेल तर 0 धरा
    const amount = Number(res.data.data[index] || 0);

    return {
        "Category Name": label,
        "Total Amount Spent": `₹${amount.toFixed(2)}`
    };
});

            const worksheet = XLSX.utils.json_to_sheet(categoryData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Category_Summary");

            XLSX.writeFile(workbook, "System_Category_Report.xlsx");
            
            Swal.fire('Success', 'Category-wise report downloaded!', 'success');
        } else {
            Swal.fire('Error', 'Failed to Fetch Data!', 'error');
        }
    } catch (err) {
        console.error("Full Error Object:", err);
        Swal.fire('Error', 'Unable to connect to the server!', 'error');
    }
};

    const handleInactiveUsersReport = () => {
        const inactive = users.filter(u => Number(u.total_spent) === 0);
        if (inactive.length > 0) {
            const ws = XLSX.utils.json_to_sheet(inactive);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inactive");
            XLSX.writeFile(wb, "Inactive_Users.xlsx");
        }
    };



    const handleTopSpendersReport = () => {
        const top = [...users].sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);
        const ws = XLSX.utils.json_to_sheet(top);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Top10");
        XLSX.writeFile(wb, "Top_Spenders.xlsx");
    };

    // UI Styles
    const reportCardStyle = { display: 'flex', justifyContent: 'space-between', padding: '15px', background: '#fff', border: '1px solid #ddd', borderRadius: '10px', marginBottom: '10px' };
    const downloadBtnStyle = { background: '#3498db', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' };


 const handleSavingsReport = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/admin/analytics/user-savings');
        
        if (res.data && res.data.success) {
            const savingsData = res.data.data.map((user) => {
                // डेटा सुरक्षितपणे Number मध्ये रूपांतरित करा
                const budget = Number(user.budget) || 0;
                const expense = Number(user.total_expense) || 0;
                const savings = budget - expense;

                return {
                    "User Name": user.username || 'N/A',
                    "Total Budget": budget.toFixed(2),
                    "Total Spent": expense.toFixed(2),
                    "Savings": savings.toFixed(2),
                    "Status": savings >= 0 ? "Safe" : "Over Budget"
                };
            });

            // एक्सेल फाईल बनवण्याचे लॉजिक (XLSX...)
            const worksheet = XLSX.utils.json_to_sheet(savingsData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Savings");
            XLSX.writeFile(workbook, "Savings_Report.xlsx");
            
            Swal.fire('Success', 'Report Downloaded Successfully!', 'success');
        }
    } catch (err) {
        console.error("Error Detail:", err.response?.data || err.message);
        Swal.fire('Error', 'No data received from the API. Please check the backend!', 'error');
    }
};

 const fetchCategories = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/categories');
            setAllCategories(res.data);
        } catch (err) {
            console.error("Error fetching categories", err);
        }
    };



useEffect(() => {
    const fetchCategories = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/admin/categories');
            console.log("Categories from DB:", res.data); // हे चेक करा
            setAllCategories(res.data); 
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };
    fetchCategories();
}, []);
const handleAddCategory = async () => {
    try {
        const res = await axios.post('http://localhost:5000/api/admin/categories', {
            profession, 
            category_name: newCategory 
        });

        if (res.data.success) {
            Swal.fire('Success', 'Category Added Successfully!', 'success');
            setNewCategory(''); // इनपुट साफ करा
            
            // सर्वात महत्वाचं: डेटा पुन्हा फेच करा जेणेकरून रिफ्रेशची गरज पडणार नाही
            fetchCategories(); 
        }
    } catch (err) {
        Swal.fire('Error', 'A Technical Issue Occured!', 'error');
    }
};

// १. कॅटेगरी डिलीट करण्यासाठी
const handleDeleteCategory = async (id) => {
    const confirm = await Swal.fire({
        title: 'Are you sure?',
        text: "Category Deleted Successfully!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, Delete'
    });

    if (confirm.isConfirmed) {
        try {
            const res = await axios.delete(`http://localhost:5000/api/admin/delete-category/${id}`);
            if (res.data.success) {
                Swal.fire('Deleted!', 'Category removed.', 'success');
                fetchCategories(); // लिस्ट रिफ्रेश करा
            }
        } catch (err) {
            Swal.fire('Error', 'An error occurred while deleting!', 'error');
        }
    }
};

// २. कॅटेगरी एडिट करण्यासाठी (Swal चा वापर करून)
const handleEditCategory = async (cat) => {
    const { value: newName } = await Swal.fire({
        title: 'Edit Category Name',
        input: 'text',
        inputValue: cat.category_name,
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value) return 'Name is Required!';
        }
    });

    if (newName && newName !== cat.category_name) {
        try {
            const res = await axios.put(`http://localhost:5000/api/admin/update-category/${cat.id}`, {
                category_name: newName
            });
            if (res.data.success) {
                Swal.fire('Updated!', 'Category name has been updated.', 'success');
                fetchCategories();
            }
        } catch (err) {
            Swal.fire('Error', 'An error occurred while updating!', 'error');
        }
    }
};



    return (
        <div className="admin-container">
            <div className="admin-header">
                <div className="header-left">
                    <span className="shield-icon">
    <img src={shieldImage} alt="Security Shield" className="shield-img" />
</span>
                    <h1>Admin Dashboard</h1>

                   
                </div>
                <div className="header-right">
                    <div className="user-avatar-container" onClick={() => navigate('/edit-profile')}>
                        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Profile" className="user-avatar-img" />
                    </div>

                  
                    <button className="logout-btn" onClick={() => { localStorage.removeItem('user'); navigate('/'); }}>Logout</button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card users"><h4>Total Users</h4><h2>{users.length}</h2></div>
                <div className="stat-card active"><h4>Active</h4><h2>{stats.active}</h2></div>
                <div className="stat-card inactive"><h4>Deactivated</h4><h2>{stats.inactive}</h2></div>
                <div className="stat-card expense"><h4>Total Expense</h4><h2>₹{totalExpense}</h2></div>
            </div>

            <div className="admin-actions">
                <input type="text" placeholder="Search user..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
                <button 
    onClick={() => {
        console.log("Button Clicked!"); // हे चेक करण्यासाठी टाका
        setShowReportsModal(true);
    }} 
    className="reports-btn"
>
    📊 View Reports
</button>
            </div>

            <div className="category-management">
                <h3>🛠️ Dynamic Category Management</h3>
                <div className="category-form">
                    <select value={profession} onChange={(e) => setProfession(e.target.value)}>
                        <option value="Student">Student</option>
                        <option value="Employee">Employee</option>
                    </select>
                    <input type="text" placeholder="Enter Category Name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                    <button onClick={handleAddCategory} className="add-cat-btn">Add Category</button>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Profession</th>
                                <th>Category Name</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
    {allCategories.length > 0 ? (
        allCategories.map((cat, index) => (
            <tr key={index}>
                <td><span className={`badge ${cat.profession.toLowerCase()}`}>{cat.profession}</span></td>
                <td>{cat.category_name}</td>
                <td>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="delete-btn">🗑️ Delete</button>
                </td>
            </tr>
        ))
    ) : (
        <tr>
            <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
                No categories available. Please add a new category.
            </td>
        </tr>
    )}
</tbody>
                    </table>
                </div>
            </div>

            <div className="user-table-container">
                <table className="user-table">
                    <thead>
                        <tr>
                            <th>Sr.No.</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Budget</th>
                            <th>Profession</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    
<tbody>
    {filteredUsers.length > 0 ? (
        filteredUsers.map((u, i) => (
            <tr key={u.id}>
                <td>{i + 1}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>₹{Number(u.budget).toLocaleString('en-IN')}</td>
                <td>{u.profession}</td>
                <td>
                    <button onClick={() => handleViewExpenses(u.id, u.username)} className="btn-view">View</button>
                    <button onClick={() => handleToggleStatus(u.id, u.is_active, u.username)} className={u.is_active === 1 ? "btn-deactivate" : "btn-activate"}>
                        {u.is_active === 1 ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => handleEditClick(u)} className="btn-edit">Edit</button>
                </td>
            </tr>
        ))
    ) : (
        <tr>
            <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#e74c3c', fontWeight: 'bold' }}>
                {searchTerm ? `No users found matching "${searchTerm}"` : "No user data available in the system."}
            </td>
        </tr>
    )}
</tbody>
                </table>
            </div>

            {showModal && (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '25px', borderRadius: '15px', width: '80%', maxHeight: '80%', overflowY: 'auto', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>📊 Expense of {selectedUserName} </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={exportSingleUserExpenses}
                        style={{ background: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                    >
                        📥 Download
                    </button>
                    <button 
                        onClick={() => setShowModal(false)} 
                        style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Close ✖
                    </button>
                </div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Date</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Description</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Category</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Amount</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Action</th> {/* 🟢 नवीन कॉलम हेड */}
                    </tr>
                </thead>
                <tbody>
                    {selectedUserExpenses.length > 0 ? (
                        selectedUserExpenses.map((exp) => (
                            <tr key={exp.id}>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{new Date(exp.date).toLocaleDateString()}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{exp.title}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{exp.category}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#e74c3c' }}>₹{exp.amount}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                                    {/* 🟢 डिलीट बटण */}
                                    <button 
                                        onClick={() => handleDeleteExpense(exp.id, exp.user_id, selectedUserName)}
                                        style={{ background: 'none', border: 'none', color: '#161515', cursor: 'pointer', fontSize: '18px' }}
                                        title="Delete Expense"
                                    >
                                        🗑️Delete
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>This user has not recorded any expenses yet.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
)}

{showEditModal && (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '350px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
            <h3>Edit User</h3>
            <div style={{ marginTop: '15px' }}>
                <label>Name:</label>
                <input type="text" value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                
                <label>Role:</label>
                <select value={editData.role} onChange={(e) => setEditData({...editData, role: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '10px' }}>
                    <option value="Student">Student</option>
                    <option value="Employee">Employee</option>
                </select>

                <label>Budget (₹):</label>
                <input type="number" value={editData.budget} onChange={(e) => setEditData({...editData, budget: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '20px' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleUpdateUser} style={{ flex: 1, background: '#2ecc71', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>Save ✅</button>
                <button onClick={() => setShowEditModal(false)} style={{ flex: 1, background: '#95a5a6', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>Cancel</button>
            </div>
        </div>
    </div>
)}

{showReportsModal && (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
        <div style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxHeight: '90%', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            {/* --- Header Section --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid #eee', paddingBottom: '15px' }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>📊 Reports & System Analytics</h2>
                <button 
                    onClick={() => setShowReportsModal(false)} 
                    style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Close ✖
                </button>
            </div>

            {/* --- Main Content Section --- */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }}>
                
                {/* डावी बाजू: Visual Analytics (Pie Chart) */}
                <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '15px', textAlign: 'center', border: '1px solid #eee' }}>
                    <h3 style={{ marginBottom: '20px', color: '#34495e' }}>Spending Analysis</h3>
                    <div style={{ width: '350px', margin: '0 auto' }}>
                        {chartData && chartData.labels && chartData.labels.length > 0 ? (
                            <Pie 
                                data={chartData} 
                                options={{ 
                                    plugins: { legend: { position: 'bottom' } },
                                    responsive: true 
                                }} 
                            />
                        ) : (
                            <div style={{ padding: '50px', color: '#7f8c8d' }}>
                                <p>No Data Available or Loading...</p>
                            </div>
                        )}
                    </div>
                </div>

    <div style={{ height: '300px', marginTop: '20px', padding: '10px', background: '#fff', borderRadius: '8px' }}>
    <h4 style={{ textAlign: 'center' }}>📊 Category Distribution by Profession</h4>
    <Bar data={professionChartData} options={chartOptions} />
</div>

                {/* उजवी बाजू: Reports List Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ marginBottom: '10px', color: '#34495e' }}>Download Specialized Reports</h3>
                    
                    {/* १. Master Report */}
                    <div style={reportCardStyle}>
                        <span>📁 Master Expense Report (All Users)</span>
                        <button onClick={handleMasterReport} style={downloadBtnStyle}>Download</button>
                    </div>

                    {/* २. Budget Overrun Report */}
                    <div style={reportCardStyle}>
                        <span>⚠️ Budget Overrun Alert (Users {">"} 100%)</span>
                        <button onClick={handleBudgetOverrunReport} style={{...downloadBtnStyle, background: '#f39c12'}}>View List</button>
                    </div>

                    {/* ३. Category Summary */}
                    <div style={reportCardStyle}>
                        <span>🍕 Category-wise Summary (System Total)</span>
                        <button onClick={handleCategoryReport} style={downloadBtnStyle}>Export</button>
                    </div>

                    {/* ४. Inactive Users */}
                    <div style={reportCardStyle}>
                        <span>😴 Inactive Users (Zero Activity)</span>
                        <button onClick={handleInactiveUsersReport} style={{...downloadBtnStyle, background: '#95a5a6'}}>Download</button>
                    </div>

                    {/* ५. High Spenders */}
                    <div style={reportCardStyle}>
                        <span>🏆 Top 10 Spenders of the Month</span>
                        <button onClick={handleTopSpendersReport} style={downloadBtnStyle}>Export</button>
                    </div>

                    <div style={reportCardStyle}>
    <span>💰 User Savings Summary (Budget vs Expense)</span>
    <button 
        onClick={handleSavingsReport} 
        style={{...downloadBtnStyle, background: '#27ae60'}}
    >
        Download Savings Report
    </button>
</div>

                    {/* ६. Data Finding Report */}
                    <div style={{...reportCardStyle, borderLeft: '5px solid #1abc9c'}}>
                        <span>🔍 Data Finding (Keyword Search)</span>
                        <button 
                            onClick={handleDataFindingReport} 
                            style={{...downloadBtnStyle, background: '#1abc9c'}}
                        >
                            Find & Export
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </div>
)}


        </div>
    );
};

export default AdminDashboard;