-- Allow secure OAuth credentials for Melhor Envio in the provider-neutral integration store.
ALTER TABLE "ExternalIntegration" DROP CONSTRAINT IF EXISTS "ExternalIntegration_provider_check";
ALTER TABLE "ExternalIntegration"
  ADD CONSTRAINT "ExternalIntegration_provider_check"
  CHECK (provider IN ('BLING','MELHOR_ENVIO'));
