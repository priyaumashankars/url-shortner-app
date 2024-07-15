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

        await db.exec(`CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shortId TEXT UNIQUE,
            url TEXT,
            userId INTEGER,  -- Add userId column here
            FOREIGN KEY(userId) REFERENCES users(id)
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
 
// Function to hash passwords
async function hashPassword(password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}
 
// Endpoint to create or update short URLs
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
app.post('/link-shortid', authenticateToken, async (req, res) => {
    const { shortId } = req.body; // Assuming shortId is sent in the request body
    const userId = req.user.id; // Get userId from authenticated user

    try {
        const db = await dbPromise;
        const existingUrl = await db.get('SELECT * FROM urls WHERE shortId = ?', [shortId]);

        if (existingUrl) {
            return res.status(400).json({ error: 'ShortId is already linked to a user' });
        }

        await db.run('INSERT INTO urls (shortId, userId) VALUES (?, ?)', [shortId, userId]);
        console.log(`Linked shortId ${shortId} to user ${userId}`);

        res.json({ shortId, userId });
    } catch (err) {
        console.error(`Error linking shortId ${shortId} to user ${userId}: ${err.message}`);
        res.status(500).json({ error: 'Error linking shortId to user' });
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
// Endpoint to delete a user
app.delete('/users/:id', authenticateToken, async (req, res) => {
    const userId = req.params.id;
 
    try {
        const db = await dbPromise;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
 
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
 
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
        console.log(`Deleted user with id ${userId}`);
 
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(`Error deleting user: ${err.message}`);
        res.status(500).json({ error: 'Error deleting user' });
    }
});
// Endpoint to update user information
app.put('/users/:id', authenticateToken, async (req, res) => {
    const userId = req.params.id;
    const { fullName, Email, Password } = req.body;
 
    if (!fullName || !Email || !Password) {
        return res.status(400).json({ error: 'fullName, Email, and Password are required' });
    }
 
    try {
        const db = await dbPromise;
        const hashedPassword = await hashPassword(Password);
        
        // Update the user information in the database
        await db.run('UPDATE users SET fullName = ?, Email = ?, Password = ? WHERE id = ?', [fullName, Email, hashedPassword, userId]);
 
        console.log(`Updated user ${userId}`);
        res.json({ userId, fullName, Email });
    } catch (err) {
        console.error(`Error updating user ${userId}: ${err.message}`);
        res.status(500).json({ error: 'Error updating user' });
    }
});
 
 
 
// Example protected endpoint
app.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Protected endpoint accessed successfully' });
});

 
// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
