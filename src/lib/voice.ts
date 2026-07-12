import { useEffect, useRef, useState } from "react";

type SR = {
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (Ctor) setSupported(true);
  }, []);

  function start() {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onText(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  return { listening, supported, start, stop, toggle: () => (listening ? stop() : start()) };
}
