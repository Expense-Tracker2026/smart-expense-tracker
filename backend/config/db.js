const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'smart_expense_tracker',
    port: 3306, // तुम्ही स्क्रीनशॉटमध्ये दाखवल्याप्रमाणे ३३०७
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;