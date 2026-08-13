import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CuppingDecisionType, CuppingParticipantRole, CuppingSessionMode } from "@bbos/database";
import { LaboratoryService } from "./laboratory.service";

@Controller("laboratory")
export class LaboratoryController {
  constructor(private readonly service: LaboratoryService) {}
  @Get("dashboard") dashboard() { return this.service.dashboard(); }
  @Get("sessions") sessions() { return this.service.listSessions(); }
  @Get("sessions/context") context(@Query("companyId") companyId?: string) { return this.service.sessionContext(companyId); }
  @Post("samples") sample(@Body() body: any) { return this.service.createSample(body); }
  @Post("sessions") session(@Body() body: any) { return this.service.createSession(body); }
  @Patch("sessions/:id/mode") mode(@Param("id") id: string, @Body() body: { mode: CuppingSessionMode }) { return this.service.updateSessionMode(id, body.mode); }
  @Get("sessions/:id") getSession(@Param("id") id: string, @Query("reveal") reveal?: string) { return this.service.getSession(id, reveal === "true"); }
  @Post("sessions/:id/participants") participant(@Param("id") id: string, @Body() body: { userId: string; role?: CuppingParticipantRole }) { return this.service.addParticipant(id, body); }
  @Post("sessions/:id/evaluations") evaluation(@Param("id") id: string, @Body() body: any) { return this.service.saveEvaluation(id, body); }
  @Post("descriptors") descriptor(@Body() body: any) { return this.service.createDescriptor(body); }
  @Post("sessions/:id/consolidate") consolidate(@Param("id") id: string) { return this.service.consolidate(id); }
  @Post("sessions/:id/decision") decision(@Param("id") id: string, @Body() body: { lotId: string; companyId: string; decision: CuppingDecisionType; decisionById: string; notes?: string; averages?: Record<string, number>; descriptors?: string[] }) { return this.service.decide(id, body); }
  @Get("mobile/:token") mobile(@Param("token") token: string, @Query("participantId") participantId?: string) { return this.service.getByToken(token, participantId); }
}
