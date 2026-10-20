import { Injectable } from "@nestjs/common";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { RECEIPT_ERR, ReceiptError } from "./receipts.errors";
import { ReceiptsRepository } from "./receipts.repository";

@Injectable()
export class ReceiptAttachmentService {
  constructor(
    private readonly repo: ReceiptsRepository,
    private readonly clients: ClientsService,
  ) {}

  attachToBankTransaction(user: AuthUser, receiptId: string, bankTransactionId: string) {
    return this.attach(user, receiptId, { bankTransactionId });
  }

  attachToInvoice(user: AuthUser, receiptId: string, invoiceId: string) {
    return this.attach(user, receiptId, { invoiceId });
  }

  attachToBill(user: AuthUser, receiptId: string, billId: string) {
    return this.attach(user, receiptId, { billId });
  }

  attachToJournal(user: AuthUser, receiptId: string, journalEntryId: string) {
    return this.attach(user, receiptId, { journalEntryId });
  }

  async detach(user: AuthUser, receiptId: string) {
    const receipt = await this.requireReceipt(user, receiptId);
    return this.repo.update(receipt.id, {
      bankTransaction: { disconnect: true },
      invoice: { disconnect: true },
      bill: { disconnect: true },
      journal: { disconnect: true },
    });
  }

  private async attach(
    user: AuthUser,
    receiptId: string,
    target: { bankTransactionId?: string; invoiceId?: string; billId?: string; journalEntryId?: string },
  ) {
    const receipt = await this.requireReceipt(user, receiptId);
    const data: Parameters<ReceiptsRepository["update"]>[1] = {};
    if (target.bankTransactionId) {
      const txn = await this.repo.findBankTransaction(target.bankTransactionId);
      if (!txn || txn.bankAccount.clientId !== receipt.clientId) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Bank transaction not found", undefined, 404);
      }
      data.bankTransaction = { connect: { id: txn.id } };
      if (receipt.ocrMerchant && !txn.merchantName) {
        await this.repo.updateBankTransaction(txn.id, {
          merchantName: receipt.ocrMerchant,
          enrichment: {
            ...((txn as { enrichment?: Record<string, unknown> }).enrichment ?? {}),
            receiptOcr: { merchantName: receipt.ocrMerchant, amount: receipt.ocrAmount, date: receipt.ocrDate },
          },
        });
      }
    }
    if (target.invoiceId) {
      const invoice = await this.repo.findInvoice(target.invoiceId);
      if (!invoice || invoice.clientId !== receipt.clientId) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Invoice not found", undefined, 404);
      }
      data.invoice = { connect: { id: invoice.id } };
    }
    if (target.billId) {
      const bill = await this.repo.findBill(target.billId);
      if (!bill || bill.clientId !== receipt.clientId) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Bill not found", undefined, 404);
      }
      data.bill = { connect: { id: bill.id } };
    }
    if (target.journalEntryId) {
      const journal = await this.repo.findJournal(target.journalEntryId);
      if (!journal || journal.clientId !== receipt.clientId) {
        throw new ReceiptError(RECEIPT_ERR.TARGET_NOT_FOUND, "Journal entry not found", undefined, 404);
      }
      data.journal = { connect: { id: journal.id } };
    }
    return this.repo.update(receipt.id, data);
  }

  private async requireReceipt(user: AuthUser, id: string) {
    const receipt = await this.repo.find(id);
    if (!receipt) {
      throw new ReceiptError(RECEIPT_ERR.NOT_FOUND, "Receipt not found", undefined, 404);
    }
    await this.clients.get(user, receipt.clientId);
    return receipt;
  }
}
