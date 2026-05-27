const { Client } = require('pg'); // MySQL ऐवजी pg लायब्ररी
const bcrypt = require('bcrypt');

async function startMigration() {
    // Supabase चे डेटाबेस कनेक्शन डिटेल्स इथे टाका
    const db = new Client({
        connectionString: 'तुमची_Supabase_Connection_String_इथे_टाका'
    });

    await db.connect();
    console.log("🔄 Migration is starting...");

    try {
        // १. युजर्सचा डेटा मिळवा
        const res = await db.query("SELECT id, password FROM users");
        const users = res.rows;

        for (let user of users) {
            // २. चेक करा पासवर्ड हॅश आहे का ($2b$ किंवा $2a$ ने सुरू होतो)
            if (user.password && !user.password.startsWith('$2')) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(user.password, saltRounds);

                // ३. अपडेट करण्यासाठी db.query वापरा
                await db.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, user.id]);
                console.log(`✅ Password for User ID ${user.id} has been hashed.`);
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