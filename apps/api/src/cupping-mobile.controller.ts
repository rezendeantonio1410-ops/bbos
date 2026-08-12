import { Body, Controller, Get, Headers, Param, Post, Put } from "@nestjs/common";
import { CuppingMobileService } from "./cupping-mobile.service";
const bearer = (value?: string) => value?.replace(/^Bearer\s+/i, "") ?? "";
@Controller("cupping")
export class CuppingMobileController {
  constructor(private readonly service: CuppingMobileService) {}
  @Post("sessions/:id/release") release(@Param("id") id: string, @Body() body: { participantIds?: string[] }, @Headers("x-user-id") userId?: string) { return this.service.release(id, body.participantIds, userId); }
  @Post("invitations/:id/revoke") revoke(@Param("id") id: string, @Headers("x-user-id") userId?: string) { return this.service.revoke(id, userId); }
  @Post("invitations/accept") accept(@Body() body: { token: string }) { return this.service.accept(body.token); }
  @Get("mobile/sessions/:id") context(@Param("id") id: string, @Headers("authorization") auth?: string) { return this.service.context(id, bearer(auth)); }
  @Put("mobile/sessions/:id/samples/:sampleId/evaluation") save(@Param("id") id: string, @Param("sampleId") sampleId: string, @Headers("authorization") auth: string, @Body() body: Parameters<CuppingMobileService["save"]>[3]) { return this.service.save(id, sampleId, bearer(auth), body); }
  @Post("mobile/sessions/:id/samples/:sampleId/finalize") finalize(@Param("id") id: string, @Param("sampleId") sampleId: string, @Headers("authorization") auth: string) { return this.service.finalize(id, sampleId, bearer(auth)); }
  @Post("evaluations/:id/reopen") reopen(@Param("id") id: string, @Headers("x-user-id") userId?: string) { return this.service.reopen(id, userId); }
}
