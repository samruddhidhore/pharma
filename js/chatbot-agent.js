/**
 * CUREPOINT AI CHATBOT AGENT - PROMPT ENGINEERING & ENGINE
 * Decoupled AI Agent logic with System Prompts, Context Injection & Guardrails.
 */

// 1. SYSTEM PROMPT DEFINITION
const CUREPOINT_SYSTEM_PROMPT = `
You are "CurePoint Store AI", an intelligent virtual assistant dedicated EXCLUSIVELY to CurePoint Pharmacy Store.

SYSTEM INSTRUCTIONS & BEHAVIOR RULES:
1. ROLE & IDENTITY:
   - Name: CurePoint Store AI Assistant.
   - Primary Purpose: Assist store owners, pharmacists, and admins with live inventory stock, batch expiry dates, rack locations, seasonal demand forecasts, and patient refill reminders.
   - Tone: Professional, courteous, helpful, and direct (in English or Hinglish).

2. KNOWLEDGE & BOUNDARIES (STRICT GUARDRAILS):
   - You ONLY answer questions regarding CurePoint Pharmacy Store's inventory, medicines, expiry alerts, rack locations, reorders, sales, and patient refill schedules.
   - If a user asks ANY question outside of CurePoint Pharmacy Store (e.g. politics, cricket, movies, general knowledge, coding, weather in Paris, general medical diagnosis), you MUST IMMEDIATELY REJECT IT with the standard refusal message:
     "🔒 Main sirf CurePoint Pharmacy Store ke stock, expiry, rack location, reorders, seasonal demand, aur patient refills ke sawalo ka jawab de sakta hu."

3. CONTEXT INTEGRATION:
   - Always reference the real-time store database context passed to you.
   - Provide exact rack locations, batch numbers, MRPs, and expiry dates whenever asked about a medicine.
   - Highlight FEFO (First-Expired, First-Out) priority and 40% clearance discount recommendations for near-expiry items.
`;

// 2. CHATBOT AGENT CLASS
class CurePointAIAgent {
    constructor() {
        this.systemPrompt = CUREPOINT_SYSTEM_PROMPT;
    }

    /**
     * Main prompt processor: Takes user query, injects live store context,
     * parses intent, applies guardrails, and returns structured answer.
     */
    processQuery(userQuery, storeContext) {
        const queryLower = userQuery.toLowerCase().trim();

        // Step 1: Intent Recognition & Guardrail Check
        const intent = this.detectIntent(queryLower);

        if (intent === "UNRELATED") {
            return {
                reply: `🔒 <i>Main sirf CurePoint Pharmacy Store ke stock, expiry, rack location, reorders, seasonal demand, aur patient refills ke sawalo ka jawab de sakta hu.</i>`,
                type: "guardrail_blocked"
            };
        }

        // Step 2: Context Retrieval & RAG Answer Generation
        const reply = this.generateRAGResponse(intent, queryLower, storeContext);
        return {
            reply: reply,
            type: "success",
            intentDetected: intent
        };
    }

    /**
     * Detects user intent based on keyword patterns & NLP classification
     */
    detectIntent(query) {
        const expiryKeywords = ["expire", "expiry", "khatam", "date", "scrap", "clearance", "loss"];
        const rackKeywords = ["rack", "shelf", "kahan", "where", "location", "rakha"];
        const stockKeywords = ["stock", "kitna", "quantity", "count", "available", "strip", "box"];
        const demandKeywords = ["dengue", "season", "monsoon", "winter", "demand", "predict", "outbreak", "barish"];
        const customerKeywords = ["customer", "patient", "refill", "ramesh", "suresh", "vikram", "phone", "whatsapp"];
        const medicineNames = ["dolo", "augmentin", "azithral", "telma", "glycomet", "pantocid", "shelcal", "montair", "combiflam", "electral"];

        const isStoreRelated = expiryKeywords.some(k => query.includes(k)) ||
                               rackKeywords.some(k => query.includes(k)) ||
                               stockKeywords.some(k => query.includes(k)) ||
                               demandKeywords.some(k => query.includes(k)) ||
                               customerKeywords.some(k => query.includes(k)) ||
                               medicineNames.some(m => query.includes(m)) ||
                               query.includes("reorder") || query.includes("order") || query.includes("curepoint");

        if (!isStoreRelated) {
            return "UNRELATED";
        }

        if (expiryKeywords.some(k => query.includes(k))) return "EXPIRY_QUERY";
        if (rackKeywords.some(k => query.includes(k))) return "RACK_LOCATION_QUERY";
        if (demandKeywords.some(k => query.includes(k))) return "SEASONAL_DEMAND_QUERY";
        if (customerKeywords.some(k => query.includes(k))) return "PATIENT_REFILL_QUERY";
        if (stockKeywords.some(k => query.includes(k))) return "STOCK_QUERY";

        return "GENERAL_STORE_QUERY";
    }

    /**
     * Generates structured response using injected store context
     */
    generateRAGResponse(intent, query, context) {
        const inventory = context.inventory || [];
        const customers = context.customers || [];

        switch (intent) {
            case "EXPIRY_QUERY": {
                const nearExpiry = inventory.filter(i => i.status === "CRITICAL" || i.status === "EXPIRED" || i.status === "WARNING");
                if (nearExpiry.length === 0) {
                    return "✅ Sabhi medicines safe state me hain (>90 days expiry). Koi critical alert nahi hai.";
                }
                let itemsList = nearExpiry.map(i => `• <b>${i.brandName}</b> (Batch: <code>${i.batchNo}</code>)<br>&nbsp;&nbsp;📍 Location: ${i.rackLocation} | Expiry: <b>${i.expiryDate}</b> (${i.stockQty} Units)`).join("<br>");
                return `🚨 <b>CurePoint Near-Expiry & Risk Report:</b><br><br>${itemsList}<br><br>👉 <i>Recommendation:</i> Expiry Alert Desk se <b>40% Clearance Discount</b> apply karein ya Distributor return debit note generate karein.`;
            }

            case "RACK_LOCATION_QUERY":
            case "STOCK_QUERY": {
                const matched = inventory.find(i => query.includes(i.brandName.toLowerCase().split(" ")[0]) || query.includes(i.saltName.toLowerCase().split(" ")[0]));
                if (matched) {
                    return `💊 <b>${matched.brandName} Details:</b><br>` +
                           `• <b>Generic Salt:</b> ${matched.saltName}<br>` +
                           `• <b>Current Stock:</b> <b>${matched.stockQty} Units</b> (${matched.stockQty <= matched.minSafeQty ? '<span class="text-warning">Low Stock</span>' : 'Sufficient'})<br>` +
                           `• <b>Rack & Shelf Location:</b> <code>${matched.rackLocation}</code><br>` +
                           `• <b>MRP:</b> ₹${matched.mrp.toFixed(2)} | <b>Batch:</b> ${matched.batchNo}<br>` +
                           `• <b>Expiry Date:</b> ${matched.expiryDate} (${matched.status})`;
                }

                // If specific medicine not mentioned, give general stock overview
                const lowStock = inventory.filter(i => i.stockQty <= i.minSafeQty);
                let lowList = lowStock.map(i => `• <b>${i.brandName}</b>: Current ${i.stockQty} (Min Safe Limit: ${i.minSafeQty}) - Rack: ${i.rackLocation}`).join("<br>");
                return `📦 <b>CurePoint Store Stock Overview:</b><br><br><b>Low Stock Items:</b><br>${lowList}`;
            }

            case "SEASONAL_DEMAND_QUERY": {
                return `🌧️ <b>Monsoon / Dengue & Fever AI Forecast:</b><br><br>` +
                       `Dengue & Viral Outbreak prediction ke aadhar par in dawaiyon ki requirement +45% badhegi:<br>` +
                       `1. <b>Dolo 650 / Paracetamol 650mg</b> (Current: 450 units, Suggested Reorder: +200 units)<br>` +
                       `2. <b>Electral ORS Sachets</b> (Suggested Reorder: +300 sachets)<br>` +
                       `3. <b>Augmentin 625 Duo Antibiotic</b> (Current: 180 units, Suggested Reorder: +50 units)<br>` +
                       `4. <b>IV Fluids & Platelet Support Supplements</b>`;
            }

            case "PATIENT_REFILL_QUERY": {
                let custInfo = customers.map(c => `• <b>${c.name}</b> (${c.phone})<br>&nbsp;&nbsp;Condition: ${c.condition} | Medicine: ${c.medicines}<br>&nbsp;&nbsp;Next Refill Due: <b class="${c.status === 'OVERDUE' ? 'text-danger' : 'text-warning'}">${c.nextRefill} (${c.status})</b>`).join("<br><br>");
                return `👥 <b>Chronic Patient Refill Directory:</b><br><br>${custInfo}<br><br>👉 <i>Action:</i> Patient Refills tab se 1-click WhatsApp reminder bhejein.`;
            }

            default: {
                return `👋 Hello Admin! Main CurePoint Pharmacy Assistant hu.<br>` +
                       `Main aapki live stock count, rack shelf location, near-expiry alerts, seasonal demand prediction, aur patient refills me madad kar sakta hu.`;
            }
        }
    }
}

// Global Agent Instance
const curePointAIAgent = new CurePointAIAgent();
