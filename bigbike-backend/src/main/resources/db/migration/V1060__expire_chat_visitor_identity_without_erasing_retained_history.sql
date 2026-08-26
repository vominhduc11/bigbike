-- Phase 3D privacy: an expired device identity must not outlive the 30-day memory window.
-- Conversation content still follows the separate 90-day retention rule.

alter table chat_conversations
    drop constraint if exists chat_conversations_visitor_id_fkey;
alter table chat_conversations
    add constraint chat_conversations_visitor_id_fkey
        foreign key (visitor_id) references chat_visitors(id) on delete set null;
