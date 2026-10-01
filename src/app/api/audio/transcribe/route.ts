import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (openAiKey) {
      const openAiFormData = new FormData();
      openAiFormData.append("file", file, "audio.webm");
      openAiFormData.append("model", "whisper-1");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: openAiFormData,
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ text: data.text });
      }
      
      const errorText = await res.text();
      console.error("OpenAI transcription error:", errorText);
    }

    if (groqKey) {
      const groqFormData = new FormData();
      groqFormData.append("file", file, "audio.webm");
      groqFormData.append("model", "whisper-large-v3");
      groqFormData.append("response_format", "json");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
        },
        body: groqFormData,
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ text: data.text });
      }
      
      const errorText = await res.text();
      console.error("Groq transcription error:", errorText);
    }

    // Fallback if no keys or API failed
    return NextResponse.json({
      text: "[Transcription unavailable - No API key or API failed. Audio received successfully.]",
    });

  } catch (error) {
    console.error("Error processing audio:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 }
    );
  }
}
