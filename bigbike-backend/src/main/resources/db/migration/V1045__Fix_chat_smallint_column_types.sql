-- V1045: align chat assistant column types with the JPA entities.
--
-- V1044 created chat_conversations.lead_offer_count and
-- chat_interactions.lead_prompt_sequence as smallint, but
-- ChatConversationEntity.leadOfferCount is `int` and
-- ChatInteractionEntity.leadPromptSequence is `Integer`. Hibernate schema
-- validation rejects smallint for those mappings and the application fails to
-- start. chat_conversations.turn_count (also `int`) is already integer, so
-- integer is the convention here.
--
-- Both columns are brand new: chat_interactions was created empty by V1044 and
-- lead_offer_count was added with default 0, so the widening rewrite is cheap.
-- Re-running on a database already holding integer is a no-op.

alter table chat_conversations
    alter column lead_offer_count type integer;

alter table chat_interactions
    alter column lead_prompt_sequence type integer;
