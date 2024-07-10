const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const app = express();
const port = 3000;
 
const dbPath = path.join(__dirname, 'main.db');
 
async function initializeDatabase() {
    try {
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        await db.exec(`CREATE TABLE IF NOT EXISTS urls (
            shortId TEXT PRIMARY KEY,
            url TEXT
        )`);
        
        console.log(`Database connected and initialized`);
        return db;
    } catch (err) {
        console.error(`Error initializing database ${dbPath}: ${err.message}`);
        throw err;
    }
}
 
let dbPromise = initializeDatabase();
 
app.post('/s/:shortId', express.json(), async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;
 
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
app.get('/s/:shortId', async (req, res) => {
    const { shortId } = req.params;
 
    try {
        const db = await dbPromise;
 
        const row = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);
 
        if (row) {
            const { url } = row;
            return res.redirect(url);
        } else {
            return res.status(404).json({ message: "shortId not found" });
        }
    } catch (err) {
        console.error(`Error retrieving ${shortId} from database: ${err.message}`);
        res.status(500).json({ error: 'Error retrieving from database' });
    }
});
 
app.patch('/s/:shortId', express.json(), async (req, res) => {
    const { shortId } = req.params;
    const { url } = req.body;
 
    try {
        const db = await dbPromise;
 
        const existingUrl = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);
 
        if (existingUrl) {
 
            await db.run('UPDATE urls SET url = ? WHERE shortId = ?', [url, shortId]);
            console.log(`Updated url for ${shortId}`);
        } else {
            console.log(`shortid doesnt exists`);
            res.status(400).json({ error: 'shortId doesnt exist' });
        }
 
        return  res.json({ shortId, url });
    } catch (err) {
        console.error(`Error storing ${shortId} in database: ${err.message}`);
        res.status(500).json({ error: 'Error storing in database' });
    }
});
 
app.delete('/s/:shortId', async (req, res) => {
    const { shortId } = req.params;
 
    try {
        const db = await dbPromise;
        const existingUrl = await db.get('SELECT url FROM urls WHERE shortId = ?', [shortId]);
 
        if (existingUrl) {
         
            await db.run('DELETE FROM urls WHERE shortId = ?', [shortId]);
            console.log(`Deleted url for ${shortId}`);
            res.json({ message: `Deleted url for ${shortId}` });
        } else {
            console.log(`shortId ${shortId} not found`);
            res.status(404).json({ error: `shortId ${shortId} not found` });
        }
    } catch (err) {
        console.error(`Error deleting ${shortId} from database: ${err.message}`);
        res.status(500).json({ error: 'Error deleting from database' });
    }
});
 
 
 
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/s/insta`);
});
 
