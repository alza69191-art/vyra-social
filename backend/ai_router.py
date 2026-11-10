import json
import os
import urllib.error
import urllib.request

TIMEOUT = 90
HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"

ASSISTANT_DEFAULT_MODEL = "Qwen/Qwen3-4B-Instruct-2507:fastest"
AGENT_DEFAULT_MODEL = "Qwen/Qwen3-30B-A3B:fastest"


def _huggingface_chat(token: str, model: str, messages: list[dict]) -> str:
    payload = {"model": model, "messages": messages, "temperature": 0.6}
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
            error = parsed.get("error")
            detail = error.get("message") if isinstance(error, dict) else error
            detail = detail or parsed.get("message") or raw
        except (ValueError, AttributeError):
            detail = raw
        raise RuntimeError(f"Hugging Face HTTP {exc.code}: {str(detail)[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Hugging Face network error: {str(exc.reason)[:200]}") from exc

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


def _build_messages(system_prompt: str, prompt: str, history: list[dict] | None) -> list[dict]:
    messages = [{"role": "system", "content": system_prompt}]
    for item in (history or [])[-12:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            messages.append({"role": role, "content": content[:6000]})
    messages.append({"role": "user", "content": prompt[:12000]})
    return messages


def _run_role(token_name: str, model_name: str, default_model: str,
              system_prompt: str, prompt: str, history: list[dict] | None,
              role_label: str) -> dict:
    token = os.getenv(token_name, "").strip()
    if not token:
        raise RuntimeError(
            f"مفتاح {role_label} غير مضبوط. أضف المتغير {token_name} في Render."
        )
    model = os.getenv(model_name, default_model).strip() or default_model
    messages = _build_messages(system_prompt, prompt, history)
    answer = _huggingface_chat(token, model, messages)
    return {"reply": answer, "provider": f"huggingface:{model}", "role": role_label}


def generate_reply(prompt: str, history: list[dict] | None = None) -> dict:
    return _run_role(
        "HF_ASSISTANT_TOKEN",
        "HF_ASSISTANT_MODEL",
        ASSISTANT_DEFAULT_MODEL,
        "أنت مساعد VYRA الذكي. مهمتك الإجابة عن الأسئلة وشرح المعلومات وتقديم اقتراحات واضحة. "
        "لا تدّع تنفيذ أي إجراء داخل المنصة. أجب بلغة المستخدم وباختصار ودقة، واذكر حدود معرفتك.",
        prompt,
        history,
        "assistant",
    )


def generate_agent_reply(prompt: str, history: list[dict] | None = None) -> dict:
    return _run_role(
        "HF_AGENT_TOKEN",
        "HF_AGENT_MODEL",
        AGENT_DEFAULT_MODEL,
        "أنت وكيل VYRA الذكي. حلّل هدف المستخدم، قسّم العمل إلى خطوات عملية مرتبة، "
        "حدّد المتطلبات والمخاطر، واقترح الإجراء التالي بوضوح. لا تدّع أنك نفذت تغييرات "
        "أو اتصلت بخدمات أو استخدمت أدوات غير متاحة لك. اطلب تأكيد المستخدم قبل أي إجراء "
        "خارجي أو مؤثر. أجب بلغة المستخدم وكن دقيقاً.",
        prompt,
        history,
        "agent",
    )
