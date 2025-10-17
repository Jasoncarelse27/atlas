// Atlas Database Types
// Generated from Supabase schema
// 
// To regenerate these types:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Get your project ID from your Supabase URL: https://[PROJECT_ID].supabase.co
// 3. Run: supabase gen types typescript --project-id [PROJECT_ID] > src/types/database.types.ts
//
// This file provides type safety for all database operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          subscription_tier: 'free' | 'core' | 'studio'
          subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing'
          subscription_id: string | null
          fastspring_subscription_id: string | null
          trial_ends_at: string | null
          user_memory: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          subscription_tier?: 'free' | 'core' | 'studio'
          subscription_status?: 'active' | 'inactive' | 'cancelled' | 'trialing'
          subscription_id?: string | null
          fastspring_subscription_id?: string | null
          trial_ends_at?: string | null
          user_memory?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          subscription_tier?: 'free' | 'core' | 'studio'
          subscription_status?: 'active' | 'inactive' | 'cancelled' | 'trialing'
          subscription_id?: string | null
          fastspring_subscription_id?: string | null
          trial_ends_at?: string | null
          user_memory?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      daily_usage: {
        Row: {
          id: number
          user_id: string
          date: string
          conversations_count: number
          total_tokens_used: number
          api_cost_estimate: number
          tier: 'free' | 'core' | 'studio'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          date: string
          conversations_count?: number
          total_tokens_used?: number
          api_cost_estimate?: number
          tier: 'free' | 'core' | 'studio'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          date?: string
          conversations_count?: number
          total_tokens_used?: number
          api_cost_estimate?: number
          tier?: 'free' | 'core' | 'studio'
          created_at?: string
          updated_at?: string
        }
      }
      usage_logs: {
        Row: {
          id: number
          user_id: string | null
          event: string
          data: Json
          timestamp: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          event: string
          data?: Json
          timestamp?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          event?: string
          data?: Json
          timestamp?: string
        }
      }
      error_logs: {
        Row: {
          id: number
          error: string
          data: Json
          timestamp: string
        }
        Insert: {
          id?: number
          error: string
          data?: Json
          timestamp?: string
        }
        Update: {
          id?: number
          error?: string
          data?: Json
          timestamp?: string
        }
      }
      response_cache: {
        Row: {
          id: number
          query_hash: string
          query_text: string
          response_text: string
          tier: 'free' | 'core' | 'studio'
          hit_count: number
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: number
          query_hash: string
          query_text: string
          response_text: string
          tier: 'free' | 'core' | 'studio'
          hit_count?: number
          created_at?: string
          expires_at: string
        }
        Update: {
          id?: number
          query_hash?: string
          query_text?: string
          response_text?: string
          tier?: 'free' | 'core' | 'studio'
          hit_count?: number
          created_at?: string
          expires_at?: string
        }
      }
      fastspring_subscriptions: {
        Row: {
          id: string
          user_id: string
          fastspring_subscription_id: string
          fastspring_product_id: string
          tier: 'free' | 'core' | 'studio'
          status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          grace_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          fastspring_subscription_id: string
          fastspring_product_id: string
          tier: 'free' | 'core' | 'studio'
          status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          grace_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          fastspring_subscription_id?: string
          fastspring_product_id?: string
          tier?: 'free' | 'core' | 'studio'
          status?: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          grace_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_daily_usage: {
        Args: {
          p_user_id: string
          p_tier: 'free' | 'core' | 'studio'
          p_date?: string
        }
        Returns: Database['public']['Tables']['daily_usage']['Row']
      }
      increment_conversation_count: {
        Args: {
          p_user_id: string
          p_tier: 'free' | 'core' | 'studio'
          p_tokens_used: number
          p_cost_estimate: number
        }
        Returns: Database['public']['Tables']['daily_usage']['Row']
      }
      cleanup_expired_cache: {
        Args: Record<PropertyKey, never>
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
