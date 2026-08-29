-- Owner decision 2026-08-29: simplify Trợ lý BigBike to one fixed model.
-- This is intentionally a new migration; never edit applied assistant migrations.

-- Remove personal device traces and feature-only notification records first.
delete from admin_notifications where type = 'CHAT_LEAD';
delete from chat_visitors;

-- Preserve ordinary transcript/action data while removing obsolete lead-form metadata.
update chat_messages
set action_metadata = action_metadata
    - 'leadOffer'
    - 'leadPrompt'
    - 'leadPromptSequence'
    - 'leadOfferReason'
    - 'callback'
where action_metadata is not null;

-- Remove FKs to interaction/attribution tables before dropping the feature tables.
alter table if exists chat_messages
    drop column if exists origin_interaction_id,
    drop column if exists lead_offer_reason,
    drop column if exists input_tokens,
    drop column if exists output_tokens,
    drop column if exists thinking_tokens,
    drop column if exists provider_request_count,
    drop column if exists latency_ms,
    drop column if exists estimated_cost_usd,
    drop column if exists requested_model,
    drop column if exists served_model,
    drop column if exists fallback_used,
    drop column if exists fallback_reason;

alter table if exists cart_items
    drop column if exists assistant_interaction_id,
    drop column if exists assistant_conversation_id,
    drop column if exists assistant_attributed_at;

-- The recovery archive copied cart_items before assistant attribution was removed.
-- Drop those identifiers there as well so no historical backup retains the feature data.
alter table if exists maintenance_cart_purge_backup_items
    drop column if exists assistant_interaction_id,
    drop column if exists assistant_conversation_id,
    drop column if exists assistant_attributed_at;

alter table if exists chat_conversations
    drop column if exists lead_offer_request_id,
    drop column if exists lead_offer_opened_at,
    drop column if exists lead_offer_count,
    drop column if exists lead_offer_status;

alter table if exists chat_handoff_requests
    drop column if exists contact_present;

drop table if exists chat_ai_usage_events;
drop table if exists chat_evaluation_model_results;
drop table if exists chat_evaluation_runs;
drop table if exists chat_message_feedback;
drop table if exists chat_order_attributions;
drop table if exists chat_interactions;
drop table if exists chat_leads;

delete from site_settings
where setting_key in (
    'ai_assistant_model',
    'ai_assistant_monthly_cost_warning_usd',
    'ai_assistant_abbreviations',
    'ai_assistant_answer_templates',
    'ai_assistant_memory_days',
    'ai_assistant_proactive_enabled',
    'ai_assistant_proactive_product_seconds',
    'ai_assistant_proactive_cart_seconds',
    'ai_assistant_image_daily_limit',
    'ai_assistant_image_conversation_limit'
);

-- Retained: chat_conversations/messages/handoffs/images, chat_ai_daily_usage,
-- chat_image_daily_usage and chat_product_image_fingerprints.
