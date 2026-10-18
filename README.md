# MSWIL B2B Order Management & Inventory Portal

![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014%20(App%20Router)-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20(Python%203)-005571?style=for-the-badge&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/Database-Neon%20PostgreSQL-4169E1?style=for-the-badge&logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38Bdf8?style=for-the-badge&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployment-Vercel%20%2F%20Render-black?style=for-the-badge&logo=vercel)

A full-stack, cloud-hosted enterprise procurement and inventory control portal engineered for **Motherson Sumi Wiring India Limited (MSWIL)**. The platform bridges corporate OEM clients with internal warehouse and dispatch teams, replacing fragmented email-and-spreadsheet workflows with an auditable, real-time system of record.

---

## 🔗 Quick Links
* **Live Application:** [https://mswil-portal.vercel.app/](https://mswil-portal.vercel.app/)
* **GitHub Repository:** [https://github.com/ParthUppal523/mswil-inventory](https://github.com/ParthUppal523/mswil-inventory)
* **Interactive Demo Walkthrough (Admin):** [Live Admin Portal Sandbox](https://mswil-portal.vercel.app/login?demo=admin)
* **Interactive Demo Walkthrough (Customer):** [Live Customer Portal Sandbox](https://mswil-portal.vercel.app/login?demo=customer)
* **Video Demo:** *[Insert YouTube / Loom Link Here]*

---

## 🚀 Key Features

### 1. Secure Authentication & Role-Based Access Control (RBAC)
* Self-registration pipeline segregating accounts into **Corporate Customers** and **MSWIL Employees**.
* Administrator approval gate (`is_approved = False` by default) preventing unauthorized access.
* Stateless JWT authentication (`PyJWT`) paired with adaptive, salted password hashing (`bcrypt`).

### 2. Smart B2B Procurement Engine
* Real-time search-as-you-type component indexing across automotive wiring parts catalogs.
* Dynamic cart calculations with automatic Indian Numeral System currency formatting (`en-IN` / ₹ Cr / ₹ L).
* **Backorder Gating:** Allows forward-ordering against expected production schedules when item demand exceeds live warehouse stock without breaking checkout.

### 3. Order Fulfilment & Atomic Invoicing
* Admin review queue featuring an interactive **Deficit Resolution Modal** that computes precise stock shortfalls.
* **Atomic Transactions:** Invoicing executes as a single ACID transaction ensuring stock quantities decrement safely alongside order status updates and audit insertions with full rollbacks on failure.

### 4. Automated Document Generation & Notifications
* Programmatic, server-side generation of tamper-evident, GST-compliant **Tax Invoices** and **Purchase Order copies** using ReportLab.
* Non-blocking SMTP email dispatch and in-app notifications with deep-linking support (`target_tab`).

### 5. Immutable Security Audit Trail
* Append-only administrative logging table (`admin_activity_logs`) capturing action types, admin snapshots, and structured before-and-after JSON state deltas.

---

## 🛠️ Technology Stack

| Layer | Technologies Used | Primary Responsibility |
| :--- | :--- | :--- |
| **Frontend UI / UX** | Next.js (App Router), TypeScript, Tailwind CSS, Headless UI, Lucide React | Role-aware routing, responsive dashboards, interactive forms, and typed component states. |
| **Data Visualization** | Recharts | Interactive 6-month revenue trends, status distribution charts, and fast-moving item metrics. |
| **Backend API** | Python 3, FastAPI, Uvicorn (ASGI), Pydantic v2 | High-concurrency REST endpoints, schema validation, and background task delegation. |
| **Database & ORM** | PostgreSQL (Neon Cloud), SQLAlchemy 2.0 | Normalized 8-table relational schema, referential cascades, and pessimistic connection pooling (`pool_pre_ping=True`). |
| **Document Engine** | ReportLab | Programmatic PDF compilation for statutory Tax Invoices and Purchase Orders. |
| **Cloud Hosting** | Vercel (Frontend), Render (Backend), Neon (Database) | Decoupled continuous deployment pipeline over secure TLS channels (`sslmode=require`). |

---

## 📊 Relational Database Architecture
The platform is powered by an 8-table normalized schema with strict referential integrity:
* `users`: Central identity credentials, RBAC roles, and approval flags.
* `customer_profiles` & `employee_profiles`: 1:1 segregated metadata mapping corporate tax details (GSTIN, addresses) or internal department tags.
* `inventory_items`: Catalog tracking component codes, serial numbers, stock quantities, and pricing.
* `purchase_orders` & `purchase_order_items`: 1:N relational order headers and line items storing historical unit price snapshots.
* `notifications`: In-app alert dispatch table with deep-linking routing capabilities.
* `admin_activity_logs`: Immutable audit trail recording administrative state alterations as native JSON deltas.

---

## ⚙️ Local Installation & Setup

### Prerequisites
* Node.js (LTS) & npm
* Python 3.10+ & pip
* PostgreSQL or a Neon Cloud Database URL

### 1. Clone the Repository
```bash
git clone [https://github.com/ParthUppal523/mswil-inventory.git](https://github.com/ParthUppal523/mswil-inventory.git)
cd mswil-inventory
