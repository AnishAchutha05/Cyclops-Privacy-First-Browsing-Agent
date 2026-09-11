let controlFlowActive = false;
let verifiedTextAccumulator = "";

const UI = {
  start: document.getElementById('start-trigger'),
  stop: document.getElementById('stop-trigger'),
  card: document.getElementById('status-card'),
  label: document.getElementById('status-label'),
  terminal: document.getElementById('terminal-feed')
};

function transitionState(stateClass, labelMessage) {
  UI.card.className = `status-badge state-${stateClass}`;
  UI.label.textContent = labelMessage;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.channel === 'CYCLOPS_ON_PAGE_STREAM') {
    if (message.type === 'START') {
      transitionState('listening', 'Listening (en-IN Mode)...');
      UI.start.disabled = true;
      UI.stop.disabled = false;
      UI.terminal.innerHTML = "<span style='color:#38bdf8;'>Voice stream active! Speak clearly now...</span>";
    } else if (message.type === 'RESULT') {
      let pendingInterimText = message.interimText || "";
      verifiedTextAccumulator = message.finalText || "";

      UI.terminal.innerHTML = `
        <span style="color: #f1f5f9; font-weight: 500;">${verifiedTextAccumulator}</span>
        <span class="interim-text" style="color: #64748b; font-style: italic;">${pendingInterimText}</span>
      `;
      UI.terminal.scrollTop = UI.terminal.scrollHeight;
    } else if (message.type === 'ERROR') {
      transitionState('error', 'Microphone Error');
      UI.terminal.innerHTML = `<span style='color:#ef4444;'>Error: ${message.error}. Please click Allow on the page mic prompt.</span>`;
      killActiveStreamingSession();
    } else if (message.type === 'END') {
      if (!controlFlowActive) {
        killActiveStreamingSession();
      }
    }
    sendResponse({ status: 'DISPLAY_UPDATED' });
  }
  return true;
});

async function initiateVoiceCapture() {
  transitionState('processing', 'Summoning page microphone...');
  UI.terminal.innerHTML = "<span style='color:#f59e0b;'>Please check the web page browser bar and click 'Allow' to begin...</span>";

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    transitionState('error', 'No Active Tab');
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: ['content-voice.js']
  }, () => {
    chrome.tabs.sendMessage(activeTab.id, { command: 'START_RECOGNITION' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Initializing baseline injection.");
      }
    });
  });
}

async function stopVoiceCapture() {
  controlFlowActive = false;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.id) {
    chrome.tabs.sendMessage(activeTab.id, { command: 'STOP_RECOGNITION' });
  }
  killActiveStreamingSession();
}

function killActiveStreamingSession() {
  controlFlowActive = false;
  UI.start.disabled = false;
  UI.stop.disabled = true;
  // Clear the stuck status badge instantly and put it back to green standby
  transitionState('ready', 'Ready');
}

UI.start.addEventListener('click', () => {
  verifiedTextAccumulator = "";
  UI.terminal.textContent = "";
  controlFlowActive = true;
  initiateVoiceCapture();
});

UI.stop.addEventListener('click', stopVoiceCapture);
