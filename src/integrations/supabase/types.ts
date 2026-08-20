export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          room_id: string;
          token: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          room_id: string;
          token: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          room_id?: string;
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invites_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_duration: number | null;
          attachment_height: number | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          attachment_width: number | null;
          body: string;
          client_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string;
          sender_id: string;
        };
        Insert: {
          attachment_duration?: number | null;
          attachment_height?: number | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          attachment_type?: string | null;
          attachment_width?: number | null;
          body?: string;
          client_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to?: string | null;
          room_id: string;
          sender_id: string;
        };
        Update: {
          attachment_duration?: number | null;
          attachment_height?: number | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          attachment_type?: string | null;
          attachment_width?: number | null;
          body?: string;
          client_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          reply_to?: string | null;
          room_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          last_seen_at: string;
          theme: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          last_seen_at?: string;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          last_seen_at?: string;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      read_receipts: {
        Row: {
          last_delivered_at: string;
          last_read_at: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          last_delivered_at?: string;
          last_read_at?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          last_delivered_at?: string;
          last_read_at?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "read_receipts_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_members: {
        Row: {
          id: string;
          joined_at: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_private_space: {
        Args: { p_display_name: string; p_room_name?: string; p_theme: string };
        Returns: Json;
      };
      invite_preview: { Args: { p_token: string }; Returns: Json };
      is_room_member: {
        Args: { _room_id: string; _user_id: string };
        Returns: boolean;
      };
      join_private_space: {
        Args: { p_display_name: string; p_theme: string; p_token: string };
        Returns: string;
      };
      mark_delivered: { Args: { p_room_id: string }; Returns: undefined };
      message_room: { Args: { _message_id: string }; Returns: string };
      messages_around: {
        Args: { p_message_id: string; p_room_id: string; p_span?: number };
        Returns: {
          attachment_duration: number | null;
          attachment_height: number | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          attachment_width: number | null;
          body: string;
          client_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string;
          sender_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      room_links: {
        Args: { p_limit?: number; p_room_id: string };
        Returns: {
          attachment_duration: number | null;
          attachment_height: number | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          attachment_width: number | null;
          body: string;
          client_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string;
          sender_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      room_media: {
        Args: {
          p_kind?: string;
          p_limit?: number;
          p_offset?: number;
          p_room_id: string;
        };
        Returns: {
          attachment_duration: number | null;
          attachment_height: number | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          attachment_width: number | null;
          body: string;
          client_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string;
          sender_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rotate_invite: { Args: { p_room_id: string }; Returns: string };
      search_messages: {
        Args: { p_limit?: number; p_query: string; p_room_id: string };
        Returns: {
          attachment_duration: number | null;
          attachment_height: number | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          attachment_type: string | null;
          attachment_width: number | null;
          body: string;
          client_id: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          reply_to: string | null;
          room_id: string;
          sender_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      shares_room_with: {
        Args: { _other: string; _user_id: string };
        Returns: boolean;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      touch_last_seen: { Args: never; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
