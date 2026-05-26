const express = require('express');
const cors = require('cors');
const db = require('./config/db'); // खात्री करा की यात .promise() वापरले आहे
const bcrypt = require('bcrypt');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 

// --- १. लॉगिन (Login) ---
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // १. फक्त ईमेलवरून युजर शोधा (पासवर्ड इथे चेक करू नका)
        const sql = "SELECT * FROM users WHERE email = ?";
        const [result] = await db.execute(sql, [email.trim()]);

        if (result.length > 0) {
            const user = result[0];

            // २. Bcrypt वापरून पासवर्डची तुलना करा
            // (युजरने टाकलेला 'password' आणि DB मधील 'user.password' हॅश यांची तुलना)
            const isMatch = await bcrypt.compare(password.trim(), user.password);

            if (!isMatch) {
                console.log("❌ Wrong Password for user:", email);
                return res.json({ success: false, message: "Invalid credentials" });
            }

            // ३. अकाऊंट ॲक्टिव्ह आहे का ते तपासा
            if (user.is_active === 1) {
                console.log(`⚠️ Deactivated user tried to login: ${email}`);
                return res.json({ 
                    success: false, 
                    message: "Your account has been deactivated. Please contact the admin." 
                });
            }

            console.log("✅ User Logged In Successfully!");
            // सुरक्षेसाठी युजर ऑब्जेक्टमधून पासवर्ड काढून मग रिस्पॉन्स पाठवा
            delete user.password; 
            return res.json({ success: true, user: user });

        } else {
            console.log("❌ No User found with this email.");
            return res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error("❌ Login Error:", err);
        return res.status(500).json({ success: false, message: "Database Error" });
    }
});

// --- २. रजिस्ट्रेशन (Register) ---
app.post('/api/register', async (req, res) => {
    const { username, password, role, email, profession } = req.body;
    
    let finalEmail = email || (username.includes('@') ? username : `${username.toLowerCase().replace(/\s+/g, '')}@gmail.com`);

    console.log("------- Registration Check -------");
    console.log("Username:", username);
    console.log("Profession Received:", profession); 
    console.log("----------------------------------");

    try {
        // १. पासवर्ड हॅश करा (Password Hashing)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const sql = "INSERT INTO users (username, email, password, profession, role, budget) VALUES (?, ?, ?, ?, ?, 0)";
        
        // २. 'password' ऐवजी 'hashedPassword' डेटाबेसमध्ये पाठवा
        await db.execute(sql, [username, finalEmail, hashedPassword, profession || 'Student', role || 'User']);
        
        console.log(`✅ Registered: ${username} with Hashed Password`);
        res.json({ success: true });

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "Email already registered" });
        }
        console.error("❌ Register Error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// --- ३. बजेट अपडेट (Update Budget) ---
app.put('/api/update-budget/:id', async (req, res) => {
    const userId = req.params.id;
    const { budget } = req.body;

    try {
        const sql = "UPDATE users SET budget = ? WHERE id = ?";
        await db.execute(sql, [budget, userId]);
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Budget Update Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// --- Admin Stats API (Async/Await पद्धत) ---
app.get('/api/admin/all-users', async (req, res) => {
    try {
        // SQL सुधारणा: युजर्स आणि त्यांच्या खर्चाची बेरीज एकत्र मिळवणे
        const sqlUsers = `
            SELECT 
                u.id, u.username, u.email, u.role, u.budget, u.is_active, u.profession,
                IFNULL(SUM(e.amount), 0) AS total_spent
            FROM users u
            LEFT JOIN expenses e ON u.id = e.user_id
            WHERE u.role != 'Admin'
            GROUP BY u.id
        `;
        
        // तुमच्या SQL फाईलनुसार: is_active 0 = Active, 1 = Inactive
        const sqlActiveCount = "SELECT COUNT(*) as count FROM users WHERE is_active = 0 AND role != 'Admin'";
        const sqlInactiveCount = "SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND role != 'Admin'";
        const sqlTotalExpense = "SELECT SUM(amount) as total FROM expenses";

        const [users] = await db.execute(sqlUsers);
        const [activeRes] = await db.execute(sqlActiveCount);
        const [inactiveRes] = await db.execute(sqlInactiveCount);
        const [expenseResult] = await db.execute(sqlTotalExpense);

        res.json({ 
            success: true, 
            users: users, 
            stats: {
                active: activeRes[0].count || 0,
                inactive: inactiveRes[0].count || 0
            },
            totalSystemExpense: expenseResult[0].total || 0 
        });
    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});
app.get('/api/admin/user-expenses/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // तुमच्या टेबलमध्ये 'user_id' हेच नाव असल्याची खात्री करा
        const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
        const [expenses] = await db.execute(sql, [userId]);
        
        res.json({ 
            success: true, 
            expenses: expenses 
        });
    } catch (err) {
        console.error("❌ User Expenses Fetch Error:", err);
        res.status(500).json({ success: false, message: "An error occurred while fetching this user's expenses." });
    }
});
// युजरला Active/Deactive करण्यासाठी API
app.put('/api/admin/toggle-user/:id', async (req, res) => {
    const userId = req.params.id;
    // currentStatus ला Number मध्ये कन्व्हर्ट करा
    const currentStatus = Number(req.body.currentStatus); 
    
    // आता हे नीट चेक करेल
    const newStatus = currentStatus === 1 ? 0 : 1;

    try {
        const sql = "UPDATE users SET is_active = ? WHERE id = ?";
        const [result] = await db.execute(sql, [newStatus, userId]);

        console.log(`✅ User ${userId} status changed from ${currentStatus} to ${newStatus}`);
        
        res.json({ success: true, newStatus: newStatus });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- युजर डिलीट करण्यासाठी API (Async/Await पद्धत) ---
app.delete('/api/admin/delete-user/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const sql = "DELETE FROM users WHERE id = ?";
        await db.execute(sql, [id]);
        
        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
        console.error("❌ Delete Error:", err);
        res.status(500).json({ success: false, message: "Error deleting user" });
    }
});

// युजरची माहिती अपडेट करण्यासाठी API
app.post('/api/admin/update-user/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, role, budget } = req.body;

        // SQL UPDATE Query
        const sql = "UPDATE users SET username = ?, role = ?, budget = ? WHERE id = ?";
        await db.execute(sql, [username, role, budget, userId]);

        res.json({ success: true, message: "User updated successfully!" });
    } catch (err) {
        console.error("❌ Update Error:", err);
        res.status(500).json({ success: false, message: "Database update failed" });
    }
});

// server.js मध्ये हा कोड पेस्ट करा
app.delete('/api/admin/delete-expense/:id', async (req, res) => {
    try {
        const expenseId = req.params.id;
        
        // १. आधी क्वेरी चेक करा
        const sql = "DELETE FROM expenses WHERE id = ?";
        const [result] = await db.execute(sql, [expenseId]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Expense deleted successfully!" });
        } else {
            res.status(404).json({ success: false, message: "Expense not found." });
        }
    } catch (err) {
        console.error("❌ Delete API Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.get('/api/admin/global-search', async (req, res) => {
    const keyword = req.query.q;
    const [rows] = await db.execute(
        "SELECT users.username, expenses.* FROM expenses JOIN users ON expenses.user_id = users.id WHERE expenses.title LIKE ?", 
        [`%${keyword}%`]
    );
    res.json({ success: true, data: rows });
});

app.get('/api/admin/analytics/category-expenses', async (req, res) => {
    try {
        // प्रत्येक कॅटेगरीचा एकूण खर्च काढण्यासाठी SQL Query
        const sql = "SELECT category, SUM(amount) as total FROM expenses GROUP BY category";
        const [rows] = await db.execute(sql);
        
        // चार्टला हवा तसा डेटा फॉरमॅट करा
        const labels = rows.map(item => item.category);
        const data = rows.map(item => item.total);
        
        res.json({ success: true, labels, data });
    } catch (err) {
        res.status(500).json({ success: false, message: "Analytics डेटा मिळवताना एरर आला." });
    }
});

app.get('/api/admin/master-report', async (req, res) => {
    try {
        const sql = "SELECT users.username, expenses.* FROM expenses JOIN users ON expenses.user_id = users.id ORDER BY expenses.date DESC";
        const [rows] = await db.execute(sql);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching master report" });
    }
});

// बदललेला कोड:
app.get('/api/admin/analytics/user-savings', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.username, 
                u.budget, 
                IFNULL(SUM(e.amount), 0) as total_expense
            FROM users u
            LEFT JOIN expenses e ON u.id = e.user_id
            WHERE u.role = 'User'
            GROUP BY u.id
        `;
        
        // तुमच्या db कनेक्शननुसार (db.query किंवा connection.query)
        const [data] = await db.query(query); 

        res.json({
            success: true,
            data: data
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.post('/api/admin/categories', async (req, res) => {
    try {
        const { profession, category_name } = req.body;
        
        // १. व्हॅल्यूज रिकाम्या तर नाहीत ना?
        if (!profession || !category_name) {
            return res.status(400).json({ success: false, message: "सर्व फील्ड्स भरा" });
        }

        // २. डेटाबेसमध्ये इन्सर्ट करा (तुमच्या टेबलचे नाव 'categories' असावे)
        const query = "INSERT INTO categories (profession, category_name) VALUES (?, ?)";
        await db.query(query, [profession, category_name]);

        res.json({ success: true, message: "Category added successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});
app.get('/api/admin/categories', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM categories");
        res.json(rows); // हे थेट Array पाठवते
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// १. कॅटेगरी डिलीट करण्यासाठी API
app.delete('/api/admin/delete-category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "DELETE FROM categories WHERE id = ?";
        const [result] = await db.execute(sql, [id]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Category Deleted Successfully" });
        } else {
            res.status(404).json({ success: false, message: "Category not found" });
        }
    } catch (err) {
        console.error("Delete Category Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

// २. कॅटेगरी अपडेट (Edit) करण्यासाठी API
app.put('/api/admin/update-category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name } = req.body;
        
        const sql = "UPDATE categories SET category_name = ? WHERE id = ?";
        const [result] = await db.execute(sql, [category_name, id]);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Category Updated Successfully" });
        } else {
            res.status(404).json({ success: false, message: "Category not found" });
        }
    } catch (err) {
        console.error("Update Category Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.get('/api/user/categories/:profession', async (req, res) => {
    try {
        const { profession } = req.params;
        const sql = "SELECT category_name FROM categories WHERE profession = ?";
        const [rows] = await db.execute(sql, [profession]);
        res.json({ success: true, categories: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/update-limit', async (req, res) => {
    try {
        const { email, category, limit } = req.body;
        
        // db.query ऐवजी db.execute वापरा (कारण तुम्ही Promise-based DB वापरत आहात)
        const sql = "INSERT INTO category_limits (user_email, category_name, limit_amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE limit_amount = ?";
        
        await db.execute(sql, [email, category, limit, limit]);
        
        console.log(`✅ Limit updated successfully for ${email}`);
        
        // हे उत्तर पाठवणे सर्वात महत्त्वाचे आहे!
        return res.status(200).json({ success: true, message: "Limit Updated Successfully" });
    } catch (err) {
        console.error("❌ Update Limit Error:", err);
        return res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.get('/api/get-limits', async (req, res) => {
    try {
        const email = req.query.email;
        const sqlQuery = "SELECT category_name, limit_amount FROM category_limits WHERE user_email = ?";
        
        const [results] = await db.execute(sqlQuery, [email]);
        return res.status(200).json(results);
    } catch (err) {
        console.error("❌ Fetch Limits Error:", err);
        return res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/update-goal', async (req, res) => {
    try {
        const { email, goal } = req.body;
        const sql = "UPDATE users SET savings_goal = ? WHERE email = ?";
        await db.execute(sql, [goal, email]);
        res.status(200).json({ success: true, message: "Goal Updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});


// --- ३. युजरचा संपूर्ण डेटा (Budget + Goal) मिळवण्यासाठी API ---
app.get('/api/user-data', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const sql = "SELECT budget, savings_goal FROM users WHERE email = ?";
        const [result] = await db.execute(sql, [email]);

        if (result.length > 0) {
            res.json({ 
                success: true, 
                budget: result[0].budget, 
                savings_goal: result[0].savings_goal 
            });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (err) {
        console.error("❌ Fetch User Data Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.get('/api/expenses', async (req, res) => {
    const { userId, month, year } = req.query;

    let query = "SELECT * FROM expenses WHERE userId = ?";
    let params = [userId];

    // जर महिना आणि वर्ष पाठवले असेल तर फिल्टर जोडा
    if (month && year) {
        query += " AND MONTH(date) = ? AND YEAR(date) = ?";
        params.push(month, year);
    }

    query += " ORDER BY date DESC";

    try {
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/get-expenses/:userId', async (req, res) => {
    const { userId } = req.params;
    const { month, year } = req.query; // Query Parameters मिळवा

    let sql = "SELECT * FROM expenses WHERE user_id = ?";
    let params = [userId];

    // जर महिना आणि वर्ष पाठवले असेल तर SQL मध्ये फिल्टर जोडा
    if (month && year) {
        sql += " AND MONTH(date) = ? AND YEAR(date) = ?";
        params.push(month, year);
    }

    sql += " ORDER BY date DESC";

    try {
        const [rows] = await db.execute(sql, params);
        res.json({ success: true, expenses: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

//profile update
app.put('/api/update-profile', async (req, res) => {
    try {
        const { id, newName, newProfession, newEmail } = req.body;
        
       

        const sql = "UPDATE users SET username = ?, email = ?, profession = ? WHERE id = ?";
        
        
        const [result] = await db.execute(sql, [newName, newEmail, newProfession, id]);

        console.log("✅ Database Update Success:", result);

        if (result.affectedRows > 0) {
            res.json({ success: true, message: "Profile Updated Successfully!" });
        } else {
            res.json({ success: false, message: "User not found or no changes made." });
        }

    } catch (error) {
        console.error("❌ SQL Error Details:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
});


const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sushmitapawar7276@gmail.com',
        pass: 'qgfoezixbaimpgmr' 
    }
});


app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const [users] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Email is not registered!" });
        }

        // ६ अंकी OTP तयार करा
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expireTime = Date.now() + 600000; // १० मिनिटे

        // हा OTP डेटाबेसमध्ये reset_token कॉलममध्येच सेव्ह करा
        await db.execute(
            "UPDATE users SET reset_token = ?, token_expiry = ? WHERE email = ?", 
            [otp, expireTime, email]
        );

       
const mailOptions = {
    from: '"Smart Expense Tracker" <sushmitapawar7276@gmail.com>',
    to: email,
    subject: 'Your Password Reset OTP',
    html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: #333;">Password Reset OTP</h2>
            <p>Use the following 6-digit code to change your password:</p>
            <h1 style="color: #3498db; font-size: 40px; letter-spacing: 10px; margin: 20px 0;">${otp}</h1>
            <p style="color: #666;">This code is valid for 10 minutes. Do not share it with anyone.
</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #aaa;">Smart Expense Tracker Team</p>
        </div>
    `
};

        transporter.sendMail(mailOptions, (err) => {
            if (err) return res.status(500).json({ success: false, message: "Email Error!" });
            res.json({ success: true, message: "The OTP has been sent to your email!" });
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error!" });
    }
});

// नवीन पासवर्ड अपडेट करण्यासाठी API

app.post('/api/reset-password', async (req, res) => {
    const { otp, password } = req.body; 

    try {
      
        const [users] = await db.execute(
            "SELECT * FROM users WHERE reset_token = ? AND token_expiry > ?", 
            [otp, Date.now()]
        );

        if (users.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "The OTP is incorrect or has expired!" 
            });
        }

        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

       
        await db.execute(
            "UPDATE users SET password = ?, reset_token = NULL, token_expiry = NULL WHERE id = ?", 
            [hashedPassword, users[0].id]
        );

        res.json({ success: true, message: "Password Changed Successfully!" });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ success: false, message: "Server Error!" });
    }
});


// १. हेल्प डेटा मिळवण्यासाठी (GET)
app.get('/api/get-help/:role', (req, res) => {
    const { role } = req.params;
    const sql = "SELECT help_content FROM dynamic_help WHERE user_role = ?";
    db.query(sql, [role], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/update-help', (req, res) => {
    console.log("Request received for role:", req.body.role); // हे तुम्हाला दिसत आहे

    const { role, content } = req.body;
    const sql = "INSERT INTO dynamic_help (user_role, help_content) VALUES (?, ?) ON DUPLICATE KEY UPDATE help_content = ?";
    
    db.query(sql, [role, content, content], (err, result) => {
        if (err) {
            console.log("Database Error:", err);
            return res.status(500).json({ success: false, error: err });
        }
        
        // ही ओळ बॅकएंडने फ्रंटएंडला सिग्नल देण्यासाठी आहे
        console.log("Update successful in Database!"); 
        return res.status(200).json({ success: true, message: "Success" });
    });
});
// इतर सर्व रूट्स (Expenses इ.)
app.use('/api', userRoutes);

// सर्व्हर सुरू झाल्यावर डेटाबेस चेक करण्यासाठी (Async पद्धतीने)
const testDB = async () => {
    try {
        await db.execute("SELECT 1");
        console.log("✅ DB Test Success! Connection is active.");
    } catch (err) {
        console.log("❌ DB Test Failed:", err.message);
    }
};
testDB();
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database Connection Error:", err.message);
    } else {
        console.log("✅ DB Pool Connected! Database is ready to use.");
        connection.release(); // कनेक्शन फ्री करणे महत्त्वाचे आहे
    }
});
// पोर्ट सेट करणे
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});