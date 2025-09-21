// src/services/audioService.ts

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { supabase } from "../lib/supabaseClient";
import { sendMessageToBackend } from "./chatService";

// --- Types ---
export type AudioEvent =
  | "audio_record_start"
  | "audio_record_complete"
  | "audio_stt_success"
  | "audio_stt_fail"
  | "audio_tts_playback"
  | "audio_tts_fail";

interface AudioProps {
  user_id: string;
  tier: "free" | "core" | "studio";
  session_id: string;
}

// --- Core Service ---
// TTS cache to avoid re-generating audio for the same text
const ttsCache = new Map<string, { base64Audio: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const audioService = {
  /**
   * Transcribe audio and send to chat service
   */
  async transcribeAndSend(
    fileUri: string,
    props: AudioProps,
    onMessage?: (partial: string) => void,
    onComplete?: (full: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // 1. Log event: record complete
      await logAudioEvent("audio_record_complete", props, {
        fileUri,
      });

      // 2. Run STT (Speech-to-Text)
      const audioBuffer = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const transcription = await runWhisperSTT(audioBuffer);

      if (!transcription) {
        await logAudioEvent("audio_stt_fail", props, { error: "no_result" });
        onError?.("Failed to transcribe audio. Please try again.");
        return;
      }

      await logAudioEvent("audio_stt_success", props, {
        chars_output: transcription.length,
      });

      // 3. Pass transcribed text into chatService
      await sendMessageToBackend({
        message: transcription,
        conversationId: props.session_id,
        userId: props.user_id,
        tier: props.tier,
        onMessage,
        onComplete,
        onError
      });

    } catch (err) {
      console.error("audioService.transcribeAndSend error:", err);
      await logAudioEvent("audio_stt_fail", props, { error: String(err) });
      onError?.(String(err));
    }
  },

  /**
   * Play TTS for Core/Studio users
   */
  async playTTS(text: string, props: AudioProps): Promise<void> {
    try {
      // Only play TTS for Core/Studio users
      if (props.tier === "free") {
        console.log("TTS skipped for free tier user");
        return;
      }

      // Check cache first
      const cacheKey = `${text}-en-US-JennyNeural`;
      const cached = ttsCache.get(cacheKey);
      let base64Audio: string;

      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log("Using cached TTS audio");
        base64Audio = cached.base64Audio;
      } else {
        // 1. Call Edge-TTS (Supabase Edge Function wrapper)
        const { data, error } = await supabase.functions.invoke("tts", {
          body: { text, voice: "en-US-JennyNeural" },
        });

        if (error) throw error;
        base64Audio = data.base64Audio;

        // Cache the result
        ttsCache.set(cacheKey, {
          base64Audio,
          timestamp: Date.now()
        });
      }

      // 2. Save audio file locally
      const fileUri = `${FileSystem.cacheDirectory}tts-${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Play audio using expo-av
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      await sound.playAsync();

      // 4. Clean up - CRITICAL: prevent memory leaks
      await sound.unloadAsync();
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      // 5. Log event
      await logAudioEvent("audio_tts_playback", props, {
        chars_input: text.length,
        cached: !!cached
      });

    } catch (err) {
      console.error("audioService.playTTS error:", err);
      await logAudioEvent("audio_tts_fail", props, { error: String(err) });
    }
  },

  /**
   * Record audio using expo-av
   */
  async startRecording(): Promise<Audio.Recording> {
    try {
      console.log("Requesting audio permissions...");
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await recording.startAsync();

      return recording;
    } catch (err) {
      console.error("Failed to start recording:", err);
      throw new Error("Failed to start recording. Please check microphone permissions.");
    }
  },

  /**
   * Stop recording and get file URI
   */
  async stopRecording(recording: Audio.Recording): Promise<string> {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (!uri) {
        throw new Error("No recording URI available");
      }
      
      return uri;
    } catch (err) {
      console.error("Failed to stop recording:", err);
      throw new Error("Failed to stop recording");
    }
  }
};

// --- Helpers ---

/**
 * Run STT using Nova backend or Supabase Edge Function
 */
async function runWhisperSTT(base64Audio: string): Promise<string | null> {
  try {
    // Try Nova backend first (if available)
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    
    try {
      const response = await fetch(`${API_URL}/stt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: base64Audio }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.text || null;
      }
    } catch (novaError) {
      console.log("Nova backend not available, trying Supabase Edge Function");
    }

    // Fallback to Supabase Edge Function
    const { data, error } = await supabase.functions.invoke("stt", {
      body: { audio: base64Audio },
    });
    
    if (error) {
      console.error("STT error:", error);
      return null;
    }
    
    return data?.text || null;
  } catch (error) {
    console.error("STT service error:", error);
    return null;
  }
}

/**
 * Log audio events to Supabase
 */
async function logAudioEvent(
  event: AudioEvent,
  props: AudioProps,
  extra: Record<string, any> = {}
) {
  try {
    await supabase.from("audio_events").insert({
      user_id: props.user_id,
      event_name: event,
      props: { ...props, ...extra },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log audio event:", error);
  }
}

export default audioService;
