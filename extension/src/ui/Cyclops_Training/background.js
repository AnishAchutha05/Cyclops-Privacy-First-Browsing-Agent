console.log("Cyclops Voice Broker Active.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.channel === 'CYCLOPS_VOICE_IPC') {
    console.log(`[Background Master Log] Real-time token saved: "${message.payload.text}"`);
  }
  return true;
});
