# Payeh - Full-Stack Task Management & Chat Application

Payeh is a comprehensive, full-stack web application built with **React** on the frontend and **Node.js/Express** on the backend. It provides an integrated suite of tools for personal productivity and team collaboration, allowing users to manage daily tasks, utilize a Pomodoro timer for focused work, and communicate in private chat channels.

## ✨ Key Features

This application combines several powerful features into a seamless user experience:

-   **👤 User & Profile Management:**
    -   Secure user registration and login handled by Supabase Auth [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/api/routes/auth.js`].
    -   Users can view and edit their profile information, including their name, username, and avatar image [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/MyAccount.jsx`].
    -   Profile pictures are uploaded directly to Supabase Storage for secure cloud hosting [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/MyAccount.jsx`].

-   **📝 Task Management (To-Do):**
    -   Full CRUD (Create, Read, Update, Delete) functionality for daily tasks [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/api/routes/tasks.js`].
    -   An intuitive UI on the home page allows users to swipe tasks to the right to mark them as complete [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/Home.jsx`].
    -   Tasks can be categorized with a score (1-3), which contributes to the user's position on the leaderboard [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/Calendar.jsx`].

-   **📅 Integrated Calendar:**
    -   A full-featured calendar displays tasks in a weekly view, giving users a clear overview of their schedule [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/Calendar.jsx`].
    -   Users can add new tasks directly to a specific date via an integrated modal form.

-   **⏱️ Productivity Tools:**
    -   **Pomodoro Timer:** A built-in timer to help users manage work and break intervals based on the Pomodoro Technique [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/Room.jsx`].
    -   **Gamified Leaderboard:** To foster motivation, a leaderboard ranks users based on total focus time and points earned from completing tasks [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/api/routes/room.js`].

-   **💬 Real-time Chat:**
    -   Users can create private chat channels and invite others to join [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/ChatHome.jsx`].
    -   Send and receive text messages and images in real-time.
    -   Live message updates are powered by Supabase Realtime subscriptions, ensuring instant communication [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/pages/ChatRoom.jsx`].

## 🛠️ Tech Stack

| Category      | Technology / Library                                       |
| :------------ | :--------------------------------------------------------- |
| **Frontend** | React, React Router, Axios, React Swipeable, CSS           |
| **Backend** | Node.js, Express.js, CORS                                  |
| **Database** | Supabase (PostgreSQL)                                      |
| **Auth** | Supabase Auth                                              |
| **Storage** | Supabase Storage (for user avatars and chat images)        |
| **Deployment**| Vercel (configured via `vercel.json` [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/vercel.json`]) |

## 🚀 Local Setup and Installation

Follow these steps to run the project locally.

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/MrRMansd01/Payeh.git](https://github.com/MrRMansd01/Payeh.git)
    cd Payeh
    ```

2.  **Install Server Dependencies:**
    ```bash
    cd api
    npm install
    ```

3.  **Install Client Dependencies:**
    ```bash
    cd ../client
    npm install
    ```

4.  **Configure Supabase Credentials:**
    > **⚠️ Important:** This project contains hardcoded Supabase keys for simplicity. In a production environment, you must use environment variables to protect your credentials.

    You will need to replace the placeholder keys with your own Supabase project keys in two files:
    -   **Client-side:** Open `client/src/supabaseClient.js` and update `supabaseUrl` and `supabaseAnonKey` [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/client/src/supabaseClient.js`].
    -   **Server-side:** Open `api/supabaseClient.js` and update `supabaseUrl` and `supabaseKey` [cite: `mrrmansd01/payeh/Payeh-a9bf7c3b159bcb55da30765e68a4de878a6aea0b/api/supabaseClient.js`].

## ▶️ Running the Application

To run the application, you need to start both the backend and frontend servers concurrently.

1.  **Start the Server:**
    In a terminal, navigate to the `api` directory and run:
    ```bash
    npm start
    ```
    The backend server will start on `http://localhost:3001`.

2.  **Start the Client:**
    In a separate terminal, navigate to the `client` directory and run:
    ```bash
    npm start
    ```
    The React development server will start and open the application in your browser at `http://localhost:3000`.

## 📂 Project Structure

```
Payeh/
├── api/                # Backend (Node.js/Express)
│   ├── routes/         # API route definitions
│   ├── supabaseClient.js # Server-side Supabase client
│   ├── index.js          # Main server entry point
│   └── package.json
│
├── client/             # Frontend (React)
│   ├── public/         # Static assets and index.html
│   ├── src/
│   │   ├── components/ # Reusable components (e.g., Footer)
│   │   ├── pages/      # Page-level components
│   │   ├── App.jsx     # Main application component with routing
│   │   ├── api.js      # Axios instance for API calls
│   │   └── index.js    # React application entry point
│   └── package.json
│
└── vercel.json         # Deployment configuration for Vercel


۳. چطور تغییرات لوکال رو به آنلاین بفرستیم؟ (Push)
npx supabase db push
نکته: دفعه بعد که خواستی کار کنی، فقط کافیه بزنی npx supabase start -x logflare,vector,supavisor,imgproxy و دوباره پروژه‌ات وصل می‌شه.


۱. توقف کامل (Stop)
وقتی کارت تموم شد، برای اینکه RAM و CPU کاملاً آزاد بشن، توی پوشه پروژه این رو بزن:

npx supabase stop

۲. شروع مجدد (Start)

npx supabase start -x logflare,vector,supavisor,imgproxy,edge-runtime

۳. چطور تغییرات لوکال رو به آنلاین بفرستیم؟ (Push)
npx supabase db push
نکته: دفعه بعد که خواستی کار کنی، فقط کافیه بزنی npx supabase start -x logflare,vector,supavisor,imgproxy و دوباره پروژه‌ات وصل می‌شه.