(function () {
  const CHAT_API_URL = document.currentScript?.dataset.apiUrl || "";

  const launcher = document.getElementById("chat-launcher");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");

  if (!launcher || !panel || !messagesEl || !form || !input || !sendBtn) return;

  const suggestions = [
    "What has Aditya built with RAG?",
    "Summarize his AI Engineer experience",
    "What is his education background?",
  ];

  let hasSentMessage = false;
  let isLoading = false;

  function togglePanel(open) {
    const shouldOpen = open ?? !panel.classList.contains("is-open");
    panel.classList.toggle("is-open", shouldOpen);
    launcher.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) input.focus();
  }

  function renderEmptyState() {
    messagesEl.innerHTML = `
      <div class="chat-widget-empty">
        Ask me about Aditya's experience, skills, education, or projects.
        <div class="chat-widget-suggestions">
          ${suggestions
            .map(
              (text) =>
                `<button type="button" class="chat-widget-suggestion" data-suggestion="${text}">${text}</button>`,
            )
            .join("")}
        </div>
      </div>`;

    messagesEl.querySelectorAll("[data-suggestion]").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.getAttribute("data-suggestion") || "";
        form.requestSubmit();
      });
    });
  }

  function appendMessage(role, text) {
    if (!hasSentMessage) {
      messagesEl.innerHTML = "";
      hasSentMessage = true;
    }

    const message = document.createElement("div");
    message.className = `chat-message chat-message-${role}`;
    message.textContent = text;
    messagesEl.appendChild(message);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return message;
  }

  function appendSources(sources) {
    if (!sources?.length) return;

    const wrapper = document.createElement("div");
    wrapper.className = "chat-message-sources";
    wrapper.innerHTML = sources
      .map(
        (source) =>
          `<button type="button" class="chat-widget-suggestion" data-source-url="${source.url_anchor}" data-source-text="${source.section}">${source.section}</button>`,
      )
      .join("");
    messagesEl.appendChild(wrapper);
    
    wrapper.querySelectorAll("[data-source-url]").forEach((button) => {
      button.addEventListener("click", () => {
        const text = button.getAttribute("data-source-text");
        if (text) sendMessage(text);
      });
    });
    
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setLoading(loading) {
    isLoading = loading;
    input.disabled = loading;
    sendBtn.disabled = loading;
  }

  async function sendMessage(message) {
    if (!message.trim() || isLoading) return;

    if (!CHAT_API_URL) {
      appendMessage(
        "assistant",
        "Chat is not configured yet. Set the API URL in chat.js after deploying the Cloudflare Worker.",
      );
      return;
    }

    appendMessage("user", message);
    input.value = "";
    setLoading(true);

    const loadingEl = document.createElement("div");
    loadingEl.className = "chat-message-loading";
    loadingEl.textContent = "Thinking...";
    messagesEl.appendChild(loadingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const response = await fetch(CHAT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      loadingEl.remove();

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Request failed");
      }

      const data = await response.json();
      appendMessage("assistant", data.answer || "Sorry, I couldn't generate a response.");
      appendSources(data.sources);
    } catch (error) {
      loadingEl.remove();
      appendMessage(
        "assistant",
        error instanceof Error && error.message.includes("Rate limit")
          ? error.message
          : "I am unable to provide you more information right now. Please try again later or email avrao1890@gmail.com.",
      );
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  launcher.addEventListener("click", () => togglePanel());
  closeBtn?.addEventListener("click", () => togglePanel(false));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  renderEmptyState();
})();
