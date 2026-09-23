-- =========================================================
-- CUREPOINT PHARMACY DATABASE SCHEMA AND STATIC DATA DUMP
-- Compatible with SQLite, PostgreSQL, and MySQL
-- =========================================================

DROP TABLE IF EXISTS prescription_items;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS medicines;

-- 1. MEDICINES TABLE
CREATE TABLE medicines (
    id INTEGER PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    salt_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    manufacturer VARCHAR(255),
    batch_no VARCHAR(100) NOT NULL,
    rack_location VARCHAR(100),
    mfg_date DATE,
    expiry_date DATE,
    stock_qty INTEGER DEFAULT 0,
    min_safe_qty INTEGER DEFAULT 0,
    purchase_price DECIMAL(10, 2),
    mrp DECIMAL(10, 2),
    ai_predicted_demand INTEGER,
    supplier VARCHAR(255),
    barcode VARCHAR(100),
    status VARCHAR(50)
);

-- 2. CUSTOMERS TABLE
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    condition TEXT,
    medicines TEXT,
    last_purchase DATE,
    next_refill DATE,
    status VARCHAR(50)
);

-- 3. INVOICES TABLE
CREATE TABLE invoices (
    invoice_no VARCHAR(100) PRIMARY KEY,
    date VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    payment_mode VARCHAR(50),
    total_amount DECIMAL(10, 2),
    items_count INTEGER,
    status VARCHAR(50)
);

-- 4. INVOICE ITEMS TABLE
CREATE TABLE invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no VARCHAR(100) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    batch_no VARCHAR(100),
    qty INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2),
    FOREIGN KEY (invoice_no) REFERENCES invoices(invoice_no) ON DELETE CASCADE
);

-- 5. PRESCRIPTIONS TABLE
CREATE TABLE prescriptions (
    sample_key VARCHAR(50) PRIMARY KEY,
    doctor VARCHAR(255),
    patient VARCHAR(255),
    confidence VARCHAR(20),
    img_url TEXT
);

-- 6. PRESCRIPTION ITEMS TABLE
CREATE TABLE prescription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_key VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    dosage TEXT,
    matched_salt VARCHAR(255),
    stock VARCHAR(100),
    status VARCHAR(50),
    FOREIGN KEY (sample_key) REFERENCES prescriptions(sample_key) ON DELETE CASCADE
);

-- =========================================================
-- INSERT STATIC DATA SETS
-- =========================================================

-- INSERT MEDICINES
INSERT INTO medicines (id, brand_name, salt_name, category, manufacturer, batch_no, rack_location, mfg_date, expiry_date, stock_qty, min_safe_qty, purchase_price, mrp, ai_predicted_demand, supplier, barcode, status) VALUES
(101, 'Dolo 650 Tablet', 'Paracetamol (650mg)', 'Analgesics', 'Micro Labs Ltd', 'DL-2024-99', 'Rack A-1, Shelf 2', '2024-01-10', '2027-01-15', 450, 100, 22.00, 30.91, 600, 'Apollo Pharma Wholesalers', '8901086001234', 'SAFE'),
(102, 'Augmentin 625 Duo Tablet', 'Amoxicillin (500mg) + Clavulanic Acid (125mg)', 'Antibiotics', 'GlaxoSmithKline Pharma', 'AUG-2024-88', 'Rack A-2, Shelf 1', '2024-03-10', '2026-10-15', 180, 50, 142.50, 201.70, 220, 'Apollo Pharma Wholesalers', '8901086005555', 'SAFE'),
(103, 'Azithral 500 Tablet', 'Azithromycin (500mg)', 'Antibiotics', 'Alembic Pharmaceuticals', 'AZ-99120', 'Rack A-3, Shelf 3', '2023-11-01', '2026-10-10', 95, 40, 88.00, 119.50, 140, 'Sun Pharma Distributors', '8901123456789', 'CRITICAL'),
(104, 'Telma 40 Tablet', 'Telmisartan (40mg)', 'Cardiology', 'Glenmark Pharmaceuticals', 'TL-55102', 'Rack B-1, Shelf 1', '2023-09-10', '2026-10-05', 150, 60, 72.00, 108.00, 180, 'Sun Pharma Distributors', '8902233445566', 'CRITICAL'),
(105, 'Glycomet GP 2 Tablet', 'Metformin (500mg) + Glimepiride (2mg)', 'Diabetic', 'USV Private Limited', 'GLY-30411', 'Rack B-3, Shelf 4', '2023-12-01', '2026-11-20', 210, 80, 110.00, 158.00, 250, 'Apollo Pharma Wholesalers', '8903344556677', 'WARNING'),
(106, 'Pantocid 40 Tablet', 'Pantoprazole (40mg)', 'Gastroenterology', 'Sun Pharmaceutical Industries', 'PAN-88902', 'Rack C-1, Shelf 2', '2023-08-15', '2026-09-01', 45, 50, 90.00, 145.00, 130, 'Sun Pharma Distributors', '8904455667788', 'EXPIRED'),
(107, 'Shelcal 500 Tablet', 'Calcium (500mg) + Vitamin D3 (250 IU)', 'Vitamins', 'Torrent Pharmaceuticals', 'SH-10294', 'Rack C-4, Shelf 1', '2024-02-01', '2026-12-15', 310, 75, 85.00, 131.00, 300, 'MedPlus Logistics', '8905566778899', 'SAFE'),
(108, 'Montair LC Tablet', 'Montelukast (10mg) + Levocetirizine (5mg)', 'Anti-Allergic', 'Cipla Ltd', 'MNT-44102', 'Rack D-2, Shelf 3', '2023-10-10', '2026-11-05', 18, 60, 140.00, 215.00, 160, 'Apollo Pharma Wholesalers', '8906677889900', 'WARNING');

-- INSERT CUSTOMERS
INSERT INTO customers (id, name, phone, condition, medicines, last_purchase, next_refill, status) VALUES
(1, 'Suresh Kumar Patel', '+91 98230 44123', 'Type 2 Diabetes & Hypertension', 'Glycomet GP2, Telma 40', '2026-08-25', '2026-09-25', 'REFILL_DUE'),
(2, 'Meena Devi Sharma', '+91 94112 88765', 'Osteoporosis & Joint Pain', 'Shelcal 500, Dolo 650', '2026-09-01', '2026-10-01', 'ACTIVE'),
(3, 'Vikramaditya Singh', '+91 97654 32109', 'Chronic Asthma & Allergy', 'Montair LC, Foracort 200', '2026-08-10', '2026-09-10', 'OVERDUE');

-- INSERT INVOICES
INSERT INTO invoices (invoice_no, date, customer_name, customer_phone, payment_mode, total_amount, items_count, status) VALUES
('INV-2026-0891', '2026-09-23 16:45', 'Ramesh Pawar', '+91 98765 11223', 'UPI', 512.61, 3, 'COMPLETED'),
('INV-2026-0890', '2026-09-23 15:20', 'Suresh Kumar Patel', '+91 98230 44123', 'CASH', 266.00, 2, 'COMPLETED'),
('INV-2026-0889', '2026-09-23 14:10', 'Meena Devi Sharma', '+91 94112 88765', 'CARD', 434.50, 2, 'COMPLETED'),
('INV-2026-0888', '2026-09-22 18:30', 'Anil Kadam', '+91 98221 55443', 'UPI', 123.64, 1, 'COMPLETED');

-- INSERT INVOICE ITEMS
INSERT INTO invoice_items (invoice_no, brand_name, batch_no, qty, unit_price) VALUES
('INV-2026-0891', 'Augmentin 625 Duo', 'AUG-2024-88', 1, 201.70),
('INV-2026-0891', 'Dolo 650 Tablet', 'DL-2024-99', 2, 30.91),
('INV-2026-0891', 'Shelcal 500 Tablet', 'SH-10294', 1, 131.00),
('INV-2026-0890', 'Telma 40 Tablet', 'TL-55102', 1, 108.00),
('INV-2026-0890', 'Glycomet GP 2 Tablet', 'GLY-30411', 1, 158.00),
('INV-2026-0889', 'Shelcal 500 Tablet', 'SH-10294', 2, 131.00),
('INV-2026-0889', 'Montair LC Tablet', 'MNT-44102', 1, 172.50),
('INV-2026-0888', 'Dolo 650 Tablet', 'DL-2024-99', 4, 30.91);

-- INSERT PRESCRIPTIONS
INSERT INTO prescriptions (sample_key, doctor, patient, confidence, img_url) VALUES
('sample1', 'Dr. A. K. Roy (MD, Internal Medicine)', 'Ramesh Pawar', '95.2%', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'),
('sample2', 'Dr. Sunita Deshmukh (Cardiologist)', 'Suresh Kumar Patel', '98.1%', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80');

-- INSERT PRESCRIPTION ITEMS
INSERT INTO prescription_items (sample_key, name, dosage, matched_salt, stock, status) VALUES
('sample1', 'Augmentin 625 Duo', '1 Tablet Twice Daily (1-0-1) x 5 Days', 'Amoxicillin + Clavulanic Acid', '180 Available', 'In Stock'),
('sample1', 'Dolo 650 Tablet', '1 Tablet when fever > 100°F (SOS)', 'Paracetamol 650mg', '450 Available', 'In Stock'),
('sample1', 'Pantocid 40', '1 Tablet before breakfast (1-0-0)', 'Pantoprazole 40mg', '45 (Expired Batch Alert!)', 'Batch Warning'),
('sample2', 'Telma 40', '1 Tablet Daily Morning', 'Telmisartan 40mg', '150 Available (<30d Expiry FEFO)', 'Near Expiry Alert'),
('sample2', 'Glycomet GP 2', '1 Tablet Twice Daily after meals', 'Metformin + Glimepiride', '210 Available', 'In Stock');
