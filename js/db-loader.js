/**
 * CUREPOINT DYNAMIC DATABASE LOADER MODULE
 * Enables loading/clearing store data dynamically from JSON, Database API, or local storage.
 */

const DBLoader = {
    isLoaded: false,

    /**
     * Loads static/exported database content from JSON into runtime arrays & re-renders UI.
     */
    async loadFromJSON(jsonPath = "database_export.json") {
        try {
            console.log(`[DBLoader] Loading data from ${jsonPath}...`);
            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            this.populateData(data);
            this.isLoaded = true;
            this.showToast("✅ Database data loaded successfully into UI!");
            this.updateDBStatusBadge(true, `JSON DB (${data.medicines ? data.medicines.length : 0} items)`);
            return data;
        } catch (error) {
            console.warn("[DBLoader] Could not fetch JSON file directly (likely local file protocol CORS). Loading fallback dataset...", error);
            if (typeof DEFAULT_EXPORTED_DATA !== "undefined") {
                this.populateData(DEFAULT_EXPORTED_DATA);
                this.isLoaded = true;
                this.showToast("✅ Database loaded from Default Database Export!");
                this.updateDBStatusBadge(true, `Default DB (${DEFAULT_EXPORTED_DATA.medicines.length} items)`);
                return DEFAULT_EXPORTED_DATA;
            } else {
                this.showToast("⚠️ Failed to load database data.", "error");
            }
        }
    },

    /**
     * Populates active UI arrays with provided database payload
     */
    populateData(data) {
        if (data.medicines && typeof inventoryData !== "undefined") {
            inventoryData.length = 0;
            inventoryData.push(...data.medicines);
        }

        if (data.customers && typeof mockCustomers !== "undefined") {
            mockCustomers.length = 0;
            mockCustomers.push(...data.customers);
        }

        if (data.invoices && typeof invoicesHistoryData !== "undefined") {
            invoicesHistoryData.length = 0;
            invoicesHistoryData.push(...data.invoices);
        }

        if (data.prescriptions && typeof mockPrescriptions !== "undefined") {
            Object.keys(mockPrescriptions).forEach(k => delete mockPrescriptions[k]);
            Object.assign(mockPrescriptions, data.prescriptions);
        }

        // Re-render UI views if app.js functions are ready
        this.refreshUIViews();
    },

    /**
     * Clears all memory data from UI tables
     */
    clearUI() {
        if (typeof inventoryData !== "undefined") inventoryData.length = 0;
        if (typeof mockCustomers !== "undefined") mockCustomers.length = 0;
        if (typeof invoicesHistoryData !== "undefined") invoicesHistoryData.length = 0;
        if (typeof mockPrescriptions !== "undefined") {
            Object.keys(mockPrescriptions).forEach(k => delete mockPrescriptions[k]);
        }

        this.isLoaded = false;
        this.refreshUIViews();
        this.showToast("🗑️ UI data cleared! UI is now empty.");
        this.updateDBStatusBadge(false, "Database Empty");
    },

    /**
     * Re-renders all UI components and tables
     */
    refreshUIViews() {
        if (typeof renderOverview === "function") renderOverview();
        if (typeof renderInventory === "function") renderInventory();
        if (typeof renderExpiryAlerts === "function") renderExpiryAlerts();
        if (typeof renderCustomers === "function") renderCustomers();
        if (typeof renderInvoiceHistory === "function") renderInvoiceHistory();
    },

    updateDBStatusBadge(connected, labelText) {
        const badge = document.querySelector(".db-status");
        if (badge) {
            badge.innerHTML = connected 
                ? `<i class="fa-solid fa-database text-success"></i> ${labelText}`
                : `<i class="fa-solid fa-database text-warning"></i> ${labelText}`;
        }
    },

    showToast(msg, type = "success") {
        if (typeof showToast === "function") {
            showToast(msg, type);
        } else {
            console.log(`[Toast] ${msg}`);
        }
    }
};

// Expose globally
window.DBLoader = DBLoader;
