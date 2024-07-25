
# User Dashboard Application
 
This project is a web application built using Node.js, Express.js, SQLite, and Bootstrap. It provides functionality for user authentication, managing URLs, and displaying a user dashboard.
 
## Features
 
- **User Authentication**: Users can sign up and log in securely. Passwords are hashed using bcrypt before storing in the database.

- **User Dashboard**: After logging in, users are redirected to a dashboard where they can view, add, edit, and delete URLs associated with their account.
 
- **URL Management**: URLs are stored in an SQLite database and associated with each user. Users can perform CRUD (Create, Read, Update, Delete) operations on these URLs.
 
## Technologies Used
 
- **Backend**:

  - Node.js

  - Express.js

  - SQLite3 (with SQLite as the database)

  - bcryptjs (for password hashing)

  - jsonwebtoken (JWT for authentication)

- **Frontend**:

  - HTML/CSS (Bootstrap for styling)

  - JavaScript (Vanilla JS and some Bootstrap JS for frontend interactivity)
 
## Prerequisites
 
Before running the application, ensure you have the following installed:
 
- Node.js (with npm)

- SQLite
 
## Setup Instructions
 
1. **Clone the repository**:

   ```bash

   git clone https://github.com/yourusername/your-repo.git

   cd your-repo

   ```
 
2. **Install dependencies**:

   ```bash

   npm install

   ```
 
3. **Initialize the SQLite database**:

   ```bash

   node app.js

   ```
 
4. **Start the application**:

   ```bash

   npm start

   ```

   This will start the server on `http://localhost:3000`.
 
5. **Access the application**:

   Open your web browser and go to `http://localhost:3000` to access the application.
 
## Usage
 
- **Signup**: Navigate to `http://localhost:3000/signup` to create a new account.

- **Login**: Navigate to `http://localhost:3000/login` to log into your account.

- **Dashboard**: Upon successful login, you will be redirected to `http://localhost:3000/dashboard` where you can manage your URLs.
 
### API Endpoints
 
- **POST `/signup`**: Create a new user account.

- **POST `/login`**: Authenticate and log in a user.

- **GET `/dashboard`**: Render the user dashboard with URL management functionality.

- **POST `/s/:shortId`**: Add or update a URL associated with the logged-in user.

- **GET `/urls`**: Fetch all URLs associated with the logged-in user.

- **DELETE `/s/:shortId`**: Delete a URL associated with the logged-in user.

- **POST `/verifyToken`**: Verify the validity of a JWT token.

- **DELETE `/user/:userId`**: Delete a user account (admin endpoint).
 
## Contributing
 
Contributions are welcome! If you find any issues or want to add new features, please fork the repository and submit a pull request.
 
## License
 
This project is licensed under the MIT License - see the LICENSE file for details.

