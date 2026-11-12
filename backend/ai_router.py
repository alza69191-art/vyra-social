import json
import os
import urllib.error
import urllib.request

TIMEOUT = 90
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
HF_URL = "https://router.huggingface.co/v1/chat/completions"
CODIV_URL = "https://api.codiv.ai/v1/chat/completions"


def _messages(system_prompt: str, prompt: str, history: list[dict] | None, image_data: str | None = None) -> list[dict]:
    result = [{"role": "system", "content": system_prompt}]
    for item in (history or [])[-12:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant") and isinstance(item.get("content"), str):
            result.append({"role": item["role"], "content": item["content"][:6000]})
    content = [{"type": "text", "text": prompt[:12000]}]
    if image_data:
        if not image_data.startswith("data:image/") or len(image_data) > 10_500_000:
            raise RuntimeError("صيغة الصورة غير مدعومة أو حجمها أكبر من الحد المسموح.")
        content.append({"type": "image_url", "image_url": {"url": image_data}})
    result.append({"role": "user", "content": content if image_data else prompt[:12000]})
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
        raise RuntimeError(f"{provider} returned HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{provider} network error: {str(exc.reason)[:120]}") from exc
    choices = data.get("choices") or []
    content = (choices[0].get("message") or {}).get("content") if choices else None
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError(f"{provider} returned an empty response")
    return content.strip()


def _providers():
    providers = []
    codiv_key = os.getenv("CODIV_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_ASSISTANT_API_KEY", "").strip() or os.getenv("GROQ_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_ASSISTANT_API_KEY", "").strip() or os.getenv("OPENROUTER_API_KEY", "").strip()
    hf_key = os.getenv("HF_ASSISTANT_TOKEN", "").strip()
    if codiv_key:
        providers.append(("codiv", CODIV_URL, codiv_key, os.getenv("CODIV_MODEL", "diffusiongemma-26b")))
    if groq_key:
        providers.append(("groq", GROQ_URL, groq_key, os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")))
    if openrouter_key:
        providers.append(("openrouter", OPENROUTER_URL, openrouter_key, os.getenv("OPENROUTER_MODEL", "openrouter/free")))
    if hf_key:
        providers.append(("huggingface", HF_URL, hf_key, os.getenv("HF_ASSISTANT_MODEL", "Qwen/Qwen3-4B-Instruct-2507:fastest")))
    return providers


def generate_reply(prompt: str, history: list[dict] | None = None, image_data: str | None = None) -> dict:
    messages = _messages(
        "أنت مساعد VYRA الذكي. أجب بلغة المستخدم وباختصار ودقة، واشرح المعلومات وقدّم اقتراحات عملية. لا تدّع تنفيذ أي إجراء داخل المنصة، ولا تطلب كلمات مرور أو مفاتيح سرية.",
        prompt,
        history,
        image_data,
    )
    providers = _providers()
    if not providers:
        raise RuntimeError("أضف مفتاح مزود ذكاء اصطناعي في Render لتشغيل مساعد VYRA.")
    if image_data:
        vision_model = os.getenv("VYRA_VISION_MODEL", "").strip()
        if not vision_model:
            raise RuntimeError("تحليل الصور يحتاج ضبط VYRA_VISION_MODEL لموديل يدعم الرؤية في Render.")
        providers = [(name, url, key, vision_model) for name, url, key, _model in providers]
    errors = []
    for name, url, key, model in providers:
        try:
            return {"reply": _request(url, key, model, messages, name), "provider": name, "role": "assistant"}
        except RuntimeError as exc:
            errors.append(str(exc))
    raise RuntimeError("تعذر الحصول على رد من مزودي الذكاء الاصطناعي المتاحين. " + " | ".join(errors[:3]))
