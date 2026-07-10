/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  ConfirmPaymentDto,
} from './dto/billing.dto';
import {
  User,
  UserRole,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
} from '@prisma/client';
import { Response } from 'express';

describe('BillingController', () => {
  let controller: BillingController;
  let serviceMock: Record<string, jest.Mock>;

  const mockUser = {
    id: 'u-1',
    email: 'test@example.com',
    role: UserRole.RECEPTIONIST,
  } as unknown as User;

  beforeEach(async () => {
    serviceMock = {
      getWorkspaceKpis: jest.fn(),
      getWorkspaceQueue: jest.fn(),
      createInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      listInvoices: jest.fn(),
      listInvoicesByBooking: jest.fn(),
      getPendingLabOrdersForBilling: jest.fn(),
      exportInvoicesToCsv: jest.fn(),
      getInvoiceById: jest.fn(),
      addInvoiceItem: jest.fn(),
      removeInvoiceItem: jest.fn(),
      addPayment: jest.fn(),
      listMyInvoices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        {
          provide: BillingService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
  });

  it('getWorkspaceKpis should delegate to billingService.getWorkspaceKpis', async () => {
    serviceMock.getWorkspaceKpis.mockResolvedValue({ totalRevenue: 1000 });
    const result = await controller.getWorkspaceKpis();
    expect(result).toEqual({ totalRevenue: 1000 });
    expect(serviceMock.getWorkspaceKpis).toHaveBeenCalled();
  });

  it('getWorkspaceQueue should delegate to billingService.getWorkspaceQueue', async () => {
    serviceMock.getWorkspaceQueue.mockResolvedValue([]);
    const result = await controller.getWorkspaceQueue('patient name');
    expect(result).toEqual([]);
    expect(serviceMock.getWorkspaceQueue).toHaveBeenCalledWith({
      search: 'patient name',
    });
  });

  it('createInvoice should delegate to billingService.createInvoice', async () => {
    const dto: CreateInvoiceDto = {
      bookingId: 'b-1',
      invoiceType: InvoiceType.CONSULTATION,
    };
    serviceMock.createInvoice.mockResolvedValue({ id: 'inv-1' });
    const result = await controller.createInvoice(dto, mockUser);
    expect(result).toEqual({ id: 'inv-1' });
    expect(serviceMock.createInvoice).toHaveBeenCalledWith(dto, mockUser);
  });

  it('deleteInvoice should delegate to billingService.deleteInvoice', async () => {
    serviceMock.deleteInvoice.mockResolvedValue({ success: true });
    const result = await controller.deleteInvoice('inv-1', mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.deleteInvoice).toHaveBeenCalledWith('inv-1', mockUser);
  });

  it('listInvoices should delegate to billingService.listInvoices', async () => {
    serviceMock.listInvoices.mockResolvedValue([]);
    const result = await controller.listInvoices(
      InvoiceStatus.PAID,
      InvoiceType.CONSULTATION,
      'p-1',
      '2028-12-01',
      '2028-12-05',
      'search',
      '2',
      '10',
      mockUser,
    );
    expect(result).toEqual([]);
    expect(serviceMock.listInvoices).toHaveBeenCalledWith({
      status: InvoiceStatus.PAID,
      invoiceType: InvoiceType.CONSULTATION,
      patientProfileId: 'p-1',
      startDate: '2028-12-01',
      endDate: '2028-12-05',
      search: 'search',
      page: 2,
      limit: 10,
      currentUser: mockUser,
    });
  });

  it('listInvoicesByBooking should delegate to billingService.listInvoicesByBooking', async () => {
    serviceMock.listInvoicesByBooking.mockResolvedValue([]);
    const result = await controller.listInvoicesByBooking('b-1', mockUser);
    expect(result).toEqual([]);
    expect(serviceMock.listInvoicesByBooking).toHaveBeenCalledWith(
      'b-1',
      mockUser,
    );
  });

  it('getPendingLabOrdersForBilling should delegate to billingService.getPendingLabOrdersForBilling', async () => {
    serviceMock.getPendingLabOrdersForBilling.mockResolvedValue([]);
    const result = await controller.getPendingLabOrdersForBilling('b-1');
    expect(result).toEqual([]);
    expect(serviceMock.getPendingLabOrdersForBilling).toHaveBeenCalledWith(
      'b-1',
    );
  });

  it('exportInvoices should delegate to exportInvoicesToCsv and write response', async () => {
    const mockRes = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;
    serviceMock.exportInvoicesToCsv.mockResolvedValue('csv-content');

    await controller.exportInvoices(
      mockRes,
      InvoiceStatus.PAID,
      InvoiceType.CONSULTATION,
      'p-1',
      '2028-12-01',
      '2028-12-05',
      'search',
      mockUser,
    );

    expect(serviceMock.exportInvoicesToCsv).toHaveBeenCalledWith({
      status: InvoiceStatus.PAID,
      invoiceType: InvoiceType.CONSULTATION,
      patientProfileId: 'p-1',
      startDate: '2028-12-01',
      endDate: '2028-12-05',
      search: 'search',
      currentUser: mockUser,
    });
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(mockRes.write).toHaveBeenCalledWith('\ufeff');
    expect(mockRes.write).toHaveBeenCalledWith('csv-content');
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('getInvoice should delegate to billingService.getInvoiceById', async () => {
    serviceMock.getInvoiceById.mockResolvedValue({ id: 'inv-1' });
    const result = await controller.getInvoice('inv-1', mockUser);
    expect(result).toEqual({ id: 'inv-1' });
    expect(serviceMock.getInvoiceById).toHaveBeenCalledWith('inv-1', mockUser);
  });

  it('addItem should delegate to billingService.addInvoiceItem', async () => {
    const dto: AddInvoiceItemDto = {
      itemName: 'Item 1',
      quantity: 2,
      unitPrice: 500,
    };
    serviceMock.addInvoiceItem.mockResolvedValue({ id: 'item-1' });
    const result = await controller.addItem('inv-1', dto, mockUser);
    expect(result).toEqual({ id: 'item-1' });
    expect(serviceMock.addInvoiceItem).toHaveBeenCalledWith(
      'inv-1',
      dto,
      mockUser,
    );
  });

  it('removeItem should delegate to billingService.removeInvoiceItem', async () => {
    serviceMock.removeInvoiceItem.mockResolvedValue({ success: true });
    const result = await controller.removeItem('inv-1', 'item-1', mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.removeInvoiceItem).toHaveBeenCalledWith(
      'inv-1',
      'item-1',
      mockUser,
    );
  });

  it('addPayment should delegate to billingService.addPayment', async () => {
    const dto: ConfirmPaymentDto = {
      amountPaid: 1000,
      paymentMethod: PaymentMethod.CASH,
    };
    serviceMock.addPayment.mockResolvedValue({ success: true });
    const result = await controller.addPayment('inv-1', dto, mockUser);
    expect(result).toEqual({ success: true });
    expect(serviceMock.addPayment).toHaveBeenCalledWith(
      'inv-1',
      dto,
      'u-1',
      mockUser,
    );
  });

  it('listMyInvoices should delegate to billingService.listMyInvoices', async () => {
    serviceMock.listMyInvoices.mockResolvedValue([]);
    const result = await controller.listMyInvoices(
      { id: 'u-1' },
      InvoiceStatus.PAID,
      '2',
      '10',
    );
    expect(result).toEqual([]);
    expect(serviceMock.listMyInvoices).toHaveBeenCalledWith('u-1', {
      status: InvoiceStatus.PAID,
      page: 2,
      limit: 10,
    });
  });

  it('should propagate NotFoundException from getInvoiceById service', async () => {
    serviceMock.getInvoiceById.mockRejectedValue(
      new NotFoundException('Invoice not found'),
    );
    await expect(
      controller.getInvoice('non-existent', mockUser),
    ).rejects.toThrow(NotFoundException);
  });

  it('should propagate BadRequestException from addPayment service', async () => {
    const dto: ConfirmPaymentDto = {
      amountPaid: -100,
      paymentMethod: PaymentMethod.CASH,
    };
    serviceMock.addPayment.mockRejectedValue(
      new BadRequestException('Invalid amount'),
    );
    await expect(controller.addPayment('inv-1', dto, mockUser)).rejects.toThrow(
      BadRequestException,
    );
  });
});
