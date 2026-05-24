import { SetMetadata } from '@nestjs/common';
import { MessageCodes } from '../constants/message-codes.const';

export const RESPONSE_MESSAGE_METADATA = 'response_message_metadata';

// Strictly type the messageCode to only accept values from the MessageCodes constant
export type MessageCodeType = (typeof MessageCodes)[keyof typeof MessageCodes];

export interface ResponseMessageOptions {
  messageCode: MessageCodeType;
  message?: string;
}

/**
 * Decorator to set standard success response message and messageCode for the custom global interceptor.
 * Strongly typed to prevent passing arbitrary string literals.
 *
 * @param messageCode Must be a value from the MessageCodes constant (e.g. MessageCodes.CATEGORY_CREATED)
 * @param message Optional developer fallback message
 */
export const ResponseMessage = (
  messageCode: MessageCodeType,
  message?: string,
) => SetMetadata(RESPONSE_MESSAGE_METADATA, { messageCode, message });
