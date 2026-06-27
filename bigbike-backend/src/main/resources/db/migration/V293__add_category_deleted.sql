-- V293: Add deleted column to categories table for soft-delete (Trash) support.

ALTER TABLE categories ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false;
