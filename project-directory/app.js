

const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const express = require('express');
const exphbs = require('express-handlebars');
 
const app = express();
const port = 3000;
const dbPath = path.join(__dirname, 'main.db');
const jwtSecret = 'your_jwt_secret';
app.engine('.hbs', exphbs.engine({
    extname: '.hbs', // Set the file extension for handlebars templates
    defaultLayout: 'main', // Optional: Specify the default layout file (main.hbs)
    layoutsDir: __dirname + '/views/layouts' // Optional: Specify the directory for layouts
}));
 
app.set('view engine', '.hbs');
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/login', express.static(path.join(__dirname, 'public', 'login.html')));
app.use('/signup', express.static(path.join(__dirname, 'public', 'signup.html')));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard.html')));
 
// Allow all origins for development, restrict in production
app.use(cors());
// Middleware to parse JSON bodies
app.use(express.json());
// Serve static files (CSS, JavaScript) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Route to render login page
app.get('/login', (req, res) => {
    res.render('login');
});
// Route to render signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});
 
// Route to render dashboard page
app.get('/dashboard', (req, res) => {
    // You might want to fetch data to render the dashboard dynamically
    res.render('dashboard');
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
 
// Function to fetch full name
async function fetchFullName(userId) {
    try {
        const db = await dbPromise;
        const user = await db.get('SELECT fullName FROM users WHERE id = ?', [userId]);
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
// Route to render dashboard page
app.get('/dashboard', async (req, res) => {
    try {
        // Assuming you fetch user data to populate the dashboard
        const userData = await fetchUserData(); // Implement this function to fetch user data
        res.render('dashboard', {
            fullName: userData.fullName,
            urls: userData.urls,
            year: new Date().getFullYear()
        });
    } catch (error) {
        console.error('Error rendering dashboard:', error.message);
        res.status(500).send('Internal Server Error');
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
        const db = await dbPromise;
 
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
 
// Endpoint to delete a URL
app.delete('/s/:shortId', authenticateToken, async (req, res) => {
    const { shortId } = req.params;
 
    try {
        const db = await dbPromise;
        await db.run('DELETE FROM urls WHERE shortId = ?', [shortId]);
        console.log(`Deleted URL with shortId ${shortId}`);
        res.json({ message: 'URL deleted successfully' });
    } catch (err) {
        console.error(`Error deleting URL ${shortId}: ${err.message}`);
        res.status(500).json({ error: 'Error deleting URL' });
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
app.delete('/user/:userId', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
 
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
app.get('/dashboard/:userId', (req, res) => {
    const userId = req.params.userId;
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});
app
 
 