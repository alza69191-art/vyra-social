import json
import os
import urllib.error
import urllib.request

TIMEOUT = 90

# Providers are attempted in order. Each key remains on the server in Render.
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HF_URL = "https://router.huggingface.co/v1/chat/completions"


def _messages(system_prompt: str, prompt: str, history: list[dict] | None) -> list[dict]:
    result = [{"role": "system", "content": system_prompt}]
    for item in (history or [])[-12:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant") and isinstance(item.get("content"), str):
            result.append({"role": item["role"], "content": item["content"][:6000]})
    result.append({"role": "user", "content": prompt[:12000]})
    return result


def _request(url: str, token: str, model: str, messages: list[dict], provider: str) -> str:
    payload = {"model": model, "messages": messages, "temperature": 0.6, "max_tokens": 2048}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.getenv("VYRA_PUBLIC_URL", "https://vyra-web-rs1b.onrender.com")
        headers["X-Title"] = "VYRA AI"
    request = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read(800).decode("utf-8", errors="replace")
        # Do not expose provider responses or secrets to end users.
        raise RuntimeError(f"{provider} returned HTTP {exc.code}: {raw[:180]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{provider} network error: {str(exc.reason)[:120]}") from exc
    choices = data.get("choices") or []
    content = (choices[0].get("message") or {}).get("content") if choices else None
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError(f"{provider} returned an empty response")
    return content.strip()


def _providers(role: str):
    groq_key = os.getenv(f"GROQ_{role.upper()}_API_KEY", "").strip() or os.getenv("GROQ_API_KEY", "").strip()
    openrouter_key = os.getenv(f"OPENROUTER_{role.upper()}_API_KEY", "").strip() or os.getenv("OPENROUTER_API_KEY", "").strip()
    hf_key = os.getenv("HF_ASSISTANT_TOKEN" if role == "assistant" else "HF_AGENT_TOKEN", "").strip()
    if groq_key:
        yield "groq", GROQ_URL, groq_key, os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    if openrouter_key:
        yield "openrouter", OPENROUTER_URL, openrouter_key, os.getenv("OPENROUTER_MODEL", "openrouter/free")
    if hf_key:
        default = "Qwen/Qwen3-4B-Instruct-2507:fastest" if role == "assistant" else "Qwen/Qwen3-30B-A3B:fastest"
        model_var = "HF_ASSISTANT_MODEL" if role == "assistant" else "HF_AGENT_MODEL"
        yield "huggingface", HF_URL, hf_key, os.getenv(model_var, default)


def _run(role: str, system_prompt: str, prompt: str, history: list[dict] | None) -> dict:
    messages = _messages(system_prompt, prompt, history)
    errors = []
    providers = list(_providers(role))
    if not providers:
        raise RuntimeError("أضف GROQ_API_KEY أو OPENROUTER_API_KEY في Render لتشغيل مساعد VYRA.")
    for name, url, key, model in providers:
        try:
            reply = _request(url, key, model, messages, name)
            return {"reply": reply, "provider": name, "role": role}
        except RuntimeError as exc:
            errors.append(str(exc))
            # Try the next configured provider on quota, network, or service errors.
            continue
    raise RuntimeError("تعذر الحصول على رد من مزودي الذكاء الاصطناعي المتاحين. " + " | ".join(errors[:3]))


def generate_reply(prompt: str, history: list[dict] | None = None) -> dict:
    return _run(
        "assistant",
        "أنت مساعد VYRA الذكي. أجب بلغة المستخدم وباختصار ودقة، واشرح المعلومات وقدّم اقتراحات عملية. "
        "لا تدّع تنفيذ أي إجراء داخل المنصة، ولا تطلب كلمات مرور أو مفاتيح سرية.",
        prompt,
        history,
    )


def generate_agent_reply(prompt: str, history: list[dict] | None = None) -> dict:
    return _run(
        "agent",
        "أنت وكيل VYRA الذكي. حلّل هدف المستخدم وقسّم العمل إلى خطوات عملية، وحدّد المتطلبات والمخاطر. "
        "لا تدّع أنك نفذت تغييرات أو اتصلت بخدمات أو استخدمت أدوات غير متاحة. اطلب تأكيد المستخدم قبل أي إجراء خارجي مؤثر. "
        "أجب بلغة المستخدم وكن دقيقاً.",
        prompt,
        history,
    )
