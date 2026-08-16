alter table chat_leads
    add column source varchar(16) not null default 'FORM';

alter table chat_leads
    add constraint ck_chat_leads_source check (source in ('FORM', 'ACCOUNT'));
