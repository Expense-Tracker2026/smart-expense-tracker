const db = require('../config/db');

// १. User Registration Logic
exports.registerUser = async (req, res) => {
    const { username, email, password, profession } = req.body;
    try {
        const [existingUser] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: "This Email is Already Registered!" });
        }

        const sql = 'INSERT INTO users (username, email, password, profession, budget) VALUES (?, ?, ?, ?, 0)';
        await db.execute(sql, [username, email, password, profession]);

        res.status(201).json({ success: true, message: "Registration Successful!" });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
};

// २. User Login Logic
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute(
            'SELECT id, username, profession, role, email, IFNULL(budget, 0) as budget FROM users WHERE email = ? AND password = ?', 
            [email, password]
        );

        if (rows.length > 0) {
            res.status(200).json({ 
                success: true, 
                message: "Login Successful", 
                user: rows[0] 
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid email or password!" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// ३. खर्च ॲड करण्याचे लॉजिक (दोन्ही डॅशबोर्डसाठी)
exports.addExpense = async (req, res) => {
    const { user_id, title, amount, category } = req.body;
    try {
        const userIdInt = parseInt(user_id);
        const amountFloat = parseFloat(amount);
        const today = new Date().toISOString().split('T')[0]; 

        const sql = 'INSERT INTO expenses (user_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?)';
        await db.execute(sql, [userIdInt, title, amountFloat, category, today]);

        res.status(201).json({ success: true, message: "Expense added successfully!" });
    } catch (error) {
        console.error("Add Expense Error:", error.message);
        res.status(500).json({ success: false, message: "Database error: " + error.message });
    }
};

// ४. सर्व खर्च मिळवण्यासाठी (दोन्ही डॅशबोर्डसाठी)
exports.getExpenses = async (req, res) => {
    const { userId } = req.params;
    try {
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        const sql = 'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC';
        const [rows] = await db.execute(sql, [userId]);
        
        res.status(200).json({ success: true, expenses: rows });
    } catch (error) {
        console.error("Fetch Error:", error.message);
        res.status(500).json({ success: false, message: "Server error: " + error.message });
    }
};

// ५. खर्च डिलीट करण्यासाठी (दोन्ही डॅशबोर्डसाठी)
exports.deleteExpense = async (req, res) => {
    const { id } = req.params;
    console.log("Deleting Expense ID:", id); // चेक करण्यासाठी
    try {
        const [result] = await db.execute('DELETE FROM expenses WHERE id = ?', [id]);
        
        if (result.affectedRows > 0) {
            res.status(200).json({ success: true, message: "Expense deleted successfully!" });
        } else {
            res.status(404).json({ success: false, message: "Expense not found" });
        }
    } catch (error) {
        console.error("Delete Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ६. खर्च अपडेट (Edit) करण्यासाठी (दोन्ही डॅशबोर्डसाठी)
exports.updateExpense = async (req, res) => {
    const { id } = req.params;
    const { title, amount, category } = req.body;
    
    // हे तुमच्या नोड टर्मिनलमध्ये दिसतेय का पहा
    console.log("BACKEND RECEIVED ID:", id);
    console.log("BACKEND RECEIVED BODY:", req.body);

    try {
        const sql = 'UPDATE expenses SET title = ?, amount = ?, category = ? WHERE id = ?';
        const [result] = await db.execute(sql, [title, amount, category, id]);

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: "Updated!" });
        } else {
            // जर ID चुकला असेल तर हे दिसेल
            return res.status(404).json({ success: false, message: "ID not found in DB" });
        }
    } catch (error) {
        console.error("DB ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};