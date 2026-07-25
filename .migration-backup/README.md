7## 🚀 CrashBet Hub

CrashBet Hub is a real-time crash multiplier game built with a modern full-stack architecture.
It features secure authentication, wallet management, demo & real gameplay modes, and a server-controlled crash engine.

🔗 [PantaneAx live](https://crash-bet-hub.vercel.app)


---

## 🧠 Overview

CrashBet Hub allows users to:

Register using phone, email, and password

Login securely

Access Demo mode with virtual balance

Deposit funds (real wallet architecture ready)

Place bets on a live multiplier

Cash out before the crash

View wallet balances

Track transaction history


The system is designed with financial-grade backend logic and real-time synchronization.


---

## 🏗 Tech Stack

Frontend

React / Next.js

WebSocket client

Responsive UI

Secure authentication flow


Backend

Node.js

Express.js

Socket.io

JWT authentication

Bcrypt password hashing


Database

PostgreSQL (recommended for financial integrity)



---

## 🎮 Game Engine

Multiplier starts at 1.00x

Multiplier increases exponentially

Crash point generated server-side

All bets processed on backend

Demo and Real balances are separated


Server fully controls crash logic to prevent manipulation.


---

## 💰 Wallet System

Each user account includes:

balance_demo

balance_real


All operations are recorded in a transactions table.

Transaction Types

deposit

bet

win

loss

withdrawal


All balance updates are processed through database transactions for consistency.


---

## 🔐 Security

JWT-based authentication

Password hashing (bcrypt)

Input validation

Server-side bet validation

Rate limiting

Secure session handling



---

## 🧪 Demo Mode

Demo mode enables users to:

Play without real money

Test strategies

Experience full gameplay mechanics risk-free



---

## 🛠 Installation

Clone repository:

[git clone](https://github.com/pantane1/crashbet-hub.git)
cd crashbet-hub

Install dependencies:

npm install

Run development server:

npm run dev


---

## ⚙️ Environment Variables

Create a .env file:

JWT_SECRET=your_secret_key
DATABASE_URL=your_database_url
PORT=5000


---

## 📂 Project Structure

/client
  /components
  /pages
  /hooks

/server
  /controllers
  /models
  /routes
  /services
  gameEngine.js


---

## 📈 Future Enhancements

Provably Fair crash algorithm (SHA256-based)

Payment gateway integration

Admin dashboard

Withdrawal system

User verification system

Advanced analytics

Mobile optimization



---

## ⚖️ Disclaimer

This project is built for educational and demonstration purposes.
Operating a real-money betting platform requires proper licensing and compliance with local regulations.


---

## 👨‍💻 Author

**[Pantane](https://nf-d.netlify.app)
Full-Stack Developer**


<p align="center">
  <a href="#"><img src="https://github.com/Pantane1/nf/blob/main/public/ph.png" alt="ph-logo">
</p>

<p align="center">
  <a href="#"><img src="http://readme-typing-svg.herokuapp.com?color=ACAF50&center=true&vCenter=true&multiline=false&lines=Built+Different" alt="pantane">
</p>
