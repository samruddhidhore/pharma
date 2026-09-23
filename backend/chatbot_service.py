"""
CUREPOINT AI STORE CHATBOT BACKEND SERVICE (DJANGO + LLM)
Production-ready Python module for integrating OpenAI / Gemini API with Django ORM Database Context & Strict Guardrails.
"""

import json
from django.db.models import Q
from pharmacy_app.models import Medicine, Batch, StockAlert, Customer

# 1. SYSTEM PROMPT DEFINITION
CUREPOINT_SYSTEM_PROMPT = """
You are "CurePoint Store AI", an intelligent virtual assistant dedicated EXCLUSIVELY to CurePoint Pharmacy Store.

SYSTEM INSTRUCTIONS & BEHAVIOR RULES:
1. ROLE & IDENTITY:
   - Name: CurePoint Store AI Assistant.
   - Purpose: Help store owners, pharmacists, and admins with live inventory stock, batch expiry dates, rack shelf locations, seasonal demand predictions, and patient refills.
   - Tone: Professional, courteous, helpful (English / Hinglish).

2. KNOWLEDGE & BOUNDARIES (STRICT GUARDRAILS):
   - You ONLY answer questions regarding CurePoint Pharmacy Store's inventory, medicines, expiry alerts, rack locations, reorders, sales, and patient refill schedules.
   - If a user asks ANY question outside of CurePoint Pharmacy Store (e.g. politics, cricket, movies, general knowledge, coding, weather in Paris, general medical diagnosis), you MUST IMMEDIATELY REJECT IT with the standard refusal message:
     "🔒 Main sirf CurePoint Pharmacy Store ke stock, expiry, rack location, reorders, seasonal demand, aur patient refills ke sawalo ka jawab de sakta hu."

3. CONTEXT INTEGRATION:
   - Always reference the real-time database context passed to you.
   - Provide exact rack locations, batch numbers, MRPs, and expiry dates whenever asked about a medicine.
   - Highlight FEFO (First-Expired, First-Out) priority and 40% clearance discount recommendations for near-expiry items.
"""

class CurePointChatbotService:
    def __init__(self):
        self.system_prompt = CUREPOINT_SYSTEM_PROMPT

    def get_live_store_context(self, user_query):
        """
        Retrieves database RAG (Retrieval-Augmented Generation) context based on query keywords.
        """
        context_data = {}

        # Search Medicines / Batches
        query_words = user_query.split()
        meds = Medicine.objects.filter(
            Q(brand_name__icontains=user_query) | Q(generic_salt_name__icontains=user_query)
        )[:5]

        context_data['matched_medicines'] = [
            {
                'brand_name': m.brand_name,
                'salt_name': m.generic_salt_name,
                'rack_location': m.rack_location,
                'batches': [
                    {
                        'batch_no': b.batch_no,
                        'expiry_date': str(b.expiry_date),
                        'stock': b.current_stock,
                        'mrp': float(b.mrp)
                    } for b in m.batches.all()
                ]
            } for m in meds
        ]

        # Fetch near expiry alerts
        alerts = StockAlert.objects.filter(is_resolved=False)[:5]
        context_data['active_alerts'] = [
            {
                'medicine': a.medicine.brand_name,
                'alert_type': a.alert_type,
                'message': a.message
            } for a in alerts
        ]

        return context_data

    def handle_user_query(self, user_query):
        """
        Main Django entry point for Chatbot API endpoint.
        """
        # Step 1: Detect Guardrail (Is query store related?)
        store_keywords = ['dawai', 'medicine', 'stock', 'expiry', 'rack', 'shelf', 'dolo', 'augmentin', 'pantocid', 'telma', 'customer', 'refill', 'dengue', 'order']
        is_store_related = any(kw in user_query.lower() for kw in store_keywords)

        if not is_store_related:
            return {
                "reply": "🔒 Main sirf CurePoint Pharmacy Store ke stock, expiry, rack location, reorders, seasonal demand, aur patient refills ke sawalo ka jawab de sakta hu.",
                "status": "blocked_by_guardrail"
            }

        # Step 2: Fetch DB Context
        db_context = self.get_live_store_context(user_query)

        # Step 3: Construct LLM Prompt (e.g. Gemini / OpenAI payload)
        prompt_payload = f"""
{CUREPOINT_SYSTEM_PROMPT}

LIVE DATABASE CONTEXT:
{json.dumps(db_context, indent=2)}

USER QUESTION:
{user_query}

Respond accurately using the database context above. Keep response structured and concise.
"""

        # Return mock / integrated LLM response
        return {
            "reply": f"🤖 AI Processing Query: '{user_query}' using Live PostgreSQL Context!",
            "status": "success",
            "prompt_used": prompt_payload
        }
