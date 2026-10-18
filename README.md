<div align="center">

# ⚡ MSWIL B2B Order Management & Inventory Portal

**An enterprise-grade procurement, inventory control, and invoicing system built for Motherson Sumi Wiring India Limited (MSWIL).**

[![Next.js](https://img.shields.io/badge/Next.js-App_Router-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy_2.0-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)

[🌐 **Live Portal**](https://mswil-portal.vercel.app/) &nbsp;•&nbsp; [🛡️ **1-Click Admin Sandbox**](https://mswil-portal.vercel.app/login?demo=admin) &nbsp;•&nbsp; [🛒 **1-Click Customer Sandbox**](https://mswil-portal.vercel.app/login?demo=customer)

</div>

---

## 📌 Overview

Supply chain workflows in automotive wiring harness manufacturing require tight coordination between corporate OEM purchase orders and live warehouse inventory. Previously, procurement relied on manual email and spreadsheet exchanges, resulting in delayed order confirmations, lack of real-time status tracking, disconnected third-party invoice generation, and fragmented auditing.

The **MSWIL Enterprise Portal** replaces these manual bottlenecks with a single, role-based system of record. Corporate clients can search live inventory, submit multi-item Purchase Orders (POs), and download GST-compliant Tax Invoices, while MSWIL administrators manage stock, resolve backorder deficits, and audit every state change in real time.

---

## 🧪 Live Portfolio Sandbox (1-Click Reviewer Access)

To allow technical reviewers to evaluate both role experiences without exposing production records, the live deployment includes an **isolated sandbox environment** (`item_code >= 1000000` and scoped query filters). Clicking either link below automatically loads the pre-configured demo credentials:

| Role View | Direct Autofill Link | Username | Password | Capabilities to Test |
| :--- | :--- | :--- | :--- | :--- |
| 🛡️ **Admin (OMS)** | [**Launch Admin Demo**](https://mswil-portal.vercel.app/login?demo=admin) | `demo.admin` | `Admin@123` | View YTD/MTD KPIs, manage sample inventory, review backorder deficits, approve POs, generate Tax Invoices, and inspect JSON audit logs. |
| 🏢 **Customer (B2B)** | [**Launch Customer Demo**](https://mswil-portal.vercel.app/login?demo=customer) | `demo_customer` | `Customer@123` | Build multi-item POs with search-as-you-type auto-fill, trigger backorder warnings, track order statuses, and download PO/Invoice PDFs. |

> **⏳ Note on Cloud Cold Starts:** The FastAPI backend is hosted on Render's free web service tier, which spins down after 15 minutes of inactivity. The initial sign-in request may take **30–50 seconds** while the container wakes up.

---

## ✨ Key Engineering Features

* 🔐 **Authentication & Role-Based Access Control (RBAC):**
  * Public registration segregates applicants into **Customer** (`customer`) and **MSWIL Employee** (`admin` — restricted to verified Motherson domains/units) roles.
  * New accounts default to `is_approved = False` and remain locked until verified by an administrator.
  * Stateless session management using signed JSON Web Tokens (`PyJWT`) and adaptive salted password hashing (`bcrypt`).
* 🛒 **Smart B2B Purchase Order Builder:**
  * Search-as-you-type component lookup by Item Code or Product Name with automatic unit price resolution.
  * Real-time order valuation and saved GSTIN/address toggling.
  * **Non-Blocking Backorder Capture:** Unlike retail carts that block checkout when demand exceeds stock, B2B requests exceeding warehouse quantity are recorded with a `Backordered` status for administrative resolution.
* ⚙️ **3-Stage Order Fulfilment & Atomic Stock Deduction:**
  * Orders progress strictly through `Backordered` $\rightarrow$ `Approved` $\rightarrow$ `Invoiced`.
  * Interactive **Deficit Resolution Modal** compares requested line quantities against live warehouse stock (`inventory_items.quantity`), blocking premature approval until deficits are restocked.
  * Stock deductions, status updates, and audit log insertions execute inside a single **ACID database transaction**.
* 📄 **Self-Healing PDF Document Engine:**
  * Programmatic server-side generation of themed **Purchase Orders** (Emerald) and **GST Tax Invoices** with 18% IGST breakdowns (Indigo) using **ReportLab Platypus**.
  * Includes an on-demand fallback generator that dynamically reconstructs missing PDFs from database records if container storage is wiped on restart.
* 📊 **Executive & Client Analytics:**
  * Admin dashboard tracks YTD/MTD invoiced revenue, pending invoice pipelines, backordered values, low-stock warnings (`< 10` units), 6-month trailing revenue trends, order status distributions, and Top 5 fast-moving items.
  * Customer dashboard displays pipeline order values, backorder metrics, and a Top Purchased Items breakdown.
* 🕵️ **Immutable Administrative Audit Trail & Deep-Linked Alerts:**
  * Every administrative `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REVOKE`, and `INVOICE` action is logged in `admin_activity_logs` with admin snapshots (`admin_name`, `admin_email`) and exact before/after JSON deltas (`{"price": {"old": 100, "new": 120}}`).
  * In-app notification center with unread counters, deep-link routing to specific orders/users, and asynchronous background SMTP email alerts via FastAPI `BackgroundTasks`.

---

## 🛠️ Technology Stack

| Tier | Technologies | Primary Responsibility |
| :--- | :--- | :--- |
| 🎨 **Frontend UI** | Next.js (App Router), React, TypeScript, Tailwind CSS, Headless UI, Heroicons | Role-aware dashboards, composite search & filter bars, modals, pagination, and state management. |
| 📈 **Visualization** | Recharts | Responsive line, bar, and donut charts with dynamic currency formatting. |
| ⚡ **Backend API** | Python 3, FastAPI, Uvicorn (ASGI), Pydantic v2 | RESTful endpoints, declarative request validation, RBAC dependencies, and background tasks. |
| 🗄️ **Database & ORM** | PostgreSQL (Neon Serverless), SQLAlchemy 2.0, `psycopg2-binary` | Normalized 8-table relational persistence, foreign key cascades, and `pool_pre_ping` connection recovery. |
| 🔒 **Security & PDF** | `PyJWT`, `bcrypt` / `passlib`, ReportLab | Stateless JWT issuance, salted password hashing, and dynamic PDF document compilation. |
| ☁️ **Cloud & CI/CD** | Vercel (Frontend), Render (Backend), Neon (Database) | Git-triggered deployments over enforced TLS (`sslmode=require`). |

---

## 🗂️ Relational Database Schema

The PostgreSQL database is structured across **8 normalized tables** defined in `backend/models.py`:

```text
users (id, username, email, password_hash, first_name, last_name, role, designation, is_approved, email_notifications)
 ├── (1:1) ── customer_profiles (id, user_id, organization_name, gst_number, billing_address, shipping_address, contact_phone)
 ├── (1:1) ── employee_profiles (id, user_id, employee_id_number, department)
 ├── (1:N) ── purchase_orders (id, customer_id, total_amount, status, shipping_address, billing_address, gst_number, created_at, invoiced_by_id [SET NULL])
 │             └── (1:N) ── purchase_order_items (id, po_id [CASCADE], item_code, ordered_quantity, unit_price)
 │                           └── (N:1) ── inventory_items (item_code, item_name, serial_number, quantity, price, description)
 ├── (1:N) ── notifications (id, recipient_id [CASCADE], title, message, is_read, target_tab, created_at)
 └── (1:N) ── admin_activity_logs (id, timestamp, admin_id [SET NULL], admin_name, admin_email, action_type, entity_type, entity_id, changes [JSON])
```

* **Historical Price & Address Snapshots:** `purchase_order_items.unit_price` and `purchase_orders` address/GST fields snapshot values at order creation so subsequent catalog price edits never alter historical invoices.
* **Audit Persistence:** `admin_activity_logs.admin_id` and `purchase_orders.invoiced_by_id` enforce `ON DELETE SET NULL` alongside text snapshots so audit records remain intact even if a user account is deleted.

---

## 💻 Local Development Setup

### Prerequisites
* **Node.js** (v18+ LTS) & `npm`
* **Python** (v3.10+) & `pip`
* **PostgreSQL** (Local instance or Neon Cloud connection string)

### 1. Clone the Repository
```bash
git clone https://github.com/ParthUppal523/mswil-inventory.git
cd mswil-inventory
```

### 2. Backend Configuration (`backend/`)
```bash
cd backend
python -m venv venv

# Activate virtual environment (Windows):
venv\Scripts\activate
# Activate virtual environment (macOS/Linux):
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:
```env
DATABASE_URL="postgresql+psycopg2://<username>:<password>@<host>:5432/<dbname>?sslmode=require"
JWT_SECRET_KEY="your_super_secret_jwt_signing_key"
FRONTEND_URL="http://localhost:3000"
```

Start the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```
*Interactive Swagger API documentation will be available at `http://localhost:8000/docs`.*

### 3. Frontend Configuration (`frontend/`)
Open a new terminal in the `frontend/` directory:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 👨‍💻 Author

**Parth Uppal**  
* **Degree:** B.E. in Information Technology (Batch 2024–2028), University Institute of Engineering and Technology (UIET), Panjab University, Chandigarh
* **GitHub:** [@ParthUppal523](https://github.com/ParthUppal523)
