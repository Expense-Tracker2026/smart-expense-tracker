const { Pool } = require('pg');

// DATABASE_URL वापरून कनेक्शन पूल तयार करणे
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Supabase साठी हे आवश्यक आहे
    }
});

// कनेक्शन यशस्वी झाले की नाही हे तपासण्यासाठी (Optional)
db.connect((err) => {
    if (err) {
        console.error('❌ Database connection error:', err.stack);
    } else {
        console.log('✅ Database connected successfully!');
    }
});

module.exports = db;