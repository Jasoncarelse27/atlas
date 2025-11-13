export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          content_type: string | null
          conversation_id: string | null
          created_at: string | null
          feature: string
          id: string
          size_bytes: number | null
          status: string | null
          updated_at: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          feature: string
          id?: string
          size_bytes?: number | null
          status?: string | null
          updated_at?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          content_type?: string | null
          conversation_id?: string | null
          created_at?: string | null
          feature?: string
          id?: string
          size_bytes?: number | null
          status?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_cache: {
        Row: {
          audio_url: string
          character_count: number
          created_at: string | null
          expires_at: string
          hit_count: number | null
          id: string
          model: string
          text_content: string
          text_hash: string
          voice: string
        }
        Insert: {
          audio_url: string
          character_count: number
          created_at?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          model: string
          text_content: string
          text_hash: string
          voice: string
        }
        Update: {
          audio_url?: string
          character_count?: number
          created_at?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          model?: string
          text_content?: string
          text_hash?: string
          voice?: string
        }
        Relationships: []
      }
      audio_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      budget_tracking: {
        Row: {
          date: string
          id: number
          last_updated: string | null
          request_count: number | null
          tier: string
          total_spend: number | null
        }
        Insert: {
          date: string
          id?: number
          last_updated?: string | null
          request_count?: number | null
          tier: string
          total_spend?: number | null
        }
        Update: {
          date?: string
          id?: number
          last_updated?: string | null
          request_count?: number | null
          tier?: string
          total_spend?: number | null
        }
        Relationships: []
      }
      cache_stats: {
        Row: {
          cost_savings: number | null
          created_at: string | null
          date: string
          hits: number | null
          id: number
          misses: number | null
        }
        Insert: {
          cost_savings?: number | null
          created_at?: string | null
          date: string
          hits?: number | null
          id?: number
          misses?: number | null
        }
        Update: {
          cost_savings?: number | null
          created_at?: string | null
          date?: string
          hits?: number | null
          id?: number
          misses?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_personal_reflection: boolean | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_personal_reflection?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_personal_reflection?: boolean | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          api_cost_estimate: number
          conversations_count: number
          created_at: string
          date: string
          id: number
          tier: string
          total_tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_cost_estimate?: number
          conversations_count?: number
          created_at?: string
          date: string
          id?: number
          tier: string
          total_tokens_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_cost_estimate?: number
          conversations_count?: number
          created_at?: string
          date?: string
          id?: number
          tier?: string
          total_tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_failures: {
        Row: {
          created_at: string | null
          error_message: string
          id: string
          recipient: string
          template: string
        }
        Insert: {
          created_at?: string | null
          error_message: string
          id?: string
          recipient: string
          template: string
        }
        Update: {
          created_at?: string | null
          error_message?: string
          id?: string
          recipient?: string
          template?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          data: Json
          error: string
          id: number
          timestamp: string
        }
        Insert: {
          data?: Json
          error: string
          id?: number
          timestamp?: string
        }
        Update: {
          data?: Json
          error?: string
          id?: number
          timestamp?: string
        }
        Relationships: []
      }
      feature_attempts: {
        Row: {
          created_at: string | null
          feature: string
          id: string
          tier: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feature: string
          id?: string
          tier: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feature?: string
          id?: string
          tier?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_events: {
        Row: {
          created_at: string | null
          event_name: string
          file_path: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_name: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_name?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      intelligent_metering: {
        Row: {
          anomaly_detected: boolean | null
          anomaly_reason: string | null
          created_at: string | null
          estimated_cost: number | null
          id: string
          month_year: string
          stt_minutes: number | null
          tts_characters: number | null
          updated_at: string | null
          user_id: string
          voice_calls_count: number | null
        }
        Insert: {
          anomaly_detected?: boolean | null
          anomaly_reason?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          month_year: string
          stt_minutes?: number | null
          tts_characters?: number | null
          updated_at?: string | null
          user_id: string
          voice_calls_count?: number | null
        }
        Update: {
          anomaly_detected?: boolean | null
          anomaly_reason?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          month_year?: string
          stt_minutes?: number | null
          tts_characters?: number | null
          updated_at?: string | null
          user_id?: string
          voice_calls_count?: number | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          context: Json | null
          created_at: string | null
          id: number
          level: string
          message: string
          stack: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: number
          level: string
          message: string
          stack?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: number
          level?: string
          message?: string
          stack?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_reactions_message_id"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_reactions_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          message_type: string | null
          metadata: Json | null
          role: string
          user_id: string | null
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          role: string
          user_id?: string | null
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_2024_01: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_02: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_03: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_04: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_05: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_06: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_07: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_08: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_09: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_10: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_11: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2024_12: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_01: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_02: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_03: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_04: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_05: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_06: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_07: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_08: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_09: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_10: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_11: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2025_12: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_01: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_02: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_03: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_04: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_05: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_06: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_07: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_08: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_09: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_10: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_11: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_2026_12: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages_partitioned: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id: string
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      model_usage_logs: {
        Row: {
          cost_estimate: number | null
          count: number | null
          created_at: string | null
          date: string
          id: number
          model: string
          tier: string
        }
        Insert: {
          cost_estimate?: number | null
          count?: number | null
          created_at?: string | null
          date: string
          id?: number
          model: string
          tier: string
        }
        Update: {
          cost_estimate?: number | null
          count?: number | null
          created_at?: string | null
          date?: string
          id?: number
          model?: string
          tier?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          favorite_ritual_ids: Json | null
          first_payment: string | null
          first_payment_date: string | null
          full_name: string | null
          id: string
          last_reset_date: string | null
          last_ritual_id: string | null
          personal_details: Json | null
          streak_freeze_used_at: string | null
          subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
          usage_stats: Json | null
          user_context: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          favorite_ritual_ids?: Json | null
          first_payment?: string | null
          first_payment_date?: string | null
          full_name?: string | null
          id: string
          last_reset_date?: string | null
          last_ritual_id?: string | null
          personal_details?: Json | null
          streak_freeze_used_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          usage_stats?: Json | null
          user_context?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          favorite_ritual_ids?: Json | null
          first_payment?: string | null
          first_payment_date?: string | null
          full_name?: string | null
          id?: string
          last_reset_date?: string | null
          last_ritual_id?: string | null
          personal_details?: Json | null
          streak_freeze_used_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          usage_stats?: Json | null
          user_context?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_ritual_id_fkey"
            columns: ["last_ritual_id"]
            isOneToOne: false
            referencedRelation: "rituals"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_cache: {
        Row: {
          content: string
          created_at: string | null
          expires_at: string
          hash: string
          id: number
          tokens: number
        }
        Insert: {
          content: string
          created_at?: string | null
          expires_at: string
          hash: string
          id?: number
          tokens: number
        }
        Update: {
          content?: string
          created_at?: string | null
          expires_at?: string
          hash?: string
          id?: number
          tokens?: number
        }
        Relationships: []
      }
      response_cache: {
        Row: {
          created_at: string
          expires_at: string
          hit_count: number
          id: number
          query_hash: string
          query_text: string
          response_text: string
          tier: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          hit_count?: number
          id?: number
          query_hash: string
          query_text: string
          response_text: string
          tier: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: number
          query_hash?: string
          query_text?: string
          response_text?: string
          tier?: string
        }
        Relationships: []
      }
      retry_logs: {
        Row: {
          attempted_count: number | null
          created_at: string | null
          details: Json | null
          failed_count: number | null
          file_type: string | null
          id: string
          source: string
          success_count: number | null
          user_id: string | null
        }
        Insert: {
          attempted_count?: number | null
          created_at?: string | null
          details?: Json | null
          failed_count?: number | null
          file_type?: string | null
          id?: string
          source: string
          success_count?: number | null
          user_id?: string | null
        }
        Update: {
          attempted_count?: number | null
          created_at?: string | null
          details?: Json | null
          failed_count?: number | null
          file_type?: string | null
          id?: string
          source?: string
          success_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retry_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_logs: {
        Row: {
          completed_at: string
          duration_seconds: number
          id: string
          mood_after: string
          mood_before: string
          notes: string | null
          ritual_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          duration_seconds: number
          id?: string
          mood_after: string
          mood_before: string
          notes?: string | null
          ritual_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          duration_seconds?: number
          id?: string
          mood_after?: string
          mood_before?: string
          notes?: string | null
          ritual_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_logs_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "rituals"
            referencedColumns: ["id"]
          },
        ]
      }
      rituals: {
        Row: {
          created_at: string
          goal: string
          id: string
          is_preset: boolean
          steps: Json
          tier_required: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          goal: string
          id?: string
          is_preset?: boolean
          steps?: Json
          tier_required?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          goal?: string
          id?: string
          is_preset?: boolean
          steps?: Json
          tier_required?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          event_type: string
          from_tier: string | null
          id: string
          metadata: Json | null
          to_tier: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_type: string
          from_tier?: string | null
          id?: string
          metadata?: Json | null
          to_tier?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_type?: string
          from_tier?: string | null
          id?: string
          metadata?: Json | null
          to_tier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_table: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      tier_budgets: {
        Row: {
          budget_ceiling: number
          created_at: string | null
          daily_limit: number
          id: string
          tier: string
        }
        Insert: {
          budget_ceiling: number
          created_at?: string | null
          daily_limit: number
          id?: string
          tier: string
        }
        Update: {
          budget_ceiling?: number
          created_at?: string | null
          daily_limit?: number
          id?: string
          tier?: string
        }
        Relationships: []
      }
      tier_usage: {
        Row: {
          cost_accumulated: number | null
          created_at: string | null
          id: string
          last_reset: string | null
          message_count: number | null
          tier: string
          user_id: string
        }
        Insert: {
          cost_accumulated?: number | null
          created_at?: string | null
          id?: string
          last_reset?: string | null
          message_count?: number | null
          tier: string
          user_id: string
        }
        Update: {
          cost_accumulated?: number | null
          created_at?: string | null
          id?: string
          last_reset?: string | null
          message_count?: number | null
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      upgrade_stats: {
        Row: {
          feature: string
          total_prompts: number
          unique_users: number
          updated_at: string | null
        }
        Insert: {
          feature: string
          total_prompts?: number
          unique_users?: number
          updated_at?: string | null
        }
        Update: {
          feature?: string
          total_prompts?: number
          unique_users?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          created_at: string | null
          data: Json
          estimated_cost: number | null
          event: string
          feature: string | null
          id: number
          metadata: Json | null
          tier: string | null
          timestamp: string
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json
          estimated_cost?: number | null
          event: string
          feature?: string | null
          id?: number
          metadata?: Json | null
          tier?: string | null
          timestamp?: string
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          estimated_cost?: number | null
          event?: string
          feature?: string | null
          id?: number
          metadata?: Json | null
          tier?: string | null
          timestamp?: string
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      usage_reconciliation: {
        Row: {
          api_cost_estimate: number | null
          conversations_allowed: number | null
          conversations_attempted: number | null
          conversations_blocked: number | null
          created_at: string
          crisis_bypass_count: number | null
          date: string
          id: number
          subscription_id: number | null
          tier: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          api_cost_estimate?: number | null
          conversations_allowed?: number | null
          conversations_attempted?: number | null
          conversations_blocked?: number | null
          created_at?: string
          crisis_bypass_count?: number | null
          date: string
          id?: number
          subscription_id?: number | null
          tier: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          api_cost_estimate?: number | null
          conversations_allowed?: number | null
          conversations_attempted?: number | null
          conversations_blocked?: number | null
          created_at?: string
          crisis_bypass_count?: number | null
          date?: string
          id?: number
          subscription_id?: number | null
          tier?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_customizations: {
        Row: {
          created_at: string | null
          dashboard: Json
          id: string
          layout: Json
          preferences: Json
          theme: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dashboard?: Json
          id?: string
          layout?: Json
          preferences?: Json
          theme?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dashboard?: Json
          id?: string
          layout?: Json
          preferences?: Json
          theme?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          paddle_subscription_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          paddle_subscription_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          paddle_subscription_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          audio_minutes_count: number | null
          created_at: string | null
          id: string
          image_uploads_count: number | null
          month_year: string
          text_messages_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          audio_minutes_count?: number | null
          created_at?: string | null
          id?: string
          image_uploads_count?: number | null
          month_year: string
          text_messages_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          audio_minutes_count?: number | null
          created_at?: string | null
          id?: string
          image_uploads_count?: number | null
          month_year?: string
          text_messages_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          client_info: Json | null
          conversation_id: string | null
          created_at: string | null
          duration_ms: number | null
          end_time: string | null
          error_count: number | null
          error_message: string | null
          estimated_cost: number | null
          id: string
          llm_cost: number | null
          llm_latency_ms: number | null
          llm_tokens_input: number | null
          llm_tokens_output: number | null
          session_id: string
          start_time: string
          status: string
          stt_cost: number | null
          stt_duration_ms: number | null
          stt_requests: number | null
          total_cost: number | null
          total_latency_ms: number | null
          tts_characters: number | null
          tts_cost: number | null
          tts_latency_ms: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_info?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_count?: number | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          llm_cost?: number | null
          llm_latency_ms?: number | null
          llm_tokens_input?: number | null
          llm_tokens_output?: number | null
          session_id: string
          start_time?: string
          status?: string
          stt_cost?: number | null
          stt_duration_ms?: number | null
          stt_requests?: number | null
          total_cost?: number | null
          total_latency_ms?: number | null
          tts_characters?: number | null
          tts_cost?: number | null
          tts_latency_ms?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_info?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          end_time?: string | null
          error_count?: number | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          llm_cost?: number | null
          llm_latency_ms?: number | null
          llm_tokens_input?: number | null
          llm_tokens_output?: number | null
          session_id?: string
          start_time?: string
          status?: string
          stt_cost?: number | null
          stt_duration_ms?: number | null
          stt_requests?: number | null
          total_cost?: number | null
          total_latency_ms?: number | null
          tts_characters?: number | null
          tts_cost?: number | null
          tts_latency_ms?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_usage_limit: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_audio_cache: { Args: never; Returns: undefined }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_grace_periods: { Args: never; Returns: number }
      delete_conversation_hard: {
        Args: { p_conversation: string; p_user: string }
        Returns: undefined
      }
      delete_conversation_soft: {
        Args: { p_conversation: string; p_user: string }
        Returns: undefined
      }
      detect_usage_anomaly: {
        Args: { p_estimated_cost: number; p_user_id: string }
        Returns: boolean
      }
      enforce_tier_budget: {
        Args: { p_tier: string; p_user_id: string }
        Returns: boolean
      }
      ensure_all_profiles: { Args: never; Returns: undefined }
      get_or_create_daily_usage: {
        Args: { p_date?: string; p_tier: string; p_user_id: string }
        Returns: {
          api_cost_estimate: number
          conversations_count: number
          created_at: string
          date: string
          id: number
          tier: string
          total_tokens_used: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_budget_tracking: {
        Args: {
          p_date: string
          p_req_delta?: number
          p_spend_delta: number
          p_tier: string
        }
        Returns: undefined
      }
      increment_conversation_count: {
        Args: {
          p_cost_estimate: number
          p_tier: string
          p_tokens_used: number
          p_user_id: string
        }
        Returns: {
          api_cost_estimate: number
          conversations_count: number
          created_at: string
          date: string
          id: number
          tier: string
          total_tokens_used: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_usage:
        | {
            Args: { p_amount?: number; p_usage_type: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: { p_cost: number; p_tier: string; p_user_id: string }
            Returns: undefined
          }
      is_user_in_grace_period: { Args: { p_user_id: string }; Returns: boolean }
      log_model_usage: {
        Args: {
          p_cost: number
          p_date: string
          p_model: string
          p_tier: string
        }
        Returns: undefined
      }
      log_usage_attempt: {
        Args: {
          p_allowed: boolean
          p_api_cost?: number
          p_attempted: boolean
          p_crisis_bypass?: boolean
          p_tier: string
          p_tokens_used?: number
          p_user_id: string
        }
        Returns: undefined
      }
      reset_daily_usage: { Args: never; Returns: undefined }
      update_cache_stats: {
        Args: { p_cost_savings?: number; p_date: string; p_hit: boolean }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
