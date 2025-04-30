import React, {useState, useRef, useEffect} from "react";
import {PiBroomDuotone} from "react-icons/pi";
import Groq from "groq-sdk/index.mjs";
import formatResponse from "./utils/formatResponse";

function App() {
    const [transcript, setTranscript] = useState("");
    const [response, setResponse] = useState([]);
    const [status, setStatus] = useState("");

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(new Uint8Array(0));

    const groq = new Groq({
        apiKey: "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",
        dangerouslyAllowBrowser: true,
    });

    const speak = async (text) => {
        if (!text || typeof text !== "string" || text.trim() === "") {
            console.error("Invalid text for TTS");
            return;
        }

        console.log("TTS input text:", text);

        const options = {
            method: "POST",
            headers: {
                "api-subscription-key": "e896f93c-13e1-4b86-828f-2b1157ae1f18",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                speaker: "anushka",
                pitch: 0,
                pace: 1,
                loudness: 1,
                speech_sample_rate: 22050,
                enable_preprocessing: false,
                target_language_code: "en-IN",
                text: text,
                model: "bulbul:v2",
            }),
        };

        try {
            const response = await fetch(
                "https://api.sarvam.ai/text-to-speech",
                options
            );
            const data = await response.json();

            if (data?.audios?.[0]) {
                const base64Audio = data.audios[0];
                const binary = atob(base64Audio);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                const audioBlob = new Blob([bytes], {type: "audio/wav"});
                const audioURL = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioURL);
                audio.play();
            } else {
                console.error("Sarvam TTS failed: No audio returned", data);
            }
        } catch (error) {
            console.error("Sarvam TTS Error:", error);
        }
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyserRef.current = analyser;
        source.connect(analyser);
        dataArrayRef.current = new Uint8Array(analyser.fftSize);

        let speaking = false;
        let silenceStart = null;
        const silenceDelay = 1000;

        mediaRecorderRef.current.ondataavailable = (e) => {
            audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            audioContext.close();
            setStatus("processing ...");
            const audioBlob = new Blob(audioChunksRef.current, {
                type: "audio/mpeg",
            });

            const formData = new FormData();
            formData.append("file", audioBlob, "raudio.mp3");
            formData.append("model", "saarika:v2");
            formData.append("language_code", "en-IN");
            formData.append("with_timestamps", "true");
            formData.append("with_diarization", "false");
            formData.append("num_speakers", "1");

            try {
                const response = await fetch(
                    "https://api.sarvam.ai/speech-to-text",
                    {
                        method: "POST",
                        headers: {
                            "api-subscription-key":
                                "e896f93c-13e1-4b86-828f-2b1157ae1f18",
                        },
                        body: formData,
                    }
                );

                const data = await response.json();
                console.log(data);

                if (data.transcript) {
                    setTranscript(data.transcript);
                    await handleQuery(data.transcript);
                } else {
                    console.error("No transcription received.");
                    setStatus("Failed ...");
                    startRecording();
                }
            } catch (error) {
                console.error("Sarvam ASR Error:", error);
                setStatus("Error ...");
                startRecording();
            }
        };

        const detectSpeaking = () => {
            analyser.getByteTimeDomainData(dataArrayRef.current);

            let sum = 0;
            for (let i = 0; i < dataArrayRef.current.length; i++) {
                sum += Math.abs(dataArrayRef.current[i] - 128);
            }
            const volume = sum / dataArrayRef.current.length;

            const speakingThreshold = 5;

            if (volume > speakingThreshold) {
                if (
                    !speaking &&
                    mediaRecorderRef.current.state !== "recording"
                ) {
                    console.log("Speaking started");
                    setStatus("Listening...");
                    mediaRecorderRef.current.start();
                    speaking = true;
                }
                silenceStart = null;
            } else if (speaking) {
                if (!silenceStart) {
                    silenceStart = Date.now();
                } else if (Date.now() - silenceStart > silenceDelay) {
                    console.log("Silence detected, stopping recording...");
                    mediaRecorderRef.current.stop();
                    speaking = false;
                }
            }

            requestAnimationFrame(detectSpeaking);
        };
        detectSpeaking();
    };

    const handleQuery = async (text) => {
        setResponse((prev) => [...prev, {sender: "user", message: text}]);
        setStatus("thinking");

        try {
            const res = await groq.chat.completions.create({
                messages: [{role: "user", content: text}],
                model: "llama3-70b-8192",
            });

            const reply = res.choices[0].message.content;
            const formattedReply = formatResponse(reply);

            setResponse((prev) => [
                ...prev,
                {sender: "ai", message: formattedReply},
            ]);
            speak(reply);
        } catch (error) {
            console.error("Groq API Error:", error);
        } finally {
            setStatus("");
            startRecording();
        }
    };

    useEffect(() => {
        startRecording();
    }, []);

    const resetTranscript = () => setTranscript("");

    return (
        <div className="flex flex-col items-center justify-start h-screen p-4 no-scrollbar">
            <h1 className="text-3xl md:text-5xl font-bold text-center mb-4">
                Voice Chatbot
            </h1>

            <div className="w-full md:w-2/3 h-fit overflow-y-auto p-4 mb-14">
                {response.map((entry, index) => (
                    <div
                        key={index}
                        className={`my-2 p-3 rounded-xl max-w-[75%] ${
                            entry.sender === "user"
                                ? "bg-blue-100 ml-auto text-right"
                                : "bg-green-100 mr-auto text-left"
                        }`}
                    >
                        {entry.message}
                    </div>
                ))}
            </div>

            <div className="flex flex-row items-center w-full md:w-2/3 gap-2 fixed bottom-4 justify-center">
                <div className="bg-white shadow-md rounded-full px-4 py-2 flex items-center w-full max-w-[80%] overflow-hidden">
                    <p className="text-gray-600 truncate">
                        {status === "listening"
                            ? "🎙️ Listening..."
                            : status === "processing"
                            ? "⏳ Processing..."
                            : status === "thinking"
                            ? "🤔 Thinking..."
                            : transcript.length === 0
                            ? "Say something..."
                            : transcript}
                    </p>
                </div>

                <button
                    onClick={resetTranscript}
                    className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
                >
                    <PiBroomDuotone className="text-2xl text-sky-600" />
                </button>
            </div>
        </div>
    );
}

export default App;
