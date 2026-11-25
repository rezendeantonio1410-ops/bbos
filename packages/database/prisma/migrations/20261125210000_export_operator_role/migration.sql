-- Users who work only in the export area (clients abroad, samples, contracts).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EXPORT_OPERATOR';
