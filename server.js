const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");

const session = require("express-session");

require("dotenv").config();

const { Pool } = require("pg");

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS pfps (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            image BYTEA NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS completions (
            id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            exam TEXT NOT NULL,
            username TEXT NOT NULL,
            duration DOUBLE PRECISION NOT NULL,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            score DOUBLE PRECISION NOT NULL,
            pfp_id BIGINT REFERENCES pfps(id)
        );
    `);
}

initDB().catch(console.error);

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));


app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/warn", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "warn.html"));
});

app.get("/exam/:id", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "exam.html"));
});

if (process.env.DEV === "true") {
    app.listen(3000, "0.0.0.0", () => {
     console.log(`Server running at http://localhost:${3000}`);
    });
}

module.exports = app;

const EXAM_DIR = path.join(__dirname, "exam");

app.get("/api/exams", async (req, res) => {
    try {
        const files = await fs.readdir(EXAM_DIR);

        const exams = await Promise.all(
            files
                .filter(file => file.endsWith(".json"))
                .map(async file => {
                    const filePath = path.join(EXAM_DIR, file);
                    const content = await fs.readFile(filePath, "utf8");
                    const exam = JSON.parse(content);

                    return {
                        id: exam.id,
                        title: exam.title,
                        subject: exam.subject
                    };
                })
        );

        res.json(exams);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load exams" });
    }
});

app.get("/api/exams/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return res.status(400).json({ error: "Invalid ID" });
        }

        const filePath = path.join(EXAM_DIR, `${id}.json`);
        const content = await fs.readFile(filePath, "utf8");

        res.json(JSON.parse(content));
    } catch (err) {
        if (err.code === "ENOENT") {
            return res.status(404).json({ error: "Exam not found" });
        }

        if (err instanceof SyntaxError) {
            return res.status(500).json({ error: "Invalid JSON file" });
        }

        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


app.post("/api/exams/:id/complete", async (req, res) => {
    const { username, duration, score, avatar } = req.body;
    const exam = req.params.id;

    if (
        !/^[a-zA-Z0-9_-]+$/.test(exam) ||
        typeof username !== "string" ||
        !username.trim() ||
        username.trim().length > 50 ||
        typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration < 0 ||
        typeof score !== "number" ||
        !Number.isFinite(score) ||
        score < 0 ||
        (avatar !== undefined &&
            (typeof avatar !== "string" ||
             !/^[A-Za-z0-9+/]*={0,2}$/.test(avatar) ||
             avatar.length > 2_800_000))
    ) {
        return res.status(400).json({ error: "Invalid data" });
    }

    const client = await db.connect();

    try {
        await client.query("BEGIN");

        let pfpId = null;

        if (avatar) {
            const image = Buffer.from(avatar, "base64");

            // Reuse an identical image, or insert it if it is new.
            const pfp = await client.query(
                `INSERT INTO pfps (image)
                 VALUES ($1)
                 ON CONFLICT (image)
                 DO UPDATE SET image = EXCLUDED.image
                 RETURNING id`,
                [image]
            );

            pfpId = pfp.rows[0].id;
        }

        const result = await client.query(
            `INSERT INTO completions
                (exam, username, duration, score, pfp_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [exam, username.trim(), duration, score, pfpId]
        );

        await client.query("COMMIT");

        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});


app.get("/api/completions", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM completions ORDER BY id"
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load completions" });
    }
});

app.get("/api/pfps", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT id, image FROM pfps ORDER BY id"
        );

        res.json(
            result.rows.map(pfp => ({
                id: pfp.id,
                image: pfp.image.toString("base64")
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load profile pictures" });
    }
});

app.get("/api/pfps/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: "Invalid pfp ID" });
        }

        const result = await pool.query(
            "SELECT image FROM pfps WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Pfp not found" });
        }

        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=86400");
        res.send(result.rows[0].image);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get pfp" });
    }
});