import json
import os
import urllib.error
import urllib.request

TIMEOUT = 60
HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-oss-120b:fastest"


def _huggingface_chat(token: str, model: str, messages: list[dict]) -> str:
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    }
    request = urllib.request.Request(
        HF_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read(1200).decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
            detail = parsed.get("error", {}).get("message") or parsed.get("error") or parsed.get("message") or raw
        except (ValueError, AttributeError):
            detail = raw
        raise RuntimeError(f"HTTP {exc.code}: {str(detail)[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {str(exc.reason)[:200]}") from exc

    choices = result.get("choices") or []
    if not choices:
        raise RuntimeError("Hugging Face returned no completion choices")
    message = choices[0].get("message") or {}
    answer = message.get("content")
    if isinstance(answer, list):
        answer = "".join(
            part.get("text", "") for part in answer if isinstance(part, dict)
        )
    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError("Hugging Face returned an empty response")
    return answer.strip()


def generate_reply(prompt: str, history: list[dict] | None = None) -> dict:
    messages = [{
        "role": "system",
        "content": "أنت مساعد VYRA الذكي. أجب بدقة وباللغة التي يستخدمها المستخدم، وصرّح بوضوح عندما لا تعرف."
    }]
    for item in (history or [])[-12:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            messages.append({"role": role, "content": content[:6000]})
    messages.append({"role": "user", "content": prompt})

    failures = []
    configured = []
    for index in range(1, 5):
        token = (
            os.getenv(f"HF_TOKEN_{index}")
            or os.getenv(f"HUGGINGFACE_API_TOKEN_{index}")
            or os.getenv(f"HF_API_KEY_{index}")
        )
        if token and token not in [entry[1] for entry in configured]:
            model = os.getenv(f"HF_MODEL_{index}") or DEFAULT_MODEL
            configured.append((index, token, model))

    # Backward-compatible single-token names.
    if not configured:
        token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_API_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
        if token:
            configured.append((1, token, os.getenv("HF_MODEL_1") or DEFAULT_MODEL))

    if not configured:
        raise RuntimeError(
            "لم يتم العثور على مفاتيح Hugging Face. أضف HF_TOKEN_1 إلى HF_TOKEN_4 في إعدادات Render."
        )

    for index, token, model in configured:
        try:
            answer = _huggingface_chat(token, model, messages)
            return {"reply": answer, "provider": f"huggingface:{model}", "key_slot": index}
        except Exception as exc:
            failures.append(f"HF key {index} ({model}): {str(exc)[:300]}")

    raise RuntimeError(
        "تعذر الوصول إلى Hugging Face باستخدام المفاتيح الأربعة. "
        + " | ".join(failures)
    )
