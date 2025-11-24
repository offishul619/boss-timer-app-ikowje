
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
      boss_spawns: {
        Row: {
          id: string
          spawned_at: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          spawned_at: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          spawned_at?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
