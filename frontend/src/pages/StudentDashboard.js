import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Login.css'; // तुमची मूळ CSS फाईल
import hourglassIcon from '../images/hourglass.png';
import shieldImage from '../images/logo.png';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [budget, setBudget] = useState(0);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState({});
    const [categoryLimits, setCategoryLimits] = useState(
        JSON.parse(localStorage.getItem('category_limits')) || { "Food": 500, "Travel": 500, "Stationery": 500, "Fees": 5000, "Other": 500 }
    );
    const [availableCategories, setAvailableCategories] = useState([]);
    const [savingsGoal, setSavingsGoal] = useState(Number(localStorage.getItem('tempGoal')) || 0);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.profession) {
            axios.get(`${API_URL}/api/user/categories/${user.profession}`)
                .then(res => {
                    if (res.data.success) {
                        setAvailableCategories(res.data.categories);
                    }
                })
                .catch(err => console.error("Error fetching categories", err));
        }
    }, []);

    const fetchExpenses = async (userId) => {
        try {
            const res = await axios.get(`${API_URL}/api/get-expenses/${userId}`);
            if (res.data.success) {
                setExpenses(res.data.expenses);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    };

    useEffect(() => {
        const loggedInUser = JSON.parse(localStorage.getItem('user'));
        if (loggedInUser && loggedInUser.id) {
            setUser(loggedInUser);
            setBudget(loggedInUser.budget || 0);
            fetchExpenses(loggedInUser.id);
        }
    }, []);

    const handleLogout = () => {
        localStorage.clear(); 
        window.location.href = "/"; 
    };

    const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    const getBudgetStatus = () => {
        const diff = budget - totalSpent;
        if (diff < 0) {
            return {
                msg: `⚠️ You are ₹${Math.abs(diff)} in debt! Your wallet is empty, better get a hold of it now 💸`,
                color: '#e74c3c'
            };
        } 
        else if (diff === 0) {
            return {
                msg: `😐 Your balance is ₹0. You’ve used your entire budget. Try to save next time!`,
                color: '#f39c12'
            };
        }
        else if (totalSpent > 0 && totalSpent <= budget) {
            return {
                msg: `🎉 Congratulations! You’ve saved ₹${diff}. Keep saving like this 💰✨`,
                color: '#27ae60',
                type: 'success'
            };
        }
        return null;
    };

    const status = getBudgetStatus();

    const categoryTotals = expenses.reduce((acc, exp) => {
        const cat = exp.category || 'Other';
        acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount);
        return acc;
    }, {});

    const spentPercentage = Math.min((totalSpent / budget) * 100, 100);
    const barColor = spentPercentage > 80 ? '#e74c3c' : '#27ae60';

    const handleSetBudget = async () => {
        const { value: newBudget } = await Swal.fire({
            title: 'Set Your Monthly Budget',
            input: 'number',
            inputValue: budget,
            showCancelButton: true
        });

        if (newBudget) {
            try {
                const updatedValue = parseFloat(newBudget);
                const res = await axios.put(`${API_URL}/api/update-budget/${user.id}`, { 
                    budget: updatedValue 
                });

                if (res.data && res.data.success) {
                    const currentUser = JSON.parse(localStorage.getItem('user'));
                    const newUserObj = { ...currentUser, budget: updatedValue };
                    localStorage.setItem('user', JSON.stringify(newUserObj));

                    setBudget(updatedValue);
                    setUser(newUserObj);

                    await Swal.fire('Updated!', 'The budget has been changed', 'success');
                    window.location.reload();
                }
            } catch (err) {
                console.error("Error:", err);
                Swal.fire('Error', 'No response was received from the server.', 'error');
            }
        }
    };

    const openAddExpenseModal = () => {
        if (!budget || parseFloat(budget) <= 0) {
            Swal.fire({
                title: 'Budget Not Set! ⚠️',
                text: 'Please set your Monthly Salary / Budget first before adding any expenses.',
                icon: 'warning',
                confirmButtonText: 'Set Budget Now',
                confirmButtonColor: '#27ae60',
            }).then((result) => {
                if (result.isConfirmed) {
                    handleSetBudget();
                }
            });
            return;
        }
        const categoryOptions = availableCategories.map(cat => 
            `<option value="${cat.category_name}">${cat.category_name}</option>`
        ).join('');

        Swal.fire({
            title: 'Add Expense',
            html:
                '<input id="swal-input1" class="swal2-input" placeholder="Expense Title">' +
                '<input id="swal-input2" type="number" class="swal2-input" placeholder="Amount (₹)" style="margin-bottom:15px;">' +
                `<select id="swal-input3" class="swal2-input" style="width:280px">
                    <option value="">Select Category</option>
                    ${categoryOptions}
                 </select>`,
            showCancelButton: true,
            confirmButtonText: 'Save',
            preConfirm: () => {
                const title = document.getElementById('swal-input1').value;
                const amount = document.getElementById('swal-input2').value;
                const category = document.getElementById('swal-input3').value;
                if (!title || !amount || !category) {
                    Swal.showValidationMessage(`Please fill all fields!`);
                    return false;
                }
                return { title, amount, category };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const finalData = { 
                        user_id: user.id, 
                        ...result.value, 
                        date: new Date().toISOString().split('T')[0] 
                    };
                    const res = await axios.post(`${API_URL}/api/add-expense`, finalData);
                    if (res.data.success) {
                        Swal.fire('Success', 'Expense Added!', 'success');
                        fetchExpenses(user.id);
                    }
                } catch (err) {
                    Swal.fire('Error', 'Could not add expense', 'error');
                }
            }
        });
    };

    const handleDelete = async (id) => {
        const confirm = await Swal.fire({
            title: 'Are you sure?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });
        if (confirm.isConfirmed) {
            try {
                await axios.delete(`${API_URL}/api/delete-expense/${id}`);
                Swal.fire('Deleted!', 'Removed.', 'success');
                fetchExpenses(user.id); 
            } catch (err) {
                Swal.fire('Error', 'Problem while deleting.', 'error');
            }
        }
    };

    const editExpense = (exp) => {
        const categoryOptions = availableCategories.map(cat => {
            const isSelected = exp.category && cat.category_name && 
                exp.category.toString().trim().toLowerCase() === cat.category_name.toString().trim().toLowerCase();
            return `<option value="${cat.category_name}" ${isSelected ? 'selected="selected"' : ''}>
                ${cat.category_name}
            </option>`;
        }).join('');

        Swal.fire({
            title: 'Edit Expense',
            html:
                `<input id="edit-title" class="swal2-input" value="${exp.title}" placeholder="Title">` +
                `<input id="edit-amount" type="number" class="swal2-input" value="${exp.amount}" placeholder="Amount" style="margin-bottom:15px;">` +
                `<select id="edit-category" class="swal2-input" style="width:280px">
                    <option value="">Select Category</option>
                    ${categoryOptions} 
                </select>`,
            showCancelButton: true,
            confirmButtonText: 'Update',
            preConfirm: () => {
                const title = document.getElementById('edit-title').value;
                const amount = document.getElementById('edit-amount').value;
                const category = document.getElementById('edit-category').value;
                if (!title || !amount || !category) {
                    Swal.showValidationMessage(`Please fill all fields!`);
                    return false;
                }
                return { title, amount, category };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await axios.put(`${API_URL}/api/edit-expense/${exp.id}`, result.value);
                    if (res.data.success) {
                        Swal.fire('Updated!', 'Expense updated successfully.', 'success');
                        fetchExpenses(user.id);
                    }
                } catch (err) {
                    Swal.fire('Error', 'Could not update expense', 'error');
                }
            }
        });
    };

    const dailyDataMap = expenses.reduce((acc, exp) => {
        const date = new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        acc[date] = (acc[date] || 0) + parseFloat(exp.amount);
        return acc;
    }, {});

    const chartData = Object.keys(dailyDataMap).map(date => ({
        date,
        amount: dailyDataMap[date]
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    const handleUpdateLimit = async (category) => {
        const userEmail = localStorage.getItem('userEmail'); 
        const { value: newLimit } = await Swal.fire({
            title: `Set new limits for ${category}`,
            input: 'number',
            inputLabel: 'Amount (₹)',
            inputValue: categoryLimits[category] || 500,
            showCancelButton: true,
            confirmButtonColor: '#764ba2',
        });

        if (newLimit) {
            try {
                const response = await axios.post(`${API_URL}/api/update-limit`, {
                    email: userEmail,
                    category: category.trim(),
                    limit: parseFloat(newLimit)
                });

                if (response.data.success) {
                    const updatedLimits = { ...categoryLimits, [category]: parseFloat(newLimit) };
                    setCategoryLimits(updatedLimits);
                    localStorage.setItem('category_limits', JSON.stringify(updatedLimits));
                    Swal.fire('Saved!', `Limit for ${category} updated Successfully.`, 'success');
                }
            } catch (error) {
                Swal.fire('Error!', 'Could not save to database.', 'error');
            }
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        const rawData = localStorage.getItem('username') || localStorage.getItem('user'); 
        let currentUserName = "Student";

        if (rawData) {
            try {
                const userData = JSON.parse(rawData);
                currentUserName = userData.username || userData.name || "Student";
            } catch (e) {
                currentUserName = rawData;
            }
        }

        const balance = budget - totalSpent;
        doc.setFontSize(22);
        doc.setTextColor(118, 75, 162);
        doc.text("Monthly Expense Report", 14, 22);
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0); 
        doc.text(`Student Name: ${currentUserName}`, 14, 35); 
        doc.text(`Total Budget: Rs. ${budget}`, 14, 43);
        doc.text(`Total Spent: Rs. ${totalSpent}`, 14, 51);
        
        if (balance > 0) {
            doc.setTextColor(39, 174, 96);
            doc.text(`Total Savings: Rs. ${balance}`, 14, 59);
        } else {
            doc.setTextColor(231, 76, 60);
            doc.text(`Status: Budget Exceeded by Rs. ${Math.abs(balance)}`, 14, 59);
        }

        const tableColumn = ["Date", "Title", "Category", "Amount (Rs.)"];
        const tableRows = expenses.map(exp => [
            new Date(exp.date).toLocaleDateString(),
            exp.title,
            exp.category,
            exp.amount
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 68,
            theme: 'grid',
            headStyles: { fillColor: [118, 75, 162] },
            styles: { fontSize: 10 }
        });

        doc.save(`Expense_Report_${currentUserName}.pdf`);
        Swal.fire('Success', 'Your detailed report has been downloaded!', 'success');
    };

    const topCategory = Object.keys(categoryTotals).length > 0 
        ? Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b)
        : null;

    const topCategoryAmount = topCategory ? categoryTotals[topCategory] : 0;
    const topCategoryPercent = budget > 0 ? ((topCategoryAmount / budget) * 100).toFixed(1) : 0;

    const scrollingMessage = topCategory 
        ? `🔥 Alert: You have spent the most this month on ${topCategory}: ₹${topCategoryAmount} (${topCategoryPercent}% of your budget).`
        : "Welcome! Start adding expenses to see your spending analysis.";

    const handleSetGoal = async () => {
        const { value: newGoal } = await Swal.fire({
            title: 'Set Monthly Savings Goal',
            input: 'number',
            inputLabel: 'How much do you want to save this month?',
            showCancelButton: true,
            confirmButtonColor: '#764ba2',
            inputValidator: (value) => {
                if (!value || value <= 0) return 'Please Enter a Valid Amount!';
            }
        });

        if (newGoal) {
            const goalValue = parseFloat(newGoal);
            try {
                const response = await axios.post(`${API_URL}/api/update-goal`, {
                    email: localStorage.getItem('userEmail'),
                    goal: goalValue
                });
                if (response.data.success) {
                    setSavingsGoal(goalValue);
                    Swal.fire('Success', 'Savings Goal has been set!', 'success');
                }
            } catch (err) {
                Swal.fire('Error', 'Could not save the goal to database.', 'error');
            }
        }
    };

    const safeBudget = parseFloat(budget) || 0;
    const safeTotalSpent = parseFloat(totalSpent) || 0;
    const safeSavingsGoal = parseFloat(savingsGoal) || 0;
    const balance = safeBudget - safeTotalSpent;
    const progressPercent = safeSavingsGoal > 0 ? (balance / safeSavingsGoal) * 100 : 0;
    const remainingToSave = safeSavingsGoal - balance;

    useEffect(() => {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            setLoading(true);
            axios.get(`${API_URL}/api/user-data?email=${userEmail}`)
                .then(res => {
                    if (res.data.success) {
                        const dbGoal = Number(res.data.savings_goal) || 0;
                        setSavingsGoal(dbGoal);
                        setBudget(Number(res.data.budget));
                        localStorage.setItem('tempGoal', dbGoal);
                    }
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, []);

    const filteredExpenses = expenses.filter(exp => {
        const search = searchTerm.toLowerCase();
        const rawDate = exp.date ? exp.date.toString().toLowerCase() : "";
        const formattedDate = new Date(exp.date).toLocaleDateString('en-IN').toLowerCase();
        return (
            exp.title.toLowerCase().includes(search) || 
            exp.category.toLowerCase().includes(search) ||
            rawDate.includes(search) || 
            formattedDate.includes(search)
        );
    });

    return (
        <div className="admin-container"> {/* 💡 responsive base container */}
            <nav className="admin-header">
               <div className="header-left">
                   <img src={shieldImage} alt="Security Shield" className="shield-img" />
                   <h1>Hi, {user?.username} (Student)</h1>
               </div>
                <div className="header-right">
                    <div className="user-avatar-container" onClick={() => navigate('/edit-profile')}>
                        <img 
                            src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" 
                            alt="Profile" 
                            className="user-avatar-img"
                        />
                    </div>
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
                </div>
            </nav>

            <div className="scrolling-headline">
                <div className="headline-content">
                    <span>{scrollingMessage}</span>
                    <span>{scrollingMessage}</span>
                </div>
            </div>

            {status && (
                <div style={{
                    background: status.color,
                    color: 'white',
                    padding: '15px',
                    borderRadius: '10px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    marginBottom: '20px'
                }}>
                    {status.msg}
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card users">
                    <h3>Total Budget (Monthly)</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold' }}>₹{budget || 0}</p>
                    <button className="reports-btn" style={{ marginTop: '10px', padding: '6px 12px' }} onClick={handleSetBudget}>Edit Budget</button>
                </div>
                <div className="stat-card inactive">
                    <h3>Spent Expense</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>₹{totalSpent}</p>
                </div>
                <div className="stat-card active">
                    <h3>Balance Amount</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>₹{budget - totalSpent}</p>
                </div>
            </div>

            {expenses.length > 0 && (
                <div style={{ margin: '25px 0', background: '#eee', borderRadius: '10px', height: '20px', width: '100%', overflow: 'hidden' }}>
                    <div 
                        style={{
                            width: `${spentPercentage}%`, 
                            background: barColor, 
                            height: '100%', 
                            transition: 'width 0.5s ease-in-out',
                            textAlign: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            lineHeight: '20px'
                        }}
                    >
                        {spentPercentage.toFixed(0)}% Used
                    </div>
                </div>
            )}

            <div className="admin-actions" style={{ justifyContent: 'center' }}>
                {Object.keys(categoryTotals).map((cat) => {
                    const limit = categoryLimits[cat] || 500;
                    const isOverLimit = categoryTotals[cat] > limit;
                    return (
                        <div key={cat} style={{
                            background: isOverLimit ? '#fff5f5' : 'white',
                            padding: '15px',
                            borderRadius: '12px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            borderLeft: `5px solid ${isOverLimit ? '#e74c3c' : '#764ba2'}`,
                            minWidth: '150px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', color: '#555' }}>{cat}</span>
                                <button onClick={() => handleUpdateLimit(cat)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>⚙️</button>
                            </div>
                            <div style={{ fontSize: '20px', color: isOverLimit ? '#e74c3c' : '#764ba2', fontWeight: 'bold', margin: '5px 0' }}>
                                ₹{categoryTotals[cat]}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>
                                Limit: <b>₹{limit}</b>
                            </div>
                            {isOverLimit && <div style={{ fontSize: '10px', color: '#e74c3c', fontWeight: 'bold' }}>⚠️ Exceeded!</div>}
                        </div>
                    );
                })}
            </div>

            <div className="admin-actions" style={{ justifyContent: 'center' }}>
                <button onClick={openAddExpenseModal} className="reports-btn" style={{ background: '#764ba2' }}>+ Add Expense</button>
                <button onClick={handleSetGoal} className="reports-btn" style={{ background: '#f39c12' }}>🎯 Set Savings Goal</button>
                <button onClick={downloadPDF} className="reports-btn" style={{ background: '#27ae60' }}>📄 Download Report</button>
            </div>

            <div className="scrolling-headline" style={{ background: '#f1c40f', margin: '20px 0' }}>
                <div className="headline-content" style={{ color: '#333' }}>
                    {loading ? (
                        <span>Updating values... ⏳</span>
                    ) : balance < 0 ? (
                        <span>⚠️ Warning! Overspent by ₹{Math.abs(balance).toFixed(2)}</span>
                    ) : safeSavingsGoal > 0 && remainingToSave > 0 ? (
                        <span>🚀 Progress: {progressPercent.toFixed(1)}% | Need to save: ₹{remainingToSave.toFixed(2)}</span>
                    ) : safeSavingsGoal > 0 && balance >= safeSavingsGoal ? (
                        <span>🎉 Goal of ₹{safeSavingsGoal} Achieved!</span>
                    ) : (
                        <span>Welcome! Please set a savings goal to track progress.</span>
                    )}
                </div>
            </div>

            <div style={{ margin: '20px 0', textAlign: 'center' }}>
                <input
                    type="text"
                    placeholder="🔍 Search Names, Dates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    style={{ borderRadius: '25px', padding: '12px 20px' }}
                />
            </div>

            <h3 style={{ textDecoration: 'underline', textAlign: 'center', margin: '20px 0' }}>Expense Details</h3>
            
            <div className="table-responsive"> {/* 💡 मोबाईलवर टेबल स्क्रोल होण्यासाठी पॅक केला */}
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Expense</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.length > 0 ? (
                            filteredExpenses.map((exp) => (
                                <tr key={exp.id}>
                                    <td>{exp.title}</td>
                                    <td>₹{exp.amount}</td>
                                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                                    <td>
                                        <button onClick={() => editExpense(exp)} className="btn-view">Edit</button>
                                        <button onClick={() => handleDelete(exp.id)} className="btn-deactivate">Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" style={{ textAlign: 'center' }}>No Expense found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {budget > 0 && expenses.length > 0 && (
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: '30px' }}>
                    
                    {/* 📊 पाई चार्ट कार्ड */}
                    <div className="stat-card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Spending Analysis</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.keys(categoryTotals).map(cat => ({ name: cat, value: categoryTotals[cat] }))}
                                    cx="50%"
                                    cy="40%"
                                    innerRadius={45}
                                    outerRadius={75}
                                    dataKey="value"
                                    label={false}
                                >
                                    {Object.keys(categoryTotals).map((entry, index) => {
                                        const hue = (index * 137.5) % 360;
                                        return <Cell key={`cell-${index}`} fill={`hsl(${hue}, 70%, 60%)`} />;
                                    })}
                                </Pie>
                               
                                <Tooltip />
                                <Legend 
                                    verticalAlign="bottom" 
                                    layout="horizontal" 
                                    align="center"
                                    wrapperStyle={{ position: 'relative', marginTop: '20px', fontSize: '11px', maxHeight: '80px', overflowY: 'auto' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 📈 लाईन चार्ट कार्ड */}
                    <div className="stat-card" style={{ minHeight: '400px' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Spending Trend (Daily)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="amount" stroke="#764ba2" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                                <Legend verticalAlign="bottom" align="center" wrapperStyle={{ position: 'relative', marginTop: '10px' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}
        </div>
    );
};

export default StudentDashboard;