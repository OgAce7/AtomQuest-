# AtomQuest Goal Governance Portal 🚀

A decoupled, full-stack enterprise goal management and performance tracking system built for the **AtomQuest Hackathon 1.0**. 

This portal eliminates manual spreadsheet tracking by providing a structured, digital environment for goal setting, phase-based approvals, and quarterly achievement tracking with strict data validation.

## 🔗 Live Demo
**Access the live application here:** [https://atom-quest-nine.vercel.app](https://atom-quest-nine.vercel.app)

*(Note: The backend is hosted on a free Render instance. It may take 10-15 seconds to wake up upon your first click!)*

---

## 👥 Demo Credentials
To evaluate the role-based isolation and workflows, use the following test accounts:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Employee** | Priya Sharma | `priya@co.in` | `123` |
| **Manager (L1)** | Kavita Nair | `kavita@co.in` | `123` |
| **Admin / HR** | Rahul Joshi | `rahul@co.in` | `123` |

---

## 🏗️ System Architecture & Tech Stack
The application utilizes a decoupled, 3-tier cloud architecture:

* **Presentation Layer (Frontend):** * Single Page Application (SPA) built with HTML/CSS/JavaScript (React-style state management).
  * Hosted on **Vercel Edge Network**.
* **Application Layer (Backend):** * REST API built with **Node.js & Express.js**.
  * Hosted on **Render Web Services**.
  * Features custom middleware for audit logging and mathematical utility engines for strict progress validation.
* **Data Layer (Database):** * **MongoDB** (NoSQL) managed via Mongoose ODM.
  * Hosted on **MongoDB Atlas Cloud**.

---

## ✨ Key Features & Business Logic
* **Strict Validation Engine:** System-enforced validation ensuring goal weightages strictly equal 100%, with caps on individual achievements ($0 \le score \le 1$) to prevent organizational data inflation.
* **Role-Based Workflows:** Distinct UI rendering and capability access depending on whether the active user is an Employee, Manager, or Admin.
* **Phase-Based Locking:** Once a manager approves a goal sheet, it locks. Any subsequent edits trigger the backend tracking middleware.
* **Audit Trail:** Immutable logging of any system modifications to ensure enterprise compliance. 

---

## 💻 Local Setup (For Evaluators)
If you wish to run this application locally:

1. Clone this repository.
2. Navigate to the `backend` directory and run `npm install`.
3. Create a `.env` file in the backend directory and add your MongoDB connection string: `MONGO_URI=your_uri_here` and `PORT=5000`.
4. Run `node seed.js` to populate the initial user and goal data.
5. Run `npm run dev` to start the backend server.
6. Open `index.html` in your browser.
