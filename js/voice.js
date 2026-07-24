// Voice assistant wrapper around the real browser Web Speech API
// (SpeechRecognition for mic input, speechSynthesis for spoken replies).
// Support varies by browser (best in Chrome/Edge); we feature-detect and
// no-op gracefully where it's missing.

const MoneyOSVoice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function supported() {
    return !!SR;
  }

  function listenOnce() {
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error('Voice recognition is not supported in this browser.'));
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => resolve(e.results[0][0].transcript);
      rec.onerror = (e) => reject(new Error(e.error || 'Voice recognition error'));
      rec.onend = () => {};
      rec.start();
    });
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    window.speechSynthesis.speak(utter);
  }

  return { supported, listenOnce, speak };
})();
