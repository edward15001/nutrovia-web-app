require("dotenv").config();
const db = require("./db/db");
const bcrypt = require("bcryptjs");
const stripeService = require("./services/stripeService");

async function run() {
    try {
        console.log("Testing POST /api/auth/register...");
        const email = "test.script10@" + Date.now() + ".com";
        const passwordHash = await bcrypt.hash("password123", 12);
        const stripeCustomerId = await stripeService.createCustomer(email, "Test Name");
        console.log("Stripe customer ID:", stripeCustomerId);

        const userResult = await db.query(
            "INSERT INTO users (name, email, password_hash, stripe_customer_id) VALUES ($1, $2, $3, $4) RETURNING id, email",
            ["Test Name", email, passwordHash, stripeCustomerId]
        );
        console.log("User inserted:", userResult.rows[0]);

        console.log("Testing POST /api/auth/login...");
        const loginResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        console.log("Login user found:", loginResult.rows[0].email);

        console.log("Testing Plan fetch...");
        const planResult = await db.query(
            `SELECT np.*, qa.goal, qa.activity_level, qa.dietary_preference,
              qa.age, qa.sex, qa.weight_kg, qa.height_cm, qa.health_conditions
       FROM nutrition_plans np
       JOIN questionnaire_answers qa ON qa.user_id = np.user_id
       WHERE np.user_id = $1`,
            [userResult.rows[0].id]
        );
        console.log("Plan result (expect empty since not generated):", planResult.rows.length);

        // Also let's check the test.free1@example.com user:
        console.log("Checking test.free1@example.com...");
        const free1 = await db.query("SELECT id FROM users WHERE email = $1", ["test.free1@example.com"]);
        if (free1.rows.length > 0) {
            console.log("User found! ID:", free1.rows[0].id);
            const planFree = await db.query(`SELECT np.* FROM nutrition_plans np WHERE np.user_id = $1`, [free1.rows[0].id]);
            console.log("Plans for free1:", planFree.rows.length);
        } else {
            console.log("test.free1@example.com not found!");
        }

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        process.exit(0);
    }
}

run();
