import { Body, Controller, Get, Post } from '@nestjs/common';
import { ReceiptsService, type CreateReceiptBody } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get('options')
  options() {
    return this.receipts.options();
  }

  @Post()
  create(@Body() body: CreateReceiptBody) {
    return this.receipts.create(body);
  }
}
