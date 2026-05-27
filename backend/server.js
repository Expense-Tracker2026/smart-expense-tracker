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
        // १. SQL क्वेरी (PostgreSQL साठी $1)
        const sql = "SELECT * FROM users WHERE email = $1";
        
       
        // 'pg' लायब्ररीमध्ये रिझल्ट 'rows' मध्ये मिळतात
        const { rows } = await db.query(sql, [email.trim()]);

        if (rows.length > 0) {
            const user = rows[0];

            // ३. पासवर्ड तुलना (हे जसेच्या तसे राहील)
            const isMatch = await bcrypt.compare(password.trim(), user.password);

            if (!isMatch) {
                console.log("❌ Wrong Password for user:", email);
                return res.json({ success: false, message: "Invalid credentials" });
            }

            // ४. अकाऊंट ॲक्टिव्ह आहे का ते तपासा (तुमच्या DB नुसार)
            if (user.is_active === 1) {
                console.log(`⚠️ Deactivated user tried to login: ${email}`);
                return res.json({ 
                    success: false, 
                    message: "Your account has been deactivated. Please contact the admin." 
                });
            }

            console.log("✅ User Logged In Successfully!");
            
            // ५. पासवर्ड काढून युजर डेटा पाठवा
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

    try {
        // १. पासवर्ड हॅश करा
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // २. 'db.query' वापरा (PostgreSQL साठी)
        const sql = "INSERT INTO users (username, email, password, profession, role, budget) VALUES ($1, $2, $3, $4, $5, 0)";
        
        await db.query(sql, [username, finalEmail, hashedPassword, profession || 'Student', role || 'User']);
        
        console.log(`✅ Registered: ${username} with Hashed Password`);
        res.json({ success: true });

    } catch (err) {
        // ३. PostgreSQL चा Unique Violation एरर कोड '23505' आहे
        if (err.code === '23505') {
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
        // SQL क्वेरी बरोबर आहे ($1, $2 वापरा)
        const sql = "UPDATE users SET budget = $1 WHERE id = $2";
        
        
        await db.query(sql, [budget, userId]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("❌ Budget Update Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// --- Admin Stats API (Async/Await पद्धत) ---
app.get('/api/admin/all-users', async (req, res) => {
    try {
        // १. IFNULL ऐवजी COALESCE वापरा
        const sqlUsers = `
            SELECT 
                u.id, u.username, u.email, u.role, u.budget, u.is_active, u.profession,
                COALESCE(SUM(e.amount), 0) AS total_spent
            FROM users u
            LEFT JOIN expenses e ON u.id = e.user_id
            WHERE u.role != 'Admin'
            GROUP BY u.id, u.username, u.email, u.role, u.budget, u.is_active, u.profession
        `;
        
        const sqlActiveCount = "SELECT COUNT(*) as count FROM users WHERE is_active = 0 AND role != 'Admin'";
        const sqlInactiveCount = "SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND role != 'Admin'";
        const sqlTotalExpense = "SELECT SUM(amount) as total FROM expenses";

    
        const { rows: users } = await db.query(sqlUsers);
        const { rows: activeRes } = await db.query(sqlActiveCount);
        const { rows: inactiveRes } = await db.query(sqlInactiveCount);
        const { rows: expenseResult } = await db.query(sqlTotalExpense);

        res.json({ 
            success: true, 
            users: users, 
            stats: {
                active: parseInt(activeRes[0].count) || 0,
                inactive: parseInt(inactiveRes[0].count) || 0
            },
            totalSystemExpense: parseFloat(expenseResult[0].total) || 0 
        });
    } catch (err) {
        console.error("❌ Admin Users Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});
app.get('/api/admin/user-expenses/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // SQL क्वेरी बरोबर आहे
        const sql = "SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC";
        
        
        // २. 'const [expenses]' ऐवजी '{ rows: expenses }' वापरा
        const { rows: expenses } = await db.query(sql, [userId]);
        
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
    const currentStatus = Number(req.body.currentStatus); 
    const newStatus = currentStatus === 1 ? 0 : 1;

    try {
        // SQL क्वेरी बरोबर आहे ($1, $2)
        const sql = "UPDATE users SET is_active = $1 WHERE id = $2";
        
        
        // २. PostgreSQL मध्ये 'result' मधून आपण 'rowCount' वापरू शकतो (हे रो अपडेट झाले की नाही हे सांगते)
        const result = await db.query(sql, [newStatus, userId]);

        console.log(`✅ User ${userId} status changed from ${currentStatus} to ${newStatus}`);
        
        res.json({ 
            success: true, 
            newStatus: newStatus,
            updatedCount: result.rowCount // हे सांगते किती रो अपडेट झाल्या
        });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});
// --- युजर डिलीट करण्यासाठी API (Async/Await पद्धत) ---
app.delete('/api/admin/delete-user/:id', async (req, res) => {
    try {
        const id = req.params.id;
        
        // SQL क्वेरी बरोबर आहे ($1 वापरा)
        const sql = "DELETE FROM users WHERE id = $1";
        
       
        const result = await db.query(sql, [id]);
        
        // २. (पर्यायी) युजर डिलीट झाला की नाही हे चेक करा
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        
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

        // १. SQL UPDATE Query (ही बरोबर आहे)
        const sql = "UPDATE users SET username = $1, role = $2, budget = $3 WHERE id = $4";
        
       
        const result = await db.query(sql, [username, role, budget, userId]);

        // ३. (पर्यायी) युजर अपडेट झाला की नाही हे तपासा
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

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
        
        // १. क्वेरी बरोबर आहे ($1 वापरा)
        const sql = "DELETE FROM expenses WHERE id = $1";
        
       
        const result = await db.query(sql, [expenseId]);

        // ३. 'affectedRows' ऐवजी 'rowCount' वापरा (PostgreSQL साठी)
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Expense deleted successfully!" });
        } else {
            res.status(404).json({ success: false, message: "Expense not found." });
        }
    } catch (err) {
        console.error("❌ Delete API Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});


app.post('/api/add-expense', async (req, res) => {
    try {
        const { user_id, title, amount, category, date } = req.body;

        // १. SQL क्वेरी (कॉलमची नावे तुमच्या डेटाबेस टेबलशी मॅच करा)
        const sql = "INSERT INTO expenses (user_id, title, amount, category, date) VALUES ($1, $2, $3, $4, $5)";
        
        // २. डेटाबेस क्वेरी एक्झिक्युट करा
        await db.query(sql, [user_id, title, amount, category, date]);

        // ३. सक्सेस रिस्पॉन्स
        res.json({ success: true, message: "Expense added successfully!" });

    } catch (err) {
        console.error("❌ Add Expense Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.put('/api/edit-expense/:id', async (req, res) => {
    try {
        const expenseId = req.params.id; // URL मधून आयडी घेणे
        const { title, amount, category, date } = req.body; // अपडेट करायची माहिती

        // १. SQL क्वेरी (UPDATE कमांड)
        // तुमच्या डेटाबेस कॉलमची नावे (title, amount इ.) तपासा
        const sql = `UPDATE expenses 
                     SET title = $1, amount = $2, category = $3, date = $4 
                     WHERE id = $5`;
        
        // २. डेटाबेस क्वेरी एक्झिक्युट करा
        const result = await db.query(sql, [title, amount, category, date, expenseId]);

        // ३. जर आयडी सापडला असेल तर रिस्पॉन्स द्या
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Expense updated successfully!" });
        } else {
            res.status(404).json({ success: false, message: "Expense not found." });
        }

    } catch (err) {
        console.error("❌ Edit Expense Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});
app.get('/api/admin/global-search', async (req, res) => {
    const keyword = req.query.q;
    
    // १. PostgreSQL साठी $1 वापरा
    // २. SQL क्वेरीमधील `?` ला `$1` मध्ये बदला
    const sql = `
        SELECT users.username, expenses.* FROM expenses 
        JOIN users ON expenses.user_id = users.id 
        WHERE expenses.title LIKE $1
    `;
    
    try {
      
        const { rows } = await db.query(sql, [`%${keyword}%`]);
        
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("❌ Global Search Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.get('/api/admin/analytics/category-expenses', async (req, res) => {
    try {
        const sql = "SELECT category, SUM(amount) as total FROM expenses GROUP BY category";
        
       
        const { rows } = await db.query(sql);
        
        const labels = rows.map(item => item.category);
        const data = rows.map(item => item.total);
        
        res.json({ success: true, labels, data });
    } catch (err) {
        console.error("❌ Analytics Error:", err);
        res.status(500).json({ success: false, message: "Analytics डेटा मिळवताना एरर आला." });
    }
});

app.get('/api/admin/master-report', async (req, res) => {
    try {
        const sql = "SELECT users.username, expenses.* FROM expenses JOIN users ON expenses.user_id = users.id ORDER BY expenses.date DESC";
        
      
        const { rows } = await db.query(sql);
        
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("❌ Master Report Error:", err);
        res.status(500).json({ success: false, message: "Error fetching master report" });
    }
});

// बदललेला कोड:
app.get('/api/admin/analytics/user-savings', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.username, u.budget, 
                COALESCE(SUM(e.amount), 0) as total_expense
            FROM users u
            LEFT JOIN expenses e ON u.id = e.user_id
            WHERE u.role = 'User'
            GROUP BY u.id, u.username, u.budget
        `;
        
        // 'const [data]' ऐवजी '{ rows: data }' वापरा
        const { rows: data } = await db.query(query); 

        res.json({
            success: true,
            data: data
        });
    } catch (err) {
        console.error("❌ Analytics Savings Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.post('/api/admin/categories', async (req, res) => {
    try {
        const { profession, category_name } = req.body;
        // तुमचा कोड ID पाठवत नाहीये, हेच हवे आहे! 
        const query = "INSERT INTO categories (profession, category_name) VALUES ($1, $2)";
        await db.query(query, [profession, category_name]);
        res.json({ success: true, message: "Category added successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.get('/api/admin/categories', async (req, res) => {
    try {
        // [rows] ऐवजी रिस्पॉन्स मधून { rows } काढा
        const { rows } = await db.query("SELECT * FROM categories");
        res.json(rows); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


app.delete('/api/admin/delete-category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "DELETE FROM categories WHERE id = $1";
        
       
        const result = await db.query(sql, [id]);

        // २. affectedRows ऐवजी rowCount वापरा
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Category Deleted Successfully" });
        } else {
            res.status(404).json({ success: false, message: "Category not found" });
        }
    } catch (err) {
        console.error("Delete Category Error:", err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});


app.put('/api/admin/update-category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name } = req.body;
        
        const sql = "UPDATE categories SET category_name = $1 WHERE id = $2";
        const result = await db.query(sql, [category_name, id]);

        if (result.rowCount > 0) {
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
        const sql = "SELECT category_name FROM categories WHERE profession = $1";
        
        // [rows] ऐवजी रिस्पॉन्स मधून { rows } काढा
        const { rows } = await db.query(sql, [profession]);
        
        res.json({ success: true, categories: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// १. update-limit (ON CONFLICT वापरून)
app.post('/api/update-limit', async (req, res) => {
    try {
        const { email, category, limit } = req.body;
        
        // PostgreSQL मध्ये ON DUPLICATE KEY ऐवजी ON CONFLICT वापरतात
        const sql = `
            INSERT INTO category_limits (user_email, category_name, limit_amount) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (user_email, category_name) 
            DO UPDATE SET limit_amount = $3
        `;
        
        await db.query(sql, [email, category, limit]);
        
        console.log(`✅ Limit updated successfully for ${email}`);
        return res.status(200).json({ success: true, message: "Limit Updated Successfully" });
    } catch (err) {
        console.error("❌ Update Limit Error:", err);
        return res.status(500).json({ success: false, message: "Database Error" });
    }
});
app.get('/api/get-limits', async (req, res) => {
    try {
        const email = req.query.email;
        const sqlQuery = "SELECT category_name, limit_amount FROM category_limits WHERE user_email = $1";
        
        // 'const [results] = await...' ऐवजी '{ rows }' वापरा
        const { rows } = await db.query(sqlQuery, [email]);
        return res.status(200).json(rows);
    } catch (err) {
        console.error("❌ Fetch Limits Error:", err);
        return res.status(500).json({ error: "Database error" });
    }
});

// ३. update-goal
app.post('/api/update-goal', async (req, res) => {
    try {
        const { email, goal } = req.body;
        const sql = "UPDATE users SET savings_goal = $1 WHERE email = $2";
        
        await db.query(sql, [goal, email]);
        res.status(200).json({ success: true, message: "Goal Updated" });
    } catch (err) {
        console.error("❌ Goal Update Error:", err);
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

        const sql = "SELECT budget, savings_goal FROM users WHERE email = $1";
        // 'const [result]' ऐवजी '{ rows }' वापरा
        const { rows } = await db.query(sql, [email]);

        if (rows.length > 0) {
            res.json({ 
                success: true, 
                budget: rows[0].budget, 
                savings_goal: rows[0].savings_goal 
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

    // १. 'userId' चे 'user_id' करा
    let sql = "SELECT * FROM expenses WHERE user_id = $1";
    let params = [userId];

    if (month && year) {
        // २. EXTRACT वापरा आणि इंडेक्स $2, $3 करा
        sql += " AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3";
        params.push(month, year);
    }

    sql += " ORDER BY date DESC";

    try {
       
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("❌ Expenses Error:", err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/get-expenses/:userId', async (req, res) => {
    const { userId } = req.params;
    const { month, year } = req.query;

    // १. व्हेरिएबलचे नाव 'sql' वापरा
    let sql = "SELECT * FROM expenses WHERE user_id = $1";
    let params = [userId];

    if (month && year) {
        // २. इंडेक्स $2 आणि $3 वापरा, कारण $1 आधीच वापरला आहे
        sql += " AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3";
        params.push(month, year);
    }

    sql += " ORDER BY date DESC";

    try {
       
        const { rows } = await db.query(sql, params); 
        res.json({ success: true, expenses: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

app.put('/api/update-profile', async (req, res) => {
    try {
        const { id, newName, newProfession, newEmail } = req.body;
        
        const sql = "UPDATE users SET username = $1, email = $2, profession = $3 WHERE id = $4";
        
      
        const result = await db.query(sql, [newName, newEmail, newProfession, id]);

        // affectedRows ऐवजी rowCount
        if (result.rowCount > 0) {
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
        // [users] ऐवजी { rows } वापरा
        const { rows } = await db.query("SELECT id FROM users WHERE email = $1", [email]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Email is not registered!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expireTime = new Date(Date.now() + 600000); // Postgres साठी Date ऑब्जेक्ट

        await db.query(
            "UPDATE users SET reset_token = $1, token_expiry = $2 WHERE email = $3", 
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
        // [users] ऐवजी { rows } वापरा
        const { rows } = await db.query(
            "SELECT id FROM users WHERE reset_token = $1 AND token_expiry > NOW()", 
            [otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            "UPDATE users SET password = $1, reset_token = NULL, token_expiry = NULL WHERE id = $2", 
            [hashedPassword, rows[0].id]
        );
        res.json({ success: true, message: "Password Changed Successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error!" });
    }
});




// इतर सर्व रूट्स (Expenses इ.)
app.use('/api', userRoutes);

// सर्व्हर सुरू झाल्यावर डेटाबेस चेक करण्यासाठी (Async पद्धतीने)
const testDB = async () => {
    try {
        await db.query("SELECT 1");
        console.log("✅ DB Connected Successfully!");
    } catch (err) {
        console.error("❌ DB Connection Failed:", err);
    }
};
testDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});