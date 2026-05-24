const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function startMigration() {
    // तुमच्या डेटाबेसचे डिटेल्स इथे भरा
    const db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
         password: '', 
    database: 'smart_expense_tracker',
    port: 3306, 
    });

    console.log("🔄 Migration is starting...");

    try {
        
        const [users] = await db.execute("SELECT id, password FROM users");

        for (let user of users) {
            
            if (!user.password.startsWith('$2b$')) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(user.password, saltRounds);

                
                await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);
                console.log(`✅Password for User ID ${user.id} has been hashed.`);
            } else {
                console.log(`⏩ User ID ${user.id} is already hashed, skipping.`);
            }
        }
        console.log("\n✨ All passwords have been successfully updated!");
    } catch (err) {
        console.error("❌ An error occurred during the migration:", err.message);
    } finally {
        await db.end();
        process.exit();
    }
}

startMigration();