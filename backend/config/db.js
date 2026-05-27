const { Pool } = require('pg');

// DATABASE_URL सेट आहे का ते तपासा
if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL ERROR: DATABASE_URL is not defined in environment variables.');
    process.exit(1); // सर्व्हर बंद करा जर डेटाबेस कनेक्शन नसेल तर
}

// कनेक्शन पूल तयार करणे
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Supabase साठी आवश्यक
    },
    // अधिक सेफ्टीसाठी काही सेटिंग्स
    max: 20, // एकाच वेळी जास्तीत जास्त २० कनेक्शन्स
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// कनेक्शन तपासा
db.on('connect', () => {
    console.log('✅ Connected to the database successfully!');
});

db.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = db;