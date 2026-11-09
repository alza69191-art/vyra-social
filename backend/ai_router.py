import json
import os
import urllib.error
import urllib.request

TIMEOUT = 45

def _post_json(url: str, headers: dict, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={**headers, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))

def _openai_compatible(url: str, key: str, model: str, messages: list[dict]) -> str:
    result = _post_json(url, {"Authorization": f"Bearer {key}"}, {"model": model, "messages": messages, "temperature": 0.7})
    return result["choices"][0]["message"]["content"].strip()

def _google(key: str, model: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    result = _post_json(url, {}, {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.7}})
    return result["candidates"][0]["content"]["parts"][0]["text"].strip()

def generate_reply(prompt: str, history: list[dict] | None = None) -> dict:
    messages = [{"role": "system", "content": "أنت مساعد VYRA الذكي. أجب بدقة وباللغة التي يستخدمها المستخدم، وصرّح بوضوح عندما لا تعرف."}]
    for item in (history or [])[-12:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            messages.append({"role": role, "content": content[:6000]})
    messages.append({"role": "user", "content": prompt})
    failures = []

    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        try:
            answer = _openai_compatible("https://api.groq.com/openai/v1/chat/completions", groq_key, os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"), messages)
            if answer: return {"reply": answer, "provider": "groq"}
        except Exception as exc:
            failures.append(f"groq: {type(exc).__name__}")

    google_key = os.getenv("GOOGLE_API_KEY")
    if google_key:
        try:
            answer = _google(google_key, os.getenv("GOOGLE_AI_MODEL", "gemini-2.5-flash"), "\n\n".join(f"{m['role']}: {m['content']}" for m in messages))
            if answer: return {"reply": answer, "provider": "google"}
        except Exception as exc:
            failures.append(f"google: {type(exc).__name__}")

    hf_configured = False
    for index in range(1, 5):
        hf_key = os.getenv(f"HF_TOKEN_{index}") or (os.getenv("HF_TOKEN") if index == 1 else None)
        model = os.getenv(f"HF_MODEL_{index}")
        if not hf_key or not model:
            continue
        hf_configured = True
        try:
            answer = _openai_compatible("https://router.huggingface.co/v1/chat/completions", hf_key, model, messages)
            if answer: return {"reply": answer, "provider": f"huggingface:{model}"}
        except Exception as exc:
            failures.append(f"hf{index}: {type(exc).__name__}")

    if not (groq_key or google_key or hf_configured):
        raise RuntimeError("لم تتم إضافة أي مفاتيح لمزودي الذكاء الاصطناعي في إعدادات الخادم.")
    raise RuntimeError("تعذر الوصول إلى جميع مزودي الذكاء الاصطناعي. تحقق من المفاتيح وأسماء النماذج والحصص. " + ", ".join(failures))
