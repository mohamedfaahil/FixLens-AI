export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          full_name: string | null;
          role: "student" | "admin" | "staff";
          department: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          full_name?: string | null;
          role?: "student" | "admin" | "staff";
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          full_name?: string | null;
          role?: "student" | "admin" | "staff";
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      complaints: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          building: string;
          room: string | null;
          urgency: string;
          affected: number;
          priority: string;
          predicted_priority: string | null;
          confidence: number | null;
          prediction_source: string | null;
          status: string;
          reporter: string;
          reporter_id: string | null;
          image_url: string | null;
          resolution_note: string | null;
          linked_complaint_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          title: string;
          description: string;
          category: string;
          building: string;
          room?: string | null;
          urgency: string;
          affected?: number;
          priority: string;
          predicted_priority?: string | null;
          confidence?: number | null;
          prediction_source?: string | null;
          status?: string;
          reporter: string;
          reporter_id?: string | null;
          image_url?: string | null;
          resolution_note?: string | null;
          linked_complaint_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: string;
          building?: string;
          room?: string | null;
          urgency?: string;
          affected?: number;
          priority?: string;
          predicted_priority?: string | null;
          confidence?: number | null;
          prediction_source?: string | null;
          status?: string;
          reporter?: string;
          reporter_id?: string | null;
          image_url?: string | null;
          resolution_note?: string | null;
          linked_complaint_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      complaint_follow_ups: {
        Row: {
          id: string;
          complaint_id: string;
          content: string;
          author: string;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          content: string;
          author: string;
          author_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          content?: string;
          author?: string;
          author_id?: string | null;
          created_at?: string;
        };
      };
      complaint_timeline: {
        Row: {
          id: string;
          complaint_id: string;
          status: string;
          note: string | null;
          by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          complaint_id: string;
          status: string;
          note?: string | null;
          by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          status?: string;
          note?: string | null;
          by?: string;
          created_at?: string;
        };
      };
      proposals: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          location: string;
          status: string;
          author: string;
          author_id: string | null;
          support_count: number;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          title: string;
          description: string;
          category: string;
          location: string;
          status?: string;
          author: string;
          author_id?: string | null;
          support_count?: number;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: string;
          location?: string;
          status?: string;
          author?: string;
          author_id?: string | null;
          support_count?: number;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      proposal_votes: {
        Row: {
          id: string;
          proposal_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          recipient_email: string;
          title: string;
          message: string;
          type: string;
          reference_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipient_email: string;
          title: string;
          message: string;
          type?: string;
          reference_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipient_email?: string;
          title?: string;
          message?: string;
          type?: string;
          reference_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: string;
          department: string | null;
        };
      };
      shared_complaints: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          building: string;
          room: string | null;
          urgency: string;
          affected: number;
          priority: string;
          predicted_priority: string | null;
          confidence: number | null;
          status: string;
          image_url: string | null;
          linked_complaint_id: string | null;
          created_at: string;
          updated_at: string;
          reporter: string;
          reporter_id: string | null;
          resolution_note: string | null;
        };
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_shared_complaints: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          title: string;
          description: string;
          category: string;
          building: string;
          room: string | null;
          urgency: string;
          affected: number;
          priority: string;
          predicted_priority: string | null;
          confidence: number | null;
          status: string;
          reporter: string;
          image_url: string | null;
          linked_complaint_id: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      get_complaint_by_id: {
        Args: {
          complaint_id_param: string;
        };
        Returns: {
          id: string;
          title: string;
          description: string;
          category: string;
          building: string;
          room: string | null;
          urgency: string;
          affected: number;
          priority: string;
          predicted_priority: string | null;
          confidence: number | null;
          status: string;
          reporter: string;
          reporter_id: string | null;
          image_url: string | null;
          resolution_note: string | null;
          linked_complaint_id: string | null;
          created_at: string;
          updated_at: string;
          is_owner_or_admin: boolean;
        }[];
      };
      get_public_profile: {
        Args: {
          profile_id: string;
        };
        Returns: {
          id: string;
          full_name: string | null;
          role: string;
          department: string | null;
        }[];
      };
      can_access_complaint_image: {
        Args: {
          object_path: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<PropertyKey, never>;
    CompositeTypes: Record<PropertyKey, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
