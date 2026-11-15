import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { MobileNotificationService } from "./mobile-notification.service";
import {
  normalizePushSubscription,
  type PushSubscriptionInput,
} from "./mobile-push";

type AuthenticatedRequest = Request & {
  user: { id: string; companyId: string; name: string };
};

@Controller("push")
export class MobileNotificationsController {
  constructor(private readonly notifications: MobileNotificationService) {}

  @Get("status")
  status(@Req() request: AuthenticatedRequest) {
    return this.notifications.status(request.user.id);
  }

  @Post("subscription")
  subscribe(
    @Req() request: AuthenticatedRequest,
    @Body() body: PushSubscriptionInput,
  ) {
    return this.notifications.subscribe(
      request.user,
      normalizePushSubscription(body),
      request.headers["user-agent"],
    );
  }

  @Delete("subscription")
  unsubscribe(
    @Req() request: AuthenticatedRequest,
    @Body() body: { endpoint?: string },
  ) {
    return this.notifications.unsubscribe(
      request.user.id,
      body.endpoint?.trim() ?? "",
    );
  }

  @Post("test")
  test(@Req() request: AuthenticatedRequest) {
    return this.notifications.sendTest(request.user);
  }

  @Get("notifications")
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(request.user.id);
  }

  @Patch("notifications/:id/read")
  read(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.read(request.user.id, id);
  }
}
