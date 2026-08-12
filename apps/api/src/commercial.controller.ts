import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CommercialService } from "./commercial.service";

@Controller("commercial")
export class CommercialController {
  constructor(private readonly service: CommercialService) {}
  @Get("dashboard") dashboard(@Headers("x-user-id") userId?: string) {
    return this.service.dashboardForUser(userId);
  }
  @Get("dashboard/representative") representativeDashboard(
    @Headers("x-user-id") userId?: string,
  ) {
    return this.service.representativeDashboard(userId);
  }
  @Get("representative-stock") representativeStock(
    @Headers("x-user-id") userId?: string,
  ) {
    return this.service.representativeStock(userId);
  }
  @Get("representative-reports") representativeReports(
    @Headers("x-user-id") userId?: string,
  ) {
    return this.service.representativeReports(userId);
  }
  @Get("representative-orders") representativeOrders(
    @Headers("x-user-id") userId?: string,
    @Query("status") status?: any,
  ) {
    return this.service.representativeOrders(userId, status);
  }
  @Get("representative-orders/:id") representativeOrder(
    @Headers("x-user-id") userId: string,
    @Param("id") id: string,
  ) {
    return this.service.representativeOrder(id, userId);
  }
  @Get("sales-people") people(@Query("companyId") companyId?: string) {
    return this.service.listPeople(companyId);
  }
  @Get("sales-people/:id") person(@Param("id") id: string) {
    return this.service.getPerson(id);
  }
  @Get("customers") customers(
    @Headers("x-user-id") userId?: string,
    @Query("companyId") companyId?: string,
    @Query("salesPersonId") salesPersonId?: string,
  ) {
    return userId
      ? this.service.listCustomersForUser(userId, companyId)
      : this.service.listCustomers(companyId, salesPersonId);
  }
  @Get("customers/:id") customer(
    @Headers("x-user-id") userId: string,
    @Param("id") id: string,
  ) {
    return this.service.getCustomer360ForUser(id, userId);
  }
  @Get("customers/:id/360") customer360(
    @Headers("x-user-id") userId: string,
    @Param("id") id: string,
  ) {
    return this.service.getCustomer360ForUser(id, userId);
  }
  @Post("customers") createCustomer(
    @Body() body: Parameters<CommercialService["createCustomer"]>[0],
  ) {
    return this.service.createCustomer(body);
  }
  @Post("customers/:id/documents") document(
    @Param("id") customerId: string,
    @Body()
    body: Omit<
      Parameters<CommercialService["createDocument"]>[0],
      "customerId"
    >,
  ) {
    return this.service.createDocument({ ...body, customerId });
  }
  @Post("customers/:id/documents/upload")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Headers("x-user-id") userId: string,
    @Param("id") customerId: string,
    @UploadedFile()
    file: { originalname: string; mimetype: string; buffer: Buffer },
    @Body("type") type: string,
  ) {
    return this.service.uploadDocument({
      userId,
      customerId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      type,
    });
  }
  @Get("customers/:id/documents/:documentId/download") async downloadDocument(
    @Headers("x-user-id") userId: string,
    @Param("id") customerId: string,
    @Param("documentId") documentId: string,
    @Res()
    response: {
      setHeader(name: string, value: string): void;
      send(body: Buffer): unknown;
    },
  ) {
    const result = await this.service.downloadDocument({
      userId,
      customerId,
      documentId,
    });
    response.setHeader(
      "Content-Type",
      result.document.mimeType ?? "application/octet-stream",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.document.name.replace(/"/g, "")}"`,
    );
    return response.send(result.buffer);
  }
  @Post("customers/:id/credit-requests") creditRequest(
    @Headers("x-user-id") userId: string,
    @Param("id") customerId: string,
    @Body()
    body: Omit<
      Parameters<CommercialService["createCreditRequest"]>[0],
      "customerId" | "requestedById"
    >,
  ) {
    return this.service.createCreditRequestForUser({
      ...body,
      customerId,
      userId,
    });
  }
  @Patch("credit-requests/:id") reviewCredit(
    @Param("id") id: string,
    @Body() body: Parameters<CommercialService["reviewCreditRequest"]>[1],
  ) {
    return this.service.reviewCreditRequest(id, body);
  }
  @Get("credit-requests") creditRequests(
    @Query("companyId") companyId?: string,
    @Query("status")
    status?: Parameters<CommercialService["listCreditRequests"]>[1],
  ) {
    return this.service.listCreditRequests(companyId, status);
  }
  @Post("credit-requests/:id/request-documents") requestDocuments(
    @Param("id") id: string,
    @Body() body: { reviewerId: string; note: string },
  ) {
    return this.service.submitCreditDocumentRequest(
      id,
      body.reviewerId,
      body.note,
    );
  }
  @Get("customers/:id/activities") activities(@Param("id") customerId: string) {
    return this.service.listCustomerActivities(customerId);
  }
  @Post("customers/:id/activities") createActivity(
    @Param("id") customerId: string,
    @Body()
    body: Omit<
      Parameters<CommercialService["createCustomerActivity"]>[0],
      "customerId"
    >,
  ) {
    return this.service.createCustomerActivity({ ...body, customerId });
  }
  @Get("targets") targets(
    @Query("companyId") companyId?: string,
    @Query("salesPersonId") salesPersonId?: string,
  ) {
    return this.service.listTargets(companyId, salesPersonId);
  }
  @Get("commissions") commissions(
    @Query("companyId") companyId?: string,
    @Query("salesPersonId") salesPersonId?: string,
  ) {
    return this.service.listCommissions(companyId, salesPersonId);
  }
  @Get("visits") visits(
    @Query("companyId") companyId?: string,
    @Query("salesPersonId") salesPersonId?: string,
  ) {
    return this.service.listVisits(companyId, salesPersonId);
  }
  @Get("opportunities") opportunities(
    @Query("companyId") companyId?: string,
    @Query("salesPersonId") salesPersonId?: string,
  ) {
    return this.service.listOpportunities(companyId, salesPersonId);
  }
  @Post("visits") createVisit(@Body() body: any) {
    return this.service.createVisit(body);
  }
  @Post("opportunities") createOpportunity(@Body() body: any) {
    return this.service.createOpportunity(body);
  }
}
