/**
 * CUREPOINT CHATBOT UI COMPONENT & INTERACTION MODULE
 * Dynamically mounts the AI Chatbot widget DOM into the application.
 */

class CurePointChatbotUI {
    constructor() {
        this.isOpen = false;
        this.initDOM();
    }

    /**
     * Programmatically injects Chatbot HTML structure into page
     */
    initDOM() {
        if (document.getElementById("chatbot-widget-container")) return;

        const widgetContainer = document.createElement("div");
        widgetContainer.id = "chatbot-widget-container";
        widgetContainer.className = "chatbot-widget-container";

        widgetContainer.innerHTML = `
            <!-- Floating Trigger Button -->
            <button class="chatbot-trigger-btn" id="chatbot-toggle-btn">
                <i class="fa-solid fa-robot"></i>
                <span>CurePoint AI Assistant</span>
                <span class="chat-online-dot"></span>
            </button>

            <!-- Chat Window Box -->
            <div class="chatbot-window hidden" id="chatbot-window-box">
                <div class="chatbot-header">
                    <div class="bot-info">
                        <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
                        <div>
                            <h4>CurePoint Store AI</h4>
                            <span class="text-xs text-success"><i class="fa-solid fa-circle"></i> Exclusive Store Assistant</span>
                        </div>
                    </div>
                    <button class="chatbot-close-btn" id="chatbot-close-x">&times;</button>
                </div>

                <div class="chatbot-messages" id="chatbot-messages-list">
                    <div class="chat-msg bot-msg">
                        <div class="msg-content">
                            Namaste Admin! Main CurePoint Store ka AI Assistant hu. Aap mijhse stock, near-expiry dawai, rack shelf location, ya seasonal demand ke baare me pooch sakte hain.
                        </div>
                    </div>
                </div>

                <div class="chatbot-quick-chips">
                    <button class="chip" data-query="Konsi dawai expire hone wali hai?">🚨 Near Expiry Dawai</button>
                    <button class="chip" data-query="Dolo 650 kis rack me hai?">📍 Dolo 650 Rack</button>
                    <button class="chip" data-query="Dengue season ke liye kya stock karu?">🌧️ Dengue Demand</button>
                </div>

                <div class="chatbot-input-bar">
                    <input type="text" id="chatbot-user-input" placeholder="Ask about CurePoint stock, expiry, rack..." />
                    <button class="chat-send-btn" id="chatbot-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        document.body.appendChild(widgetContainer);
        this.bindEvents();
    }

    bindEvents() {
        const toggleBtn = document.getElementById("chatbot-toggle-btn");
        const closeX = document.getElementById("chatbot-close-x");
        const sendBtn = document.getElementById("chatbot-send-btn");
        const inputEl = document.getElementById("chatbot-user-input");

        toggleBtn.addEventListener("click", () => this.toggle());
        closeX.addEventListener("click", () => this.toggle());

        sendBtn.addEventListener("click", () => this.handleUserSend());
        inputEl.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.handleUserSend();
        });

        // Quick chip clicks
        document.querySelectorAll(".chatbot-quick-chips .chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const query = chip.getAttribute("data-query");
                if (query) {
                    inputEl.value = query;
                    this.handleUserSend();
                }
            });
        });
    }

    toggle() {
        const windowBox = document.getElementById("chatbot-window-box");
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            windowBox.classList.remove("hidden");
            document.getElementById("chatbot-user-input").focus();
        } else {
            windowBox.classList.add("hidden");
        }
    }

    handleUserSend() {
        const inputEl = document.getElementById("chatbot-user-input");
        const userQuery = inputEl.value.trim();
        if (!userQuery) return;

        const messagesList = document.getElementById("chatbot-messages-list");

        // Render User Message Bubble
        const userMsgDiv = document.createElement("div");
        userMsgDiv.className = "chat-msg user-msg";
        userMsgDiv.innerHTML = `<div class="msg-content">${this.escapeHTML(userQuery)}</div>`;
        messagesList.appendChild(userMsgDiv);

        inputEl.value = "";
        messagesList.scrollTop = messagesList.scrollHeight;

        // Render AI Agent Response using curePointAIAgent engine
        const storeContext = {
            inventory: typeof inventoryData !== "undefined" ? inventoryData : [],
            customers: typeof mockCustomers !== "undefined" ? mockCustomers : []
        };

        // Simulated typing delay
        setTimeout(() => {
            const agentResult = curePointAIAgent.processQuery(userQuery, storeContext);
            const botMsgDiv = document.createElement("div");
            botMsgDiv.className = "chat-msg bot-msg";
            botMsgDiv.innerHTML = `<div class="msg-content">${agentResult.reply}</div>`;
            messagesList.appendChild(botMsgDiv);
            messagesList.scrollTop = messagesList.scrollHeight;
        }, 500);
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
}

// Mount Chatbot UI Component when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    window.curePointChatbotUI = new CurePointChatbotUI();
});

function toggleChatbot() {
    if (window.curePointChatbotUI) {
        window.curePointChatbotUI.toggle();
    }
}
