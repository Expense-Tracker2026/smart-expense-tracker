import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { PieChart, Pie,Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // हे 'autoTable' म्हणून इम्पोर्ट करा
import './Login.css'; // तुमची CSS फाईल
import hourglassIcon from '../images/hourglass.png';
import shieldImage from '../images/logo.png';


const StudentDashboard = () => {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
   const [budget, setBudget] = useState(0);
   const [loading, setLoading] = useState(true); // नवीन स्टेट
const [user, setUser] = useState({});
    const [categoryLimits, setCategoryLimits] = useState(
    JSON.parse(localStorage.getItem('category_limits')) || { "Food": 500, "Travel": 500, "Stationery": 500, "Fees": 5000, "Other": 500 }
);
const [availableCategories, setAvailableCategories] = useState([]);

const [savingsGoal, setSavingsGoal] = useState(Number(localStorage.getItem('tempGoal')) || 0);
const [searchTerm, setSearchTerm] = useState('');
const [isEditingProfile, setIsEditingProfile] = useState(false);
const [newName, setNewName] = useState("");
const [userName, setUserName] = useState(""); // डिस्प्ले करण्यासाठी


useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user')); // लॉगिन असलेल्या युजरची माहिती
    if (user && user.profession) {
        axios.get(`http://localhost:5000/api/user/categories/${user.profession}`)
            .then(res => {
                if (res.data.success) {
                    setAvailableCategories(res.data.categories);
                }
            })
            .catch(err => console.error("Error fetching categories", err));
    }
}, []);
   

   // १. खर्च लोड करण्यासाठी फंक्शन
    const fetchExpenses = async (userId) => {
        try {
            const res = await axios.get(`http://localhost:5000/api/get-expenses/${userId}`);
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
        fetchExpenses(loggedInUser.id); // फक्त ID असेल तरच कॉल करा
    }
}, []);

  const handleLogout = () => {
    // १. सर्व डेटा एकाच वेळी पुसून टाका (सर्वात सुरक्षित पद्धत)
    localStorage.clear(); 

    window.location.href = "/"; 
};

    // --- लॉजिक सेक्शन (हे क्रमाने असायला हवे) ---

    // १. एकूण खर्च मोजणे
    const totalSpent = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    // २. बजेट स्टेटस तपासणे (हे आता totalSpent च्या खाली आहे)
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

    // ३. कॅटेगरीनुसार विभागणी
    const categoryTotals = expenses.reduce((acc, exp) => {
        const cat = exp.category || 'Other';
        acc[cat] = (acc[cat] || 0) + parseFloat(exp.amount);
        return acc;
    }, {});

    
    const spentPercentage = Math.min((totalSpent / budget) * 100, 100);
    const barColor = spentPercentage > 80 ? '#e74c3c' : '#27ae60';

    // --- इव्हेंट हँडलर्स ---
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
            // बॅकएंडला कॉल
            const res = await axios.put(`http://localhost:5000/api/update-budget/${user.id}`, { 
                budget: updatedValue 
            });

            if (res.data && res.data.success) {
                // LocalStorage अपडेट करा
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
                handleSetBudget(); // आपोआप बजेट अपडेट करण्याचे मॉडेल ओपन होईल
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
            '<input id="swal-input2" type="number" class="swal2-input" placeholder="Amount (₹)" style="margin-bottom:15px;">' +
            // २. इथे आपण तयार केलेली categoryOptions स्ट्रिंग वापरली आहे
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
                const res = await axios.post('http://localhost:5000/api/add-expense', finalData);
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

    const handleSaveExpense = async (expenseData) => {
        try {
            const finalData = { user_id: user.id, ...expenseData };
            const res = await axios.post('http://localhost:5000/api/add-expense', finalData);
            if (res.data.success) {
                Swal.fire('Success!', 'Recorded.', 'success');
                fetchExpenses(user.id);
            }
        } catch (err) {
            Swal.fire('Oops!', 'Something went wrong', 'error');
        }
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
                await axios.delete(`http://localhost:5000/api/delete-expense/${id}`);
                Swal.fire('Deleted!', 'Removed.', 'success');
                fetchExpenses(user.id); 
            } catch (err) {
                Swal.fire('Error', 'Problem while deleting.', 'error');
            }
        }
    };

const editExpense = (exp) => {
    // कन्सोलमध्ये चेक करा की दोन्ही व्हॅल्यूज सारख्याच आहेत का
    console.log("Expense Category from DB:", exp.category);
    console.log("List of Available Categories:", availableCategories);

    const categoryOptions = availableCategories.map(cat => {
        // १. दोन्ही व्हॅल्यूज सुरक्षितपणे स्ट्रिंगमध्ये रूपांतरित करा, रिकाम्या जागा काढा (trim) 
        // आणि तुलना करताना त्या lowercase मध्ये करा जेणेकरून कॅपिटल लेटरचा फरक पडणार नाही.
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
                const res = await axios.put(`http://localhost:5000/api/edit-expense/${exp.id}`, result.value);
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
// १. तारखेनुसार खर्चाचा डेटा तयार करणे
const dailyDataMap = expenses.reduce((acc, exp) => {
    const date = new Date(exp.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    acc[date] = (acc[date] || 0) + parseFloat(exp.amount);
    return acc;
}, {});

// २. डेटा ग्राफसाठी योग्य फॉरमॅटमध्ये रूपांतरित करणे (उदा. [{date: '10 Mar', amount: 500}, ...])
const chartData = Object.keys(dailyDataMap).map(date => ({
    date,
    amount: dailyDataMap[date]
})).sort((a, b) => new Date(a.date) - new Date(b.date)); // तारखेनुसार क्रम लावणे


const handleUpdateLimit = async (category) => {
    // युजरचा ईमेल मिळवा (जो आपण लॉगिन वेळी स्टोअर केला आहे)
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
            // १. बॅकएंड API ला डेटा पाठवा
            const response = await axios.post('http://localhost:5000/api/update-limit', {
                email: userEmail,
                category: category.trim(),
                limit: parseFloat(newLimit)
            });

            if (response.data.success) {
                // २. जर DB मध्ये सेव्ह झाले, तरच UI (State) अपडेट करा
                const updatedLimits = { ...categoryLimits, [category]: parseFloat(newLimit) };
                setCategoryLimits(updatedLimits);
                
                // बॅकअपसाठी LocalStorage मध्येही ठेवा
                localStorage.setItem('category_limits', JSON.stringify(updatedLimits));
                
                Swal.fire('Saved!', `Limit for ${category} updated Successfully.`, 'success');
            }
        } catch (error) {
            console.error("Error saving limit:", error);
            Swal.fire('Error!', 'Could not save to database.', 'error');
        }
    }
};
// const userName = localStorage.getItem('username') || localStorage.getItem('userName') || localStorage.getItem('user') || 'Student';

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
    Swal.fire('Success', 'Your detailed report has been downloaded!', 'success');
};

const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

// १. टॉप कॅटेगरी शोधणे
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
        confirmButtonColor: '#764ba2', // सुसंगत रंग
        inputValidator: (value) => {
            if (!value || value <= 0) return 'Please Enter a Valid Amount!';
        }
    });

    if (newGoal) {
        const goalValue = parseFloat(newGoal);
        try {
            const response = await axios.post('http://localhost:5000/api/update-goal', {
                email: localStorage.getItem('userEmail'),
                goal: goalValue
            });
            if (response.data.success) {
                setSavingsGoal(goalValue);
                Swal.fire('Success', 'Savings Goal has been set!', 'success');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Could not save the goal to database.', 'error');
        }
    }
};

const updateGoal = (value) => {
    const newGoalValue = value; // इथे डिफाईन केले
    setSavingsGoal(newGoalValue);
    localStorage.setItem('tempGoal', newGoalValue);
};
// --- Calculations Start ---
const safeBudget = parseFloat(budget) || 0;
const safeTotalSpent = parseFloat(totalSpent) || 0;
const safeSavingsGoal = parseFloat(savingsGoal) || 0; // हा व्हेरिएबल इथे तयार केला

const balance = safeBudget - safeTotalSpent;
const progressPercent = safeSavingsGoal > 0 ? (balance / safeSavingsGoal) * 100 : 0;
const remainingToSave = safeSavingsGoal - balance;
// --- Calculations End ---


useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        setLoading(true);
        axios.get(`http://localhost:5000/api/user-data?email=${userEmail}`)
            .then(res => {
                if (res.data.success) {
                    const dbGoal = Number(res.data.savings_goal) || 0;
                    setSavingsGoal(dbGoal);
                    setBudget(Number(res.data.budget));
                    // इथे पुन्हा सेव्ह करा जेणेकरून रिफ्रेशवर डेटा राहील
                    localStorage.setItem('tempGoal', dbGoal);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }
}, []);

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
        <div className="dash-container">
            <nav className="navbar" style={{ background: '#e0ec90' }}>
               <span className="shield-icon">
                   <img src={shieldImage} alt="Security Shield" className="shield-img" />
               </span>
                <div className="user-info" style={{ color:'black'}}>
                    <strong>Hi, {user?.username} (Student)</strong>
                  
<div className="user-avatar-circle" onClick={() => navigate('/edit-profile')}>
    <img 
        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" 
        alt="Profile" 
    />
</div>

      

                    <button onClick={handleLogout} className="logout-btn" style={{ marginLeft: '15px' }}>Logout</button>
                </div>
            </nav>
            <div className="scrolling-headline">
    <div className="headline-content">
        <span>{scrollingMessage}</span>
        <span>{scrollingMessage}</span> {/* सातत्य राखण्यासाठी दोनदा */}
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
        marginBottom: '20px',
         animation: status.type === 'success' ? 'bounce 1s infinite' : 'shake 0.5s'
    }}>
        {status.msg}
    </div>
)}

           <div className="stats-grid">
   <div className="stat-card">
    <h3>Total Budget (Monthly)</h3>
    {/* इथे {budget} स्टेट वापरली आहे याची खात्री करा, {user?.budget} नाही */}
    <p className="amount">₹{budget || 0}</p>
    <button className="edit-btn1" onClick={handleSetBudget}>Edit Budget</button>
</div>
    <div className="stat-card">
        <h3>Spent Expense</h3>
        <p className="amount" style={{ color: '#e74c3c' }}>₹{totalSpent}</p>
    </div>
    <div className="stat-card">
        <h3>Balance Amount</h3>
        <p className="amount" style={{ color: '#27ae60' }}>₹{budget - totalSpent}</p>
    </div>

    
</div>


{/* १. बजेट प्रोग्रेस बार */}
{/* जर खर्च ० पेक्षा जास्त असेल तरच प्रोग्रेस बार दाखवा */}
{expenses.length > 0 && (
    <div className="budget-progress-container" style={{margin: '25px 0', background: '#eee', borderRadius: '10px', height: '20px', width: '100%', overflow: 'hidden'}}>
        <div 
            className="progress-bar" 
            style={{
                width: `${spentPercentage}%`, 
                background: barColor, 
                height: '100%', 
                transition: 'width 0.5s ease-in-out',
                textAlign: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold'
            }}
        >
            {spentPercentage.toFixed(0)}% Used
        </div>
    </div>
)}

{/* २. कॅटेगरी कार्ड्स */}
<div className="category-grid" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '30px' }}>
    {Object.keys(categoryTotals).map((cat) => {
        // प्रत्येक कॅटेगरीची लिमिट मिळवा (नसल्यास ५०० डीफॉल्ट)
        const limit = categoryLimits[cat] || 500;
        const isOverLimit = categoryTotals[cat] > limit;

        return (
            <div key={cat} style={{
                background: isOverLimit ? '#fff5f5' : 'white',
                padding: '15px 20px',
                borderRadius: '15px',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                borderLeft: `5px solid ${isOverLimit ? '#e74c3c' : '#764ba2'}`,
                position: 'relative',
                minWidth: '160px',
                transition: '0.3s'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold', color: '#555', fontSize: '14px' }}>{cat}</span>
                    {/* लिमिट सेट करण्यासाठी सेटिंग आयकॉन */}
                    <button 
                        onClick={() => handleUpdateLimit(cat)} 
                        title="Set Limit"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#888' }}
                    >
                        ⚙️
                    </button>
                </div>

                <div style={{ fontSize: '20px', color: isOverLimit ? '#e74c3c' : '#764ba2', fontWeight: 'bold' }}>
                    ₹{categoryTotals[cat]}
                </div>

                <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                    Limit: <span style={{ fontWeight: 'bold' }}>₹{limit}</span>
                </div>

                {isOverLimit && (
                    <div style={{ fontSize: '10px', color: '#e74c3c', fontWeight: 'bold', marginTop: '3px' }}>
                        ⚠️ Alert: Limit Exceeded!
                    </div>
                )}
            </div>
        );
    })}
</div>

{expenses.length > 0 && (
    <>
            <div className="expense-section" style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                    onClick={openAddExpenseModal}
                    className="login-btn"
                    style={{ width: '250px', background: '#764ba2', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
                >
                    + Add a New Expense
                </button>

                  <button onClick={() => handleSetGoal(true)} className="btn-goal-action">
        🎯 Set Savings Goal
    </button>
                <button 
    onClick={downloadPDF}
    style={{
        padding: '10px 20px',
        backgroundColor: '#27ae60', // हिरवा रंग जो 'Save/Download' दर्शवतो
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        marginLeft: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}
>
    📄 Download PDF Report
</button>
            </div>

{loading || savingsGoal === null ? (
    <div className="news-ticker-container">
        <div className="ticker-text"><span>Loading your goals...</span></div>
    </div>
) : (
   <div className="news-ticker-container">
    <div className="ticker-text">
        {loading ? (
            <span>Updating values... ⏳</span>
        ) : balance < 0 ? (
            <span style={{ color: '#e74c3c' }}>⚠️ Warning! Overspent by ₹{Math.abs(balance).toFixed(2)}</span>
        ) : safeSavingsGoal > 0 && remainingToSave > 0 ? (
            <span style={{ color: '#f39c12' }}>🚀 Progress: {progressPercent.toFixed(1)}% | Need to save: ₹{remainingToSave.toFixed(2)}</span>
        ) : safeSavingsGoal > 0 && balance >= safeSavingsGoal ? (
            <span style={{ color: '#27ae60' }}>🎉 Goal of ₹{safeSavingsGoal} Achieved!</span>
        ) : (
            <span>Welcome! Please set a savings goal to track progress.</span>
        )}
    </div>
</div>
)}

<div style={{ margin: '20px 0', textAlign: 'center' }}>
    <input
        type="text"
        placeholder="🔍 Search Names,Dates..."
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

            <h3 style={{ marginTop: '30px',textAlign: 'center',
   textDecoration: 'underline' }}>Expense details</h3>
            <div className="table-responsive">
                <table className="expense-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ background: '#f4f4f4', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Name</th>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Expense</th>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Date</th>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.length > 0 ? (
                            filteredExpenses.map((exp) => (
                                <tr key={exp.id}>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{exp.title}</td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>₹{exp.amount}</td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{new Date(exp.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
                                        <button onClick={() => editExpense(exp)} className="edit-btn" style={{ marginRight: '5px', cursor: 'pointer' }}>Edit</button>
                                        <button onClick={() => handleDelete(exp.id)} className="delete-btn" style={{ cursor: 'pointer', color: 'red' }}>Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>No Expense found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            </>
)}
{expenses.length === 0 && (
    <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <p>No expenses found. Start tracking by adding your first expense!</p>
        <button
            onClick={openAddExpenseModal}
            className="login-btn"
            style={{ width: '250px', background: '#764ba2', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
        >
            + Add Your First Expense
        </button>
    </div>
)}
{budget > 0 && expenses.length > 0 && (
    <>
            {/* --- पाय-चार्ट सेक्शन --- */}
<div style={{ width: '100%', height: 300, marginTop: '20px', background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
    <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Spending Analysis</h3>
    <ResponsiveContainer width="100%" height="100%">
        <PieChart>
            <Pie
                data={Object.keys(categoryTotals).map(cat => ({ name: cat, value: categoryTotals[cat] }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
            >
   {Object.keys(categoryTotals).map((entry, index) => {
    // index नुसार 'Hue' बदलल्यामुळे वेगवेगळे रंग मिळतात
    const hue = (index * 137.5) % 360; // 137.5 हा 'golden angle' आहे जो रंगांमध्ये चांगला फरक ठेवतो
    const color = `hsl(${hue}, 70%, 60%)`; 

    return (
        <Cell key={`cell-${index}`} fill={color} />
    );
})}
            </Pie>
            <Tooltip />
            <Legend />
        </PieChart>
    </ResponsiveContainer>
</div>

<div style={{ width: '100%', height: 300, marginTop: '30px', background: '#fff', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
    <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>Spending Trend (Daily)</h3>
    <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#764ba2" 
                strokeWidth={3} 
                dot={{ r: 6 }} 
                activeDot={{ r: 8 }} 
            />
        </LineChart>
    </ResponsiveContainer>
</div>
 </>
)}


        </div>
    );
};

export default StudentDashboard;


