import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Public } from "./auth.guard";
import {
  STOREFRONT_CUSTOMER_COOKIE,
  StorefrontCustomerService,
} from "./storefront-customer.service";

@Controller("storefront/customer")
@Public()
export class StorefrontCustomerController {
  constructor(private readonly customers: StorefrontCustomerService) {}

  private async account(request: any) {
    const account = await this.customers.resolve(this.customers.readToken(request));
    if (!account)
      throw new UnauthorizedException("Entre novamente na sua área Bispo.");
    return account;
  }

  @Post("auth/request-code")
  requestCode(@Body() body: { email?: string }) {
    return this.customers.requestCode(body.email);
  }

  @Post("auth/verify-code")
  async verifyCode(
    @Body() body: { email?: string; code?: string },
    @Res({ passthrough: true }) response: any,
  ) {
    const result = await this.customers.verifyCode(body.email, body.code);
    response.cookie(STOREFRONT_CUSTOMER_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 86400000,
      path: "/",
    });
    return { account: result.account };
  }

  @Post("auth/logout")
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    await this.customers.revoke(this.customers.readToken(request));
    response.clearCookie(STOREFRONT_CUSTOMER_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return { ok: true };
  }

  @Get("me")
  async me(@Req() request: any) {
    return this.customers.dashboard(await this.account(request));
  }

  @Patch("me")
  async updateMe(@Req() request: any, @Body() body: Record<string, unknown>) {
    return {
      account: await this.customers.updateProfile(
        await this.account(request),
        body,
      ),
    };
  }

  @Post("addresses")
  async createAddress(@Req() request: any, @Body() body: Record<string, unknown>) {
    return {
      address: await this.customers.createAddress(
        await this.account(request),
        body,
      ),
    };
  }

  @Patch("addresses/:id")
  async updateAddress(
    @Req() request: any,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return {
      address: await this.customers.updateAddress(
        await this.account(request),
        id,
        body,
      ),
    };
  }

  @Delete("addresses/:id")
  async deleteAddress(@Req() request: any, @Param("id") id: string) {
    return this.customers.deleteAddress(await this.account(request), id);
  }
}
