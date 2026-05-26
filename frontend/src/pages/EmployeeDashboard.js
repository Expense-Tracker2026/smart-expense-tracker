import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './EmployeeDashboard.css';
import shieldImage from '../images/logo.png';


const EmployeeDashboard = () => {
    const navigate = useNavigate();
    
    // १. सर्व स्टेट्स एकदाच लिहा
    const [expenses, setExpenses] = useState([]);
    const [budget, setBudget] = useState(0);
    const [user, setUser] = useState({});
    const [savingsGoal, setSavingsGoal] = useState(Number(localStorage.getItem('tempGoal')) || 0);
    const [availableCategories, setAvailableCategories] = useState([]);
   const [categoryLimits, setCategoryLimits] = useState({
        Miscellaneous: 1000,
        FamilyExpenses: 500,
        Medical: 1000,
        Entertainment: 1500,
        Shopping: 5000,
        Investments: 1000,
        Savings: 2000,
        EMI: 1000,
        Bills: 2000,
        Groceries: 1000,
        Recharge: 500,
        Travel: 900,
        Rent: 300,
        Food: 800
    });
const [searchTerm, setSearchTerm] = useState('');

    // २. कॅल्क्युलेशनचा भाग (फंक्शनच्या शेवटी, return च्या अगदी वर ठेवा)
    const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const currentBudget = parseFloat(budget || 0);
  const balance = currentBudget - totalSpent;
    const progressPercent = savingsGoal > 0 ? (balance / savingsGoal) * 100 : 0;
    
    const categoryTotals = expenses.reduce((acc, exp) => {
        const cat = exp.category || 'Other';
        acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount || 0);
        return acc;
    }, {});

    // २. आता categoryTotals वरून topCategory शोधा
const topCategory = Object.keys(categoryTotals).length > 0 
    ? Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b)
    : null;

const topCategoryAmount = topCategory ? categoryTotals[topCategory] : 0;

// २. टक्केवारी काढणे (Percentage)
const topCategoryPercent = currentBudget > 0 ? ((topCategoryAmount / currentBudget) * 100).toFixed(1) : 0;

// ३. फायनल मेसेज तयार करा
const scrollingMessage = topCategory 
    ? `You have spent the most this month on ${topCategory}: ₹${topCategoryAmount} (${topCategoryPercent}% of total budget)`
    : "No expenses recorded yet.";
    
    const currentSavingsGoal = parseFloat(savingsGoal || 0);
    const remainingToSave = currentSavingsGoal - balance; // ध्येयासाठी किती उरले


   

// LocalStorage मधून d मिळवा
const userEmail = localStorage.getItem('userEmail'); 
console.log("Current User Email:", userEmail); // कंसोलमध्ये चेक कर ईमेल दिसतोय का

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user')); // लॉगिन असलेल्या युजरची माहिती
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

  

// १. आधी fetchLimits ला स्वतंत्र फंक्शन म्हणून डिफाइन करा (useEffect च्या बाहेर)
const fetchLimits = async () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail || userEmail === "null") return;

    try {
        const response = await fetch(`${API_URL}/api/get-limits?email=${userEmail}`);
        if (response.ok) {
            const data = await response.json();
            const limitsObj = {};
            data.forEach(item => {
                // १. डेटाबेसमधून येणारे नाव ट्रिम करा
                const cleanName = item.category_name.trim();
                limitsObj[cleanName] = item.limit_amount;
            });
            
            // २. नवीन ऑब्जेक्ट ({...}) सेट करा, जेणेकरून React ला अपडेट समजेल
            setCategoryLimits({ ...limitsObj }); 
            console.log("डेटाबेसमधून आलेला नवीन डेटा:", limitsObj); 
        }
    } catch (error) {
        console.error("Fetch limits error:", error);
    }
};

// २. useEffect मध्ये फक्त fetchLimits कॉल करा
useEffect(() => {
    fetchLimits();
}, []);

// ३. अपडेट लिमिट फंक्शन
const handleUpdateLimit = async (category) => {
    const loggedInUserEmail = localStorage.getItem('userEmail'); 

    if (!loggedInUserEmail) {
        Swal.fire('Error!', 'Please log in first.', 'error');
        return;
    }

    const { value: newLimit } = await Swal.fire({
        title: `Set Limit for ${category}`,
        input: 'number',
        inputLabel: 'Enter amount (₹)',
        inputValue: categoryLimits[category.trim()] || 500,
        showCancelButton: true
    });

    // --- नवीन बदल (Validation) इथून सुरू होतो ---
    if (newLimit) {
        const limitVal = parseFloat(newLimit);
        
        // जर युजरने नंबरऐवजी काही चुकीचे टाईप केले तर हे थांबवेल
        if (isNaN(limitVal)) {
            Swal.fire('Error', 'Please Enter Valid Amount.', 'error');
            return;
        }
        // --- बदल संपला ---

        try {
            const response = await fetch(`${API_URL}/api/update-limit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: loggedInUserEmail,
                    category: category.trim(),
                    limit: limitVal // parseFloat केलेल्या व्हेरिएबलचा वापर करा
                })
            });

            const result = await response.json(); 

            if (response.ok && result.success) {
                Swal.fire('Saved!', 'The Limit has been Updated.', 'success');
                await fetchLimits(); 
            } else {
                Swal.fire('Error!', result.message || 'Update failed', 'error');
            }
        } catch (error) {
            console.error("Network Error:", error);
            Swal.fire('Error!', 'सर्व्हरशी संपर्क होऊ शकला नाही.', 'error');
        }
    }
};
    // खर्च लोड करण्यासाठी फंक्शन
    const fetchExpenses = useCallback(async (userId) => {
        try {
            const res = await axios.get(`${API_URL}/api/get-expenses/${userId}`);
            if (res.data.success) {
                setExpenses(res.data.expenses || []);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        }
    }, []);

    // बजेट अपडेट करण्यासाठी फंक्शन
const updateBudget = async () => {
    const { value: newBudget } = await Swal.fire({
        title: 'Update Monthly Salary / Budget',
        input: 'number',
        inputLabel: 'Enter your new budget (₹)',
        inputValue: budget,
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value || value <= 0) {
                return 'Please enter a valid amount!';
            }
        }
    });

    if (newBudget) {
        try {
            // बॅकएंड API ला कॉल करा (आपण आधीच /api/update-budget/:id बनवला आहे)
            const res = await axios.put(`${API_URL}/api/update-budget/${user.id}`, { budget: newBudget });
            
            if (res.data.success) {
                setBudget(newBudget); // UI अपडेट करा
                
                // LocalStorage मध्ये सुद्धा अपडेट करा जेणेकरून रिफ्रेश केल्यावर जुना डेटा दिसणार नाही
                const updatedUser = { ...user, budget: newBudget };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);

                Swal.fire('Updated!', 'Your budget has been updated.', 'success');
            }
        } catch (err) {
            console.error("Budget Update Error:", err);
            Swal.fire('Error', 'Could not update budget.', 'error');
        }
    }
};

// १. खर्च डिलीट करण्यासाठी फंक्शन
const deleteExpense = async (id) => {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const res = await axios.delete(`${API_URL}/api/delete-expense/${id}`);
            if (res.data.success) {
                Swal.fire('Deleted!', 'Your expense has been deleted.', 'success');
                fetchExpenses(user.id); // टेबल रिफ्रेश करा
            }
        } catch (err) {
            Swal.fire('Error', 'Could not delete expense', 'error');
        }
    }
};

// २. खर्च एडिट करण्यासाठी फंक्शन
const editExpense = (exp) => {
     const categoryOptions = availableCategories.map(cat => 
        `<option value="${cat.category_name}" ${cat.category_name === exp.category ? 'selected' : ''}>${cat.category_name}</option>`
    ).join('');
    Swal.fire({
        title: 'Edit Expense',
         html:
            `<input id="edit-title" class="swal2-input" placeholder="Title" value="${exp.title}">` +
            `<input id="edit-amount" type="number" class="swal2-input" placeholder="Amount" value="${exp.amount}" >` +
            `<select id="edit-category" class="swal2-input" >
                <option value="">Select Category</option>
                ${categoryOptions} 
            </select>`,
        showCancelButton: true,
        confirmButtonText: 'Update',
        preConfirm: () => {
            const title = document.getElementById('edit-title').value;
            const amount = document.getElementById('edit-amount').value;
            const category = document.getElementById('edit-category').value;
            if (!title || !amount) {
                Swal.showValidationMessage(`Please fill all fields!`);
                return false;
            }
            return { title, amount, category };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            console.log("Sending Data to Backend:", result.value); // हा डेटा कन्सोलवर दिसतोय का पहा
            try {
                // खात्री करा की URL बरोबर आहे
                const res = await axios.put(`${API_URL}/api/edit-expense/${exp.id}`, result.value);
                
                if (res.data.success) {
                    Swal.fire('Updated!', 'Expense updated successfully.', 'success');
                    fetchExpenses(user.id); // टेबल रिफ्रेश करा
                } else {
                    Swal.fire('Failed', res.data.message || 'Update failed', 'error');
                }
            } catch (err) {
                console.error("Frontend Edit Error:", err);
                Swal.fire('Error', 'Could not update expense', 'error');
            }
        }
    });
};


    useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem('user'));
    if (loggedInUser && (loggedInUser.role === 'Employee' || loggedInUser.profession === 'Employee')) {
        setUser(loggedInUser);
        setBudget(loggedInUser.budget || 0);
        fetchExpenses(loggedInUser.id);
        
        // डॅशबोर्ड लोड झाल्यावर युजरला स्टेटस दाखवण्यासाठी (Optional)
        // setTimeout(() => showSavingsAlert(), 1500); 
    } else {
        Swal.fire('Access Denied', 'This dashboard is for Employees only.', 'error');
        navigate('/');
    }
}, [fetchExpenses, navigate]); // येथे showSavingsAlert डिपेंडन्सी टाकू नका कारण ते वारंवार रन होईल

    const handleLogout = () => {
    // १. सर्व डेटा एकाच वेळी पुसून टाका (सर्वात सुरक्षित पद्धत)
    localStorage.clear(); 

    window.location.href = "/"; 
};



     // ३. प्रोग्रेस बारसाठी व्हेरिएबल्स डिक्लेअर केले
    const spentPercentage = budget > 0 ? (totalSpent / budget) * 100 : 0;
    const barColor = spentPercentage > 90 ? '#e74c3c' : spentPercentage > 70 ? '#f1c40f' : '#2ecc71';

    // --- खर्च ॲड करण्याचे मॉडेल ---
  const openAddExpenseModal = () => {

      if (!budget || parseFloat(budget) <= 0) {
        Swal.fire({
            title: 'Budget Not Set! ⚠️',
            text: 'Please set your Monthly Salary / Budget first before adding any expenses.',
            icon: 'warning',
            confirmButtonText: 'Set Budget Now',
            confirmButtonColor: '#075891',
        }).then((result) => {
            if (result.isConfirmed) {
                updateBudget(); // आपोआप बजेट अपडेट करण्याचे मॉडेल ओपन होईल
            }
        });
        return; // फंक्शन इथूनच थांबवा, पुढचा कोड रन होणार नाही
    }
    // १. उपलब्ध कॅटेगरीजमधून HTML Options तयार करा
    const categoryOptions = availableCategories.map(cat => 
        `<option value="${cat.category_name}">${cat.category_name}</option>`
    ).join('');

    Swal.fire({
        title: 'Add Expense',
        html:
            '<input id="swal-input1" class="swal2-input" placeholder="Expense Title">' +
            '<input id="swal-input2" type="number" class="swal2-input" placeholder="Amount (₹)" >' +
            // २. इथे आपण तयार केलेली categoryOptions स्ट्रिंग वापरली आहे
            `<select id="swal-input3" class="swal2-input" >
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

    const downloadPDF = () => {
        const doc = new jsPDF();
        
        // १. लॉगिन डेटा मिळवताना 'user' किंवा 'username' दोन्ही चेक करा
        const rawData = localStorage.getItem('username') || localStorage.getItem('user'); 
        let currentUserName = "Student";
    
        if (rawData) {
            try {
                // जर डेटा JSON String असेल (उदा. {"username": "Aarti..."})
                const userData = JSON.parse(rawData);
                currentUserName = userData.username || userData.name || "Student";
            } catch (e) {
                // जर डेटा साधी स्ट्रिंग असेल
                currentUserName = rawData;
            }
        }
    
        // २. बजेट आणि बॅलन्स
        const balance = budget - totalSpent;
    
        // --- PDF Design ---
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
    
        // टेबल
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
    
        // फाईलचे नाव सुद्धा डायनॅमिक करा
        doc.save(`Expense_Report_${currentUserName}.pdf`);
        // Swal.fire('Success', 'Your detailed report has been downloaded!', 'success');
        setTimeout(() => {
        showSavingsAlert();
    }, 1000); // १ सेकंदानंतर मेसेज दिसेल
    };

    // १. Spending Analysis (Pie Chart साठी डेटा)
const pieData = Object.keys(categoryTotals).map(cat => ({
    name: cat,
    value: categoryTotals[cat]
}));

// २. Spending Trend (Daily Line Chart साठी डेटा)
const dailyTrend = expenses.reduce((acc, exp) => {
    const date = new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    acc[date] = (acc[date] || 0) + parseFloat(exp.amount || 0);
    return acc;
}, {});

const lineData = Object.keys(dailyTrend).map(date => ({
    date,
    amount: dailyTrend[date]
})).reverse(); // नवीन तारखा उजवीकडे दिसण्यासाठी

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];


// बचतीनुसार मेसेज दाखवणारे फंक्शन
const showSavingsAlert = useCallback(() => {
    if (budget <= 0) return; // जर बजेट सेट नसेल तर मेसेज दाखवू नका

    if (balance > 0) {
        Swal.fire({
            title: 'Congratulations! 🎉',
            text: `You saved ₹${balance} this month. Great job!`,
            icon: 'success',
            confirmButtonColor: '#2ecc71'
        });
    } else if (balance === 0) {
        Swal.fire({
            title: 'Balanced! ⚖️',
            text: 'You spent exactly what you planned. Try to save something next time!',
            icon: 'info',
            confirmButtonColor: '#3498db'
        });
    } else {
        Swal.fire({
            title: 'Budget Exceeded! ⚠️',
            text: `You have spent ₹${Math.abs(balance)} more than your budget. Please control your expenses!`,
            icon: 'warning',
            confirmButtonColor: '#e74c3c'
        });
    }
}, [balance, budget]);

const handleSetGoal = async () => {
    const { value: newGoal } = await Swal.fire({
        title: 'Set Monthly Savings Goal',
        input: 'number',
        inputLabel: 'How much do you want to save this month?',
        showCancelButton: true,
        inputValidator: (value) => {
            if (!value || value <= 0) return 'Please Enter a Valid Amount!';
        }
    });

    if (newGoal) {
        try {
            const response = await axios.post(`${API_URL}/api/update-goal`, {
                email: localStorage.getItem('userEmail'),
                goal: parseFloat(newGoal)
            });
            if (response.data.success) {
                setSavingsGoal(parseFloat(newGoal));
                Swal.fire('Success', 'Budget Goal has been set!', 'success');
            }
        } catch (err) {
            Swal.fire('Error', 'Updated Successfully!', 'error');
        }
    }
};
console.log("Budget:", budget, "Spent:", totalSpent, "Goal:", savingsGoal);

const filteredExpenses = expenses.filter(exp => {
    const search = searchTerm.toLowerCase();
    
    // १. मूळ तारीख (2026-04-22) मिळवा
    const rawDate = exp.date ? exp.date.toString().toLowerCase() : "";
    
    // २. फॉरमॅट केलेली तारीख (22/4/2026) मिळवा
    const formattedDate = new Date(exp.date).toLocaleDateString('en-IN').toLowerCase();

    return (
        exp.title.toLowerCase().includes(search) || 
        exp.category.toLowerCase().includes(search) ||
        rawDate.includes(search) || // हे '2026' सर्च करायला मदत करेल
        formattedDate.includes(search) // हे '22/4' सर्च करायला मदत करेल
    );
});
    return (
        <div className="dashboard-container">
     <nav className="navbar">
     <span className="shield-icon">
                       <img src={shieldImage} alt="Security Shield" className="shield-img" />
                   </span>
    <div className="user-info">
        {/* १. भाषेचा ड्रॉपडाऊन इथे दिसेल */}
        

        <strong>Welcome, {user?.username} (Employee)</strong>

     <div className="user-avatar-circle" onClick={() => navigate('/edit-profile')}>
    <img 
        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" 
        alt="Profile" 
    />
</div>


        <button onClick={handleLogout} className="logout-btn">Logout</button>
    </div>
</nav>
{topCategory && totalSpent > 0 && (
    <div className="headline-container">
        <div className="headline-text">
            {/* <span>🚀 {scrollingMessage}</span> */}
            <span>🚀 {scrollingMessage}</span> {/* दोनदा टाकल्याने स्क्रोलिंगमध्ये खंड पडत नाही */}
        </div>
    </div>
)}
            

            <div className="stats-grid">
                <div className="stat-card" style={{ borderTop: '5px solid #3498db' }}>
                    <h3>Monthly Salary / Budget</h3>
                    <p className="amount" style={{ color: '#2c3e50' }}>₹{budget}</p>
                    <button className="edit-btn1" onClick={updateBudget}>Edit Budget</button>
                </div>

                <div className="stat-card" style={{ borderTop: '5px solid #e74c3c' }}>
                    <h3>Total Expenses</h3>
                    <p className="amount" style={{ color: '#e74c3c' }}>₹{totalSpent}</p>
                    <div className="expense-status">
            <small>{totalSpent > budget ? "⚠️ Exceeded Budget" : "✅ Within Budget"}</small>
        </div>
                </div>

                <div className="stat-card" style={{ borderTop: `5px solid ${balance > 0 ? '#2ecc71' : balance === 0 ? '#3498db' : '#e74c3c'}` }}>
                    <h3>Net Savings</h3>
                    <p className="amount" style={{ color: balance > 0 ? '#2ecc71' : balance === 0 ? '#3498db' : '#e74c3c' }}>
                        ₹{balance}
                    </p>
                    <div className="saving-status">
                        <small>
                            {balance > 0 && "Congratulations! 🎉 You saved some money."}
                            {balance === 0 && "Zero Savings! 💡 Try to save next time."}
                            {balance < 0 && "Overspent! ⚠️ Control your expenses."}
                        </small>
                    </div>
                </div>
                {/* Net Savings Card च्या खाली हा प्रोग्रेस बार टाका */}


                
  


            </div>
     {totalSpent > 0 && (
            <div className="budget-progress-container">
                <div 
                    className="progress-bar" 
                    style={{ width: `${spentPercentage}%`, background: barColor }}
                >
                    {spentPercentage.toFixed(0)}% Used
                </div>
            </div>
     )}

     

            <div className="category-grid">
 {Object.keys(categoryTotals).map((cat) => {
    const cleanCat = cat.trim();
    
    // १. डेटाबेसमधून व्हॅल्यू शोधा, नसेल तर ५०० डिफॉल्ट घ्या
    const dbLimit = categoryLimits[cleanCat];
    const finalLimit = dbLimit !== undefined ? dbLimit : 500;

    const isOverLimit = categoryTotals[cat] > finalLimit;

    return (
        <div key={cat} className={`category-card ${isOverLimit ? 'over-limit' : ''}`}>
            <div className="category-card-header">
                <span>{cat}</span>
                <button onClick={() => handleUpdateLimit(cat)} className="btn-gear">⚙️</button>
            </div>
            <div className="category-amount" style={{ color: isOverLimit ? '#e74c3c' : '#764ba2' }}>
                ₹{categoryTotals[cat]}
            </div>
            <div className="category-limit-info">
                Limit: <strong>₹{finalLimit}</strong>
            </div>
            {isOverLimit && <div className="alert-text">⚠️ Alert: Limit Exceeded!</div>}
        </div>
    );
})}
</div>

            <div className="action-buttons" style={{ padding: '0 2rem' }}>
                <button onClick={openAddExpenseModal} className="btn-primary-action">+ Add New Expense</button>
                 <button onClick={() => handleSetGoal(true)} className="btn-goal-action">
        🎯 Set Savings Goal
    </button>
                {totalSpent > 0 && (
                    <button onClick={downloadPDF} className="btn-pdf-action">📄 Download PDF Report</button>
                )}
            </div>

 <div className="news-ticker-container">
    <div className="ticker-text">
        {/* १. ही कंडिशन तपासा: जर गोल नसेल किंवा तो ० असेल */}
        {(!savingsGoal || Number(savingsGoal) === 0) ? (
            <span style={{ color: '#d61010' }}>
                Welcome! Please set a savings goal to track progress.
            </span>
        ) : 
        /* २. जर ओव्हरस्पेंड झाले असेल */
        Number(balance) < 0 ? (
            <span style={{ color: '#e74c3c' }}>
                ⚠️ Warning! Overspent by ₹{Math.abs(balance).toFixed(2)} 📈
            </span>
        ) : 
        /* ३. जर अजून गोल पूर्ण झाला नसेल */
        Number(remainingToSave) > 0 ? (
            <span style={{ color: '#f39c12' }}>
                🚀 Progress: {Number(progressPercent).toFixed(1)}% | Need to save: ₹{Number(remainingToSave).toFixed(2)} 💪
            </span>
        ) : (
            /* ४. गोल पूर्ण झाला असेल तर */
            <span style={{ color: '#27ae60' }}>
                🎉 Goal of ₹{savingsGoal} Achieved! Savings: ₹{Number(balance).toFixed(2)} 💰
            </span>
        )}
    </div>
</div>

<div style={{ margin: '20px 0', textAlign: 'center' }}>
    <input
        type="text"
        placeholder="🔍 Search Name,Date..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
            width: '80%',
            maxWidth: '500px',
            padding: '12px 20px',
            borderRadius: '25px',
            border: '1px solid #ddd',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            outline: 'none',
            fontSize: '16px'
        }}
    />
</div>

              <h3 className="table-header">Expense details</h3>
 {totalSpent > 0 && (
            <div className="table-responsive">
               
                    <>
                    <table className="expense-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Amount</th>
                                <th>Category</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.length > 0 ? (
                                filteredExpenses.map((exp) => (
                                    <tr key={exp.id}>
                                        <td>{exp.title}</td>
                                        <td>₹{exp.amount}</td>
                                        <td><span className="badge">{exp.category}</span></td>
                                        <td>{new Date(exp.date).toLocaleDateString()}</td>
                                        <td>
                                            <button className="btn-edit" onClick={() => editExpense(exp)}>Edit</button>
                                            <button className="btn-delete" onClick={() => deleteExpense(exp.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="5" style={{textAlign: 'center'}}>No Expenses found.</td></tr>
                            )}
                        </tbody>
                    </table>

                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Spending Analysis</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
<Pie 
  data={pieData} 
  cx="50%" 
  cy="40%" 
  innerRadius={45}   
  outerRadius={75}   
  fill="#8884d8" 
  dataKey="value" 
  label={false}      
>
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>


                                    

                                    <Tooltip />
                                  <Legend 
  verticalAlign="bottom" 
  layout="horizontal" 
  align="center"
  wrapperStyle={{
    fontSize: '12px',
    paddingTop: '10px',
    maxHeight: '80px',     
    overflowY: 'auto',
       position: 'relative',   
    marginTop: '20px'   

  }} 
/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-card">
                            <h3>Spending Trend (Daily)</h3>
                            <ResponsiveContainer width="100%" height="90%">
                                <LineChart data={lineData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend 
  verticalAlign="bottom" 
  layout="horizontal" 
  align="center"
  wrapperStyle={{
    fontSize: '12px',
    paddingTop: '10px',
    maxHeight: '80px',     // लेजेंड्सची उंची मर्यादित केली
    overflowY: 'auto'      // जास्त कॅटेगरी असतील तर तिथेच स्क्रोल होतील
  }} 
/>
                                    <Line type="monotone" dataKey="amount" stroke="#2c3e50" strokeWidth={3} dot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    </>
               
            </div>
             )}

   
        </div>
    );
};

export default EmployeeDashboard;

