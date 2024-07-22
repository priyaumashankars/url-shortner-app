const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
 
const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'main.db');
const jwtSecret = 'your_jwt_secret';
 
// Serve static files from the 'public' directory
app.use('/login', express.static(path.join(__dirname, 'public', 'login.html')));
app.use('/signup', express.static(path.join(__dirname, 'public', 'signup.html')));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard.html')));
app.use(express.static(path.join(__dirname, 'public')));
// Allow all origins for development, restrict in production
app.use(cors());
 
app.get('/dashboard/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
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
            userId INTEGER,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
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
 // Example function to fetch full name (replace with actual logic)
async function fetchFullName() {
    try {
        const db = await dbPromise;
        const userId = req.params.userId;
        const user = await db.get('SELECT * FROM users WHERE id = ?', [fullName]);
        if (!user) {
            throw new Error('User not found');
        }
        return user.fullName;
    } catch (error) {
        console.error('Error fetching full name:', error.message);
        throw error;
    }
}

// Endpoint to fetch full name dynamically
app.get('/fullname/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const fullName = await fetchFullName(userId);
        res.json({ fullName });
    } catch (error) {
        console.error('Error fetching full name:', error.message);
        res.status(500).json({ error: 'Failed to fetch full name' });
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
 
        // Generate JWT token
        const token = jwt.sign({ id: user.id, Email: user.Email }, jwtSecret, { expiresIn: '1h' });
 
        // Respond with user data and token
        res.json({ user: { id: user.id }, token });
 
    } catch (err) {
        console.error(`Error logging in: ${err.message}`);
        res.status(500).json({ error: 'Error logging in' });
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
        const result = await db.run('INSERT INTO users (fullName, Email, Password) VALUES (?, ?, ?)', [fullName, Email, hashedPassword]);
 
        // Fetch the userId of the newly inserted user
        const userId = result.lastID;
 
        // Create JWT token
        const token = jwt.sign({ id: userId, Email: Email }, jwtSecret, { expiresIn: '1h' });
 
        console.log(`Inserted new user ${fullName}`);
        res.status(201).json({ userId, fullName, Email, token }); // Return userId, fullName, Email, and token
    } catch (err) {
        console.error(`Error storing user ${fullName} in database: ${err.message}`);
        res.status(500).json({ error: 'Error storing user in database' });
    }
});
// Endpoint to add or update a URL
app.post('/s/:shortId', authenticateToken, async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;
 
    try {
        const db = await dbPromise; // Await initialization
 
        // Check if the URL already exists for the given shortId
        const existingUrl = await db.get('SELECT * FROM urls WHERE shortId = ?', [shortId]);
 
        if (existingUrl) {
            // Update existing URL
            await db.run('UPDATE urls SET url = ? WHERE shortId = ?', [url, shortId]);
            console.log(`Updated URL for ${shortId}`);
        } else {
            // Insert new URL
            await db.run('INSERT INTO urls (shortId, url, userId) VALUES (?, ?, ?)', [shortId, url, req.user.id]);
            console.log(`Inserted new URL for ${shortId}`);
        }
 
        res.json({ shortId, url });
    } catch (error) {
        console.error(`Error adding/updating URL: ${error.message}`);
        res.status(500).json({ error: 'Failed to add/update URL. Please try again later.' });
    }
});
 
// Endpoint to fetch URLs for the logged-in user
app.get('/urls', authenticateToken, async (req, res) => {
    try {
        const db = await dbPromise;
        const dbQuery = await db.all('SELECT * FROM urls WHERE userId = ?', [req.user.id]);
        res.json(dbQuery);
    } catch (err) {
        console.error(`Error fetching URLs from database: ${err.message}`);
        res.status(500).json({ error: 'Error fetching URLs from database' });
    }
});
 
// Example: Using async/await to ensure db is initialized before using it
app.post('/s/:shortId', async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;
 
    try {
        const db = await dbPromise; // Await initialization
        const existingUrl = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);
 
        if (existingUrl) {
            // Update existing URL
            await db.run('UPDATE urls SET url = ? WHERE shortId = ?', [url, shortId]);
            console.log(`Updated URL for ${shortId}`);
        } else {
            // Insert new URL
            await db.run('INSERT INTO urls (shortId, url, userId) VALUES (?, ?, ?)', [shortId, url, req.user.id]);
            console.log(`Inserted new URL for ${shortId}`);
        }
 
        res.json({ shortId, url });
    } catch (error) {
        console.error(`Error adding/updating URL: ${error.message}`);
        res.status(500).json({ error: 'Failed to add/update URL. Please try again later.' });
    }
});
 
 
// Endpoint to delete a URL
app.delete('/s/:shortId', authenticateToken, async (req, res) => {
    const { shortId } = req.params;
 
    try {
        const db = await dbPromise;
        await db.run('DELETE FROM urls WHERE shortId = ?', [shortId]);
        console.log(`Deleted url with shortId ${shortId}`);
        res.json({ message: 'URL deleted successfully' });
    } catch (err) {
        console.error(`Error deleting url ${shortId}: ${err.message}`);
        res.status(500).json({ error: 'Error deleting url' });
    }
});
// Endpoint to verify JWT token
app.post('/verifyToken', async (req, res) => {
    const { token } = req.body;
 
    if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
    }
 
    try {
        const decoded = jwt.verify(token, jwtSecret);
        res.json({ valid: true });
    } catch (err) {
        console.error(`Error verifying token: ${err.message}`);
        res.status(401).json({ valid: false });
    }
});
 
// Endpoint to delete a user
app.delete('http://localhost:3000/s/${shortId}', authenticateToken, async (req, res) => {
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
// PUT endpoint to update URL
app.put('/s/:shortId', async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;
  
    try {
      // Update the URL in the SQLite database
      const db = await dbPromise;
      db.run(
        'UPDATE urls SET url = ? WHERE shortId = ?',
        [url, shortId],
        function (err) {
          if (err) {
            console.error('Error updating URL:', err.message);
            return res.status(500).json({ error: 'Error updating URL' });
          }
          // Check if any rows were affected
          if (this.changes === 0) {
            return res.status(404).json({ error: 'URL not found' });
          }
          // Respond with success message or updated data if needed
          res.json({ message: 'URL updated successfully' });
        }
      );
    } catch (error) {
      console.error('Error updating URL:', error.message);
      res.status(500).json({ error: 'Error updating URL' });
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
 