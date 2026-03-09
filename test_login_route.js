require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db/db");

async function run() {
    try {
        console.log("Testing full POST /api/auth/login logic...");
        const email = "test.free1@example.com";
        const password = "Password1!";

        console.log("Fetching user...");
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            console.log("Credenciales incorrectas (no found)");
            process.exit(1);
        }

        const user = result.rows[0];
        console.log("Comparing password...");
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log("Credenciales incorrectas (bad hash)");
            process.exit(1);
        }

        console.log("Signing JWT...");
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log("Success! Token:");
        console.log(token);
    } catch (err) {
        console.error("Test failed with error:", err.message, err.stack);
    } finally {
        process.exit(0);
    }
}

run();
