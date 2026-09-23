import sqlite3
import json
import os
import sys

# Force UTF-8 stdout if possible on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = "curepoint_pharmacy.db"
SQL_SCRIPT_PATH = "database_schema_and_data.sql"
JSON_EXPORT_PATH = "database_export.json"

def init_db(db_path=DB_PATH, sql_path=SQL_SCRIPT_PATH):
    """
    Creates tables and seeds initial static data into the SQLite database.
    """
    print(f"[DB] Initializing SQLite Database: {db_path}...")
    
    if not os.path.exists(sql_path):
        print(f"[ERROR] SQL file '{sql_path}' not found!")
        return False
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_script = f.read()
        
    cursor.executescript(sql_script)
    conn.commit()
    conn.close()
    
    print("[SUCCESS] Database successfully created and seeded!")
    return True

def query_stats(db_path=DB_PATH):
    """
    Prints summary statistics of all tables in the database.
    """
    if not os.path.exists(db_path):
        print("[WARNING] Database does not exist yet. Run init_db() first.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    tables = ["medicines", "customers", "invoices", "invoice_items", "prescriptions", "prescription_items"]
    print("\n--- CurePoint Pharmacy Database Overview ---")
    for tbl in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
        count = cursor.fetchone()[0]
        print(f"  • Table '{tbl}': {count} records")
        
    conn.close()

def export_db_to_json(db_path=DB_PATH, json_path=JSON_EXPORT_PATH):
    """
    Exports the current database state back to a clean JSON file.
    """
    if not os.path.exists(db_path):
        print("[WARNING] Database does not exist.")
        return
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Medicines
    cursor.execute("SELECT * FROM medicines")
    meds = [dict(row) for row in cursor.fetchall()]
    
    # Customers
    cursor.execute("SELECT * FROM customers")
    custs = [dict(row) for row in cursor.fetchall()]
    
    # Invoices & items
    cursor.execute("SELECT * FROM invoices")
    invs = [dict(row) for row in cursor.fetchall()]
    for inv in invs:
        cursor.execute("SELECT brand_name as brandName, batch_no as batchNo, qty, unit_price as unitPrice FROM invoice_items WHERE invoice_no=?", (inv["invoice_no"],))
        inv["items"] = [dict(row) for row in cursor.fetchall()]
        
    # Prescriptions
    cursor.execute("SELECT * FROM prescriptions")
    prescs_rows = cursor.fetchall()
    prescs = {}
    for pr in prescs_rows:
        pr_dict = dict(pr)
        sample_key = pr_dict["sample_key"]
        cursor.execute("SELECT name, dosage, matched_salt as matchedSalt, stock, status FROM prescription_items WHERE sample_key=?", (sample_key,))
        pr_dict["medicines"] = [dict(row) for row in cursor.fetchall()]
        prescs[sample_key] = pr_dict

    db_export = {
        "medicines": meds,
        "customers": custs,
        "invoices": invs,
        "prescriptions": prescs
    }
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(db_export, f, indent=2)
        
    print(f"[SUCCESS] Exported database to '{json_path}'")
    conn.close()

if __name__ == "__main__":
    init_db()
    query_stats()
