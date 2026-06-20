import { useEffect, useRef, useState, type ChangeEvent } from "react";

interface CaptureBarProps {
  onSubmit: (text: string) => Promise<void> | void;
  isLoading?: boolean;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-2.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

export default function CaptureBar({
  onSubmit,
  isLoading = false,
}: CaptureBarProps) {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
    };
  }, []);

  const handleSubmit = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isLoading) return;
    await onSubmit(trimmedValue);
    setValue("");
    setVoiceError(null);
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setVoiceError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("Microphone access denied.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size === 0) return;

      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const { transcript } = (await res.json()) as { transcript: string };
        if (transcript) {
          setValue((cur) =>
            cur.trim() ? `${cur.trimEnd()} ${transcript.trim()}` : transcript.trim()
          );
        }
      } catch (err) {
        setVoiceError(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const [isExtractingFile, setIsExtractingFile] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) return;
    event.target.value = "";

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      // Send PDF to server for text extraction
      setIsExtractingFile(true);
      setVoiceError(null);
      try {
        const formData = new FormData();
        formData.append("file", file, file.name);
        const res = await fetch("/api/extract", { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        const { text, filename, pageCount } = (await res.json()) as {
          text: string;
          filename: string;
          pageCount?: number;
        };
        const header = pageCount
          ? `[PDF: ${filename} — ${pageCount} page${pageCount === 1 ? "" : "s"}]`
          : `[File: ${filename}]`;
        setValue((cur) => {
          const divider = cur.trim().length > 0 ? "\n\n" : "";
          return `${cur}${divider}${header}\n${text}`.trim();
        });
      } catch (err) {
        setVoiceError(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsExtractingFile(false);
      }
    } else {
      // Plain text files — read directly in browser
      const fileText = await file.text();
      setValue((cur) => {
        const divider = cur.trim().length > 0 ? "\n\n" : "";
        return `${cur}${divider}[File: ${file.name}]\n${fileText}`.trim();
      });
    }
  };

  const busyRecording = isRecording || isTranscribing || isExtractingFile;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="메모, 할 일, 파일 등 무엇이든 입력하세요 / Drop anything — notes, tasks, files..."
          rows={1}
          className="max-h-48 min-h-[88px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleVoiceToggle()}
              disabled={isTranscribing}
              title={isRecording ? "Stop recording" : "Record voice — Korean & English supported (AI transcription)"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition disabled:cursor-wait ${
                isRecording
                  ? "border-red-200 bg-red-50 text-red-600"
                  : isTranscribing
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200 hover:text-indigo-600"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isRecording
                    ? "animate-pulse bg-red-500"
                    : isTranscribing
                    ? "animate-pulse bg-yellow-500"
                    : "bg-gray-400"
                }`}
              />
              {isTranscribing ? "Transcribing…" : isRecording ? "Stop" : "Voice"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-indigo-200 hover:text-indigo-600"
            >
              Upload file
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading || busyRecording || !value.trim()}
            className="inline-flex min-w-28 items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {isLoading ? <Spinner /> : <span>Send</span>}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
          <span className={voiceError ? "text-red-500" : ""}>
            {voiceError ?? "Tip: Ctrl+Enter to send · 한국어/English 모두 지원 · Voice transcribed by Whisper AI"}
          </span>
          <span>
            {isExtractingFile
              ? "Extracting…"
              : isTranscribing
              ? "Transcribing…"
              : isRecording
              ? "🔴 Recording"
              : "Ready"}
          </span>
        </div>
      </div>
    </section>
  );
}
