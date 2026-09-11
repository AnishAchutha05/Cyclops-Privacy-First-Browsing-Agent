// content-voice.js - Stable Web Audio Frame Transcriber
(function() {
  if (window.hasCyclopsVoiceInstance) {
    console.log("[Cyclops Voice] Instance already present on active web frame.");
    return;
  }
  window.hasCyclopsVoiceInstance = true;
  window.cyclopsFinalAccumulator = "";

  let recognition = null;
  let keepAlive = false;

  function initSpeechEngine() {
    const SpeechConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechConstructor) return;

    recognition = new SpeechConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Fine-tuned Indian accent matching parameters
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      chrome.runtime.sendMessage({ channel: 'CYCLOPS_ON_PAGE_STREAM', type: 'START' });
    };

    recognition.onresult = (event) => {
      let interimText = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        // CORRECT ARRAY PARSING: Read the index [0] item node inside the result block
        if (event.results[i] && event.results[i][0]) {
          const processedTranscriptText = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            window.cyclopsFinalAccumulator += processedTranscriptText + " ";
          } else {
            interimText += processedTranscriptText;
          }
        }
      }

      // Stream the valid text variables cleanly to sidepanel.js without undefined entries
      chrome.runtime.sendMessage({
        channel: 'CYCLOPS_ON_PAGE_STREAM',
        type: 'RESULT',
        finalText: window.cyclopsFinalAccumulator,
        interimText: interimText
      });
    };

    recognition.onerror = (event) => {
      console.error("[On-Page Voice System Error]:", event.error);
      chrome.runtime.sendMessage({
        channel: 'CYCLOPS_ON_PAGE_STREAM',
        type: 'ERROR',
        error: event.error
      });
    };

    recognition.onend = () => {
      if (keepAlive) {
        try { recognition.start(); } catch(e) {}
      } else {
        chrome.runtime.sendMessage({ channel: 'CYCLOPS_ON_PAGE_STREAM', type: 'END' });
      }
    };
  }

  // Handle command routing structures distributed from sidepanel.js view context
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'START_RECOGNITION') {
      window.cyclopsFinalAccumulator = "";
      keepAlive = true;
      
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          if (!recognition) initSpeechEngine();
          recognition.start();
        })
        .catch((err) => {
          chrome.runtime.sendMessage({
            channel: 'CYCLOPS_ON_PAGE_STREAM',
            type: 'ERROR',
            error: 'not-allowed'
          });
        });
      sendResponse({ status: 'LAUNCHED' });
    } else if (request.command === 'STOP_RECOGNITION') {
      keepAlive = false;
      if (recognition) {
        try { recognition.stop(); } catch(e) {}
      }
      sendResponse({ status: 'TERMINATED' });
    }
    return true;
  });

  console.log("[Cyclops Voice] Target frame runtime worker active.");
})();
