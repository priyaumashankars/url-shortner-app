const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'main.db');
const jwtSecret = 'your_jwt_secret'; 

// Function to initialize SQLite database
async function initializeDatabase() {
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await db.exec(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT,
            Email TEXT UNIQUE,
            Password TEXT
        );`);

        console.log('Database connected and initialized!');
        return db;
    } catch (err) {
        console.error(`Error initializing database ${dbPath}: ${err.message}`);
        throw err;
    }
}

let dbPromise = initializeDatabase();

// Regular expressions for validation
const urlRegex = /^https?:\/\/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?$/;
const shortIdRegex = /^[a-zA-Z0-9]{3,20}$/;

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }
        req.user = user;
        next();
    });
}


async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}


app.post('/s/:shortId', authenticateToken, async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;

    if (!shortIdRegex.test(shortId)) {
        return res.status(400).json({ error: 'Invalid shortId' });
    }

    if (!urlRegex.test(url)) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const db = await dbPromise;
        const existingUrl = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);

        if (existingUrl) {
            await db.run('UPDATE urls SET url = ? WHERE shortId = ?', [url, shortId]);
            console.log(`Updated url for ${shortId}`);
        } else {
            await db.run('INSERT INTO urls (shortId, url) VALUES (?, ?)', [shortId, url]);
            console.log(`Inserted new url for ${shortId}`);
        }

        res.json({ shortId, url });
    } catch (err) {
        console.error(`Error storing ${shortId} in database: ${err.message}`);
        res.status(500).json({ error: 'Error storing in database' });
    }
});

// Endpoint for user signup
app.post('/signup', async (req, res) => {
    const { fullName, Email, Password } = req.body;

    if (!fullName || !Email || !Password) {
        return res.status(400).json({ error: 'fullName, Email, and Password are required' });
    }

    try {
        const db = await dbPromise;
        const hashedPassword = await hashPassword(Password);
        await db.run('INSERT INTO users (fullName, Email, Password) VALUES (?, ?, ?)', [fullName, Email, hashedPassword]);
        console.log(`Inserted new user ${fullName}`);
        res.status(201).json({ fullName, Email });
    } catch (err) {
        console.error(`Error storing user ${fullName} in database: ${err.message}`);
        res.status(500).json({ error: 'Error storing user in database' });
    }
});

// Endpoint for user login
app.post('/login', async (req, res) => {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
        return res.status(400).json({ error: 'Email and Password are required' });
    }

    try {
        const db = await dbPromise;
        const user = await db.get('SELECT * FROM users WHERE Email = ?', [Email]);

        if (!user) {
            return res.status(401).json({ error: 'Invalid Email or Password' });
        }

        const passwordMatch = await bcrypt.compare(Password, user.Password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid Email or Password' });
        }

        const token = jwt.sign({ id: user.id, Email: user.Email }, jwtSecret, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(`Error logging in: ${err.message}`);
        res.status(500).json({ error: 'Error logging in' });
    }
});
app.delete('/s/:shortId', authenticateToken, async (req, res) => {
    const { shortId } = req.params;

    if (!shortIdRegex.test(shortId)) {
        return res.status(400).json({ error: 'Invalid shortId' });
    }

    try {
        const db = await dbPromise;
        const existingUrl = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);

        if (!existingUrl) {
            return res.status(404).json({ error: `shortId ${shortId} not found` });
        }

        await db.run('DELETE FROM urls WHERE shortId = ?', [shortId]);
        console.log(`Deleted url for ${shortId}`);

        res.json({ message: `Deleted url for ${shortId}` });
    } catch (err) {
        console.error(`Error deleting ${shortId} from database: ${err.message}`);
        res.status(500).json({ error: 'Error deleting from database' });
    }
});

// Example protected endpoint
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected endpoint accessed successfully' });
});
// Example protected endpoint
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected endpoint accessed successfully' });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
